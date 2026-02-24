"""
Google Cloud Compute Engine Provider
自動在 GCP 開啟指定規格的 VM 並部署 OpenClaw
"""

import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class GCPProvider:
    """
    GCP Compute Engine 自動開機 Provider

    需要：
      1. 設定 GOOGLE_APPLICATION_CREDENTIALS 指向 Service Account JSON 金鑰
         或執行 `gcloud auth application-default login`
      2. pip install google-cloud-compute

    環境變數：
      - GCP_PROJECT_ID      (必填)
      - GCP_ZONE            (選填，預設: asia-east1-b 台灣)
    """

    DEFAULT_ZONE = "asia-east1-b"        # 台灣
    DEFAULT_IMAGE_PROJECT = "ubuntu-os-cloud"
    DEFAULT_IMAGE_FAMILY = "ubuntu-2204-lts"

    def __init__(
        self,
        project_id: str,
        zone: Optional[str] = None,
        credentials_path: Optional[str] = None,
    ):
        self.project_id = project_id
        self.zone = zone or self.DEFAULT_ZONE
        self.region = "-".join(self.zone.split("-")[:-1])  # e.g. asia-east1

        # 延遲匯入，避免未安裝 SDK 時報錯
        try:
            from google.cloud import compute_v1
            from google.oauth2 import service_account

            if credentials_path:
                creds = service_account.Credentials.from_service_account_file(
                    credentials_path,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"],
                )
                self._instances_client = compute_v1.InstancesClient(credentials=creds)
                self._operations_client = compute_v1.ZoneOperationsClient(credentials=creds)
                self._images_client = compute_v1.ImagesClient(credentials=creds)
                self._firewalls_client = compute_v1.FirewallsClient(credentials=creds)
                self._global_ops_client = compute_v1.GlobalOperationsClient(credentials=creds)
            else:
                self._instances_client = compute_v1.InstancesClient()
                self._operations_client = compute_v1.ZoneOperationsClient()
                self._images_client = compute_v1.ImagesClient()
                self._firewalls_client = compute_v1.FirewallsClient()
                self._global_ops_client = compute_v1.GlobalOperationsClient()

            self._compute_v1 = compute_v1
        except ImportError:
            raise ImportError(
                "請先安裝 GCP SDK：pip install google-cloud-compute google-auth"
            )

    # ──────────────────────────────────────────────────────────
    # 公開方法
    # ──────────────────────────────────────────────────────────

    def provision(
        self,
        machine_type: str,
        disk_gb: int,
        user_data: str,
        user_id: str,
        plan_name: str,
    ) -> dict:
        """
        建立 GCP VM 實例並等待其啟動。

        Returns:
            {
                "instance_id": str,
                "public_ip": str,
                "zone": str,
                "provider": "gcp",
            }
        """
        instance_name = f"openclaw-{user_id.lower().replace('_', '-')}"
        compute_v1 = self._compute_v1

        # 1. 取得最新 Ubuntu 22.04 image
        image = self._images_client.get_from_family(
            project=self.DEFAULT_IMAGE_PROJECT,
            family=self.DEFAULT_IMAGE_FAMILY,
        )
        source_disk_image = image.self_link

        # 2. 確保防火牆規則存在
        self._ensure_firewall()

        # 3. 組裝實例定義
        machine_type_url = (
            f"zones/{self.zone}/machineTypes/{machine_type}"
        )

        instance_resource = compute_v1.Instance(
            name=instance_name,
            machine_type=machine_type_url,
            disks=[
                compute_v1.AttachedDisk(
                    boot=True,
                    auto_delete=True,
                    initialize_params=compute_v1.AttachedDiskInitializeParams(
                        source_image=source_disk_image,
                        disk_size_gb=disk_gb,
                        disk_type=f"zones/{self.zone}/diskTypes/pd-ssd",
                    ),
                )
            ],
            network_interfaces=[
                compute_v1.NetworkInterface(
                    access_configs=[
                        compute_v1.AccessConfig(
                            name="External NAT",
                            type_="ONE_TO_ONE_NAT",
                            network_tier="STANDARD",
                        )
                    ]
                )
            ],
            tags=compute_v1.Tags(items=["openclaw-server"]),
            metadata=compute_v1.Metadata(
                items=[
                    compute_v1.Items(key="startup-script", value=user_data),
                    compute_v1.Items(key="managed-by", value="openclaw-provisioner"),
                    compute_v1.Items(key="user-id", value=user_id),
                    compute_v1.Items(key="plan", value=plan_name),
                ]
            ),
        )

        logger.info(f"[GCP] 正在建立 {machine_type} 實例 (user={user_id}, plan={plan_name})")
        operation = self._instances_client.insert(
            project=self.project_id,
            zone=self.zone,
            instance_resource=instance_resource,
        )

        # 4. 等待操作完成
        self._wait_for_zone_operation(operation.name)
        logger.info(f"[GCP] 實例 {instance_name} 建立完成，取得 IP 中...")

        # 5. 取得 Public IP
        instance = self._instances_client.get(
            project=self.project_id,
            zone=self.zone,
            instance=instance_name,
        )
        public_ip = (
            instance.network_interfaces[0].access_configs[0].nat_i_p
        )
        logger.info(f"[GCP] 實例啟動完成，IP: {public_ip}")

        return {
            "instance_id": instance_name,
            "public_ip": public_ip,
            "zone": self.zone,
            "provider": "gcp",
        }

    def terminate(self, instance_id: str) -> None:
        """終止（刪除）指定實例"""
        operation = self._instances_client.delete(
            project=self.project_id,
            zone=self.zone,
            instance=instance_id,
        )
        self._wait_for_zone_operation(operation.name)
        logger.info(f"[GCP] 實例 {instance_id} 已終止")

    def list_managed_instances(self) -> list:
        """列出所有由本系統建立的實例"""
        instances_list = self._instances_client.list(
            project=self.project_id,
            zone=self.zone,
            filter='metadata.items.key="managed-by" AND metadata.items.value="openclaw-provisioner"',
        )
        result = []
        for inst in instances_list:
            meta = {item.key: item.value for item in inst.metadata.items}
            nat_ip = "N/A"
            if inst.network_interfaces:
                access_configs = inst.network_interfaces[0].access_configs
                if access_configs:
                    nat_ip = access_configs[0].nat_i_p or "N/A"

            result.append({
                "instance_id": inst.name,
                "public_ip": nat_ip,
                "state": inst.status,
                "machine_type": inst.machine_type.split("/")[-1],
                "user_id": meta.get("user-id", "unknown"),
                "plan": meta.get("plan", "unknown"),
                "zone": self.zone,
            })
        return result

    # ──────────────────────────────────────────────────────────
    # 私有輔助方法
    # ──────────────────────────────────────────────────────────

    def _ensure_firewall(self) -> None:
        """確保 openclaw-allow 防火牆規則存在"""
        compute_v1 = self._compute_v1
        rule_name = "openclaw-allow"
        try:
            self._firewalls_client.get(project=self.project_id, firewall=rule_name)
            logger.debug(f"[GCP] 防火牆規則 {rule_name} 已存在")
            return
        except Exception:
            pass

        firewall = compute_v1.Firewall(
            name=rule_name,
            direction="INGRESS",
            allowed=[
                compute_v1.Allowed(I_p_protocol="tcp", ports=["22", "8080"])
            ],
            target_tags=["openclaw-server"],
            source_ranges=["0.0.0.0/0"],
            description="OpenClaw SSH + Gateway",
        )
        operation = self._firewalls_client.insert(
            project=self.project_id, firewall_resource=firewall
        )
        self._wait_for_global_operation(operation.name)
        logger.info(f"[GCP] 防火牆規則 {rule_name} 已建立")

    def _wait_for_zone_operation(self, operation_name: str, timeout: int = 300) -> None:
        """輪詢等待 Zone Operation 完成"""
        deadline = time.time() + timeout
        while time.time() < deadline:
            result = self._operations_client.get(
                project=self.project_id,
                zone=self.zone,
                operation=operation_name,
            )
            if result.status == self._compute_v1.Operation.Status.DONE:
                if result.error:
                    raise RuntimeError(f"[GCP] 操作失敗: {result.error}")
                return
            time.sleep(5)
        raise TimeoutError(f"[GCP] 操作 {operation_name} 超時 ({timeout}s)")

    def _wait_for_global_operation(self, operation_name: str, timeout: int = 60) -> None:
        """輪詢等待 Global Operation 完成"""
        deadline = time.time() + timeout
        while time.time() < deadline:
            result = self._global_ops_client.get(
                project=self.project_id,
                operation=operation_name,
            )
            if result.status == self._compute_v1.Operation.Status.DONE:
                return
            time.sleep(3)
        raise TimeoutError(f"[GCP] Global 操作 {operation_name} 超時")
