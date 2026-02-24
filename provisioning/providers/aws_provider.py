"""
AWS EC2 Provider
自動在 AWS 開啟指定規格的 EC2 實例並部署 OpenClaw

含以下能力：
  - 多 Region 自動選擇（依容量最優原則）
  - vCPU 配額即時查詢（Service Quotas API）
  - 開通前容量預警，接近上限自動告警
"""

import time
import boto3
from botocore.exceptions import ClientError
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class AWSProvider:
    """
    AWS EC2 自動開機 Provider

    需要環境變數或 AWS 設定：
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY
      - AWS_DEFAULT_REGION (預設: ap-northeast-1 東京)
    """

    # ──────────────────────────────────────────────────────────
    # 常數定義
    # ──────────────────────────────────────────────────────────

    # 主要部署 Region（依 ARCHITECTURE.md 的容量規劃）
    # requires_optin=True 表示該 Region 需要在 AWS Console 手動啟用
    REGION_CONFIG = {
        "ap-northeast-1": {"name": "東京",   "target_users": 8000, "requires_optin": False},
        "ap-east-1":      {"name": "香港",   "target_users": 5000, "requires_optin": True},
        "ap-southeast-1": {"name": "新加坡", "target_users": 4000, "requires_optin": False},
        "ap-northeast-3": {"name": "大阪",   "target_users": 3000, "requires_optin": True},
    }

    # Ubuntu 22.04 LTS AMI（固定表，未收錄的 Region 會動態查詢）
    UBUNTU_AMI = {
        "ap-northeast-1": "ami-0d52744d6551d851e",   # 東京
        "ap-southeast-1": "ami-0df7a207adb9748c7",   # 新加坡
        "ap-east-1":      "ami-07d7e3e669dc6f797",   # 香港（opt-in 需先啟用該 Region）
        "ap-northeast-3": "ami-06f5b4f6f1cd04be7",   # 大阪（opt-in 需先啟用該 Region）
        "us-east-1":      "ami-0c7217cdde317cfec",   # 美東
        "us-west-2":      "ami-0efcece6bed30fd98",   # 美西
        "eu-central-1":   "ami-0faab6bdbac9486fb",   # 法蘭克福
    }

    # vCPU 數量查找表（避免 describe_instance_types API 速率限制）
    VCPU_COUNT = {
        "t3.nano":     2, "t3.micro":    2, "t3.small":    2,
        "t3.medium":   2, "t3.large":    2, "t3.xlarge":   4, "t3.2xlarge":  8,
        "t3a.nano":    2, "t3a.micro":   2, "t3a.small":   2,
        "t3a.medium":  2, "t3a.large":   2, "t3a.xlarge":  4, "t3a.2xlarge": 8,
        "t2.micro":    1, "t2.small":    1, "t2.medium":   2,
        "t2.large":    2, "t2.xlarge":   4, "t2.2xlarge":  8,
        "m5.large":    2, "m5.xlarge":   4, "m5.2xlarge":  8, "m5.4xlarge": 16,
        "m6i.large":   2, "m6i.xlarge":  4, "m6i.2xlarge": 8, "m6i.4xlarge":16,
        "c5.large":    2, "c5.xlarge":   4, "c5.2xlarge":  8,
    }

    # Service Quotas 配額代碼（Running On-Demand Standard instances vCPU 上限）
    # 涵蓋 A, C, D, H, I, M, R, T, Z 系列（包含我們用的 t3）
    VCPU_QUOTA_CODE = "L-1216C47A"

    # 容量狀態閾值（相對於 vCPU 配額的使用率）
    WARN_THRESHOLD     = 0.70   # 70% → ⚠️  WARNING（提醒申請提升）
    CRITICAL_THRESHOLD = 0.85   # 85% → 🔴 CRITICAL（強烈建議立即行動）

    DEFAULT_REGION = "ap-northeast-1"

    def __init__(
        self,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        region: Optional[str] = None,
    ):
        self.region = region or self.DEFAULT_REGION
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=self.region,
        )
        self.ec2 = session.resource("ec2")
        self.ec2_client = session.client("ec2")
        self._session = session

    # ──────────────────────────────────────────────────────────
    # 公開方法
    # ──────────────────────────────────────────────────────────

    def provision(
        self,
        instance_type: str,
        disk_gb: int,
        user_data: str,
        user_id: str,
        plan_name: str,
        key_name: Optional[str] = None,
    ) -> dict:
        """
        建立 EC2 實例並等待其進入 running 狀態。

        Returns:
            {
                "instance_id": str,
                "public_ip": str,
                "region": str,
                "provider": "aws",
            }
        """
        sg_id  = self._ensure_security_group()
        ami_id = self._get_ubuntu_ami()

        logger.info(f"[AWS/{self.region}] 建立 {instance_type} 實例 (user={user_id}, plan={plan_name})")
        instances = self.ec2.create_instances(
            ImageId=ami_id,
            InstanceType=instance_type,
            MinCount=1,
            MaxCount=1,
            UserData=user_data,
            SecurityGroupIds=[sg_id],
            BlockDeviceMappings=[
                {
                    "DeviceName": "/dev/sda1",
                    "Ebs": {
                        "VolumeSize": disk_gb,
                        "VolumeType": "gp3",
                        "DeleteOnTermination": True,
                    },
                }
            ],
            TagSpecifications=[
                {
                    "ResourceType": "instance",
                    "Tags": [
                        {"Key": "Name",      "Value": f"openclaw-{user_id}"},
                        {"Key": "ManagedBy", "Value": "openclaw-provisioner"},
                        {"Key": "UserId",    "Value": user_id},
                        {"Key": "Plan",      "Value": plan_name},
                    ],
                }
            ],
            **({"KeyName": key_name} if key_name else {}),
        )

        instance = instances[0]
        logger.info(f"[AWS/{self.region}] 實例已建立: {instance.id}，等待啟動...")
        instance.wait_until_running()
        instance.reload()

        public_ip = instance.public_ip_address
        logger.info(f"[AWS/{self.region}] 實例 {instance.id} 啟動完成，IP: {public_ip}")

        return {
            "instance_id": instance.id,
            "public_ip":   public_ip,
            "region":      self.region,
            "provider":    "aws",
        }

    def terminate(self, instance_id: str) -> None:
        """終止（刪除）指定實例"""
        instance = self.ec2.Instance(instance_id)
        instance.terminate()
        logger.info(f"[AWS/{self.region}] 實例 {instance_id} 已終止")

    def list_managed_instances(self) -> list:
        """列出所有由本系統建立的實例"""
        response = self.ec2_client.describe_instances(
            Filters=[
                {"Name": "tag:ManagedBy", "Values": ["openclaw-provisioner"]},
                {"Name": "instance-state-name", "Values": ["running", "pending"]},
            ]
        )
        instances = []
        for reservation in response["Reservations"]:
            for inst in reservation["Instances"]:
                tags = {t["Key"]: t["Value"] for t in inst.get("Tags", [])}
                instances.append({
                    "instance_id":   inst["InstanceId"],
                    "public_ip":     inst.get("PublicIpAddress", "N/A"),
                    "state":         inst["State"]["Name"],
                    "instance_type": inst["InstanceType"],
                    "user_id":       tags.get("UserId", "unknown"),
                    "plan":          tags.get("Plan",   "unknown"),
                    "launched_at":   str(inst["LaunchTime"]),
                    "region":        self.region,
                })
        return instances

    # ──────────────────────────────────────────────────────────
    # 容量檢查（核心新功能）
    # ──────────────────────────────────────────────────────────

    def check_capacity(self, vcpus_needed: int) -> dict:
        """
        檢查當前 Region 的 vCPU 配額使用狀況。

        Returns dict：
            status          : "OK" | "WARNING" | "CRITICAL" | "BLOCKED" | "ERROR"
            vcpu_limit      : int   AWS 配額上限
            vcpu_used       : int   目前已使用
            vcpu_available  : int   可用剩餘
            vcpu_needed     : int   這次要開通需要的 vCPU
            usage_pct       : float 使用率（0~1）
            instances_remaining : int  以 vcpus_needed 計算，還能開幾台
            quota_source    : str   配額來源（"service_quotas" 或 "fallback"）
        """
        try:
            vcpu_limit, quota_source = self._get_vcpu_quota()
        except Exception as e:
            logger.warning(f"[AWS/{self.region}] 無法查詢 vCPU 配額：{e}，使用保守預設值 96")
            vcpu_limit   = 96
            quota_source = "fallback(96)"

        try:
            vcpu_used = self._count_running_vcpus()
        except Exception as e:
            logger.warning(f"[AWS/{self.region}] 無法計算已用 vCPU：{e}")
            vcpu_used = 0

        vcpu_available      = max(0, vcpu_limit - vcpu_used)
        instances_remaining = vcpu_available // vcpus_needed if vcpus_needed > 0 else 0
        usage_pct           = vcpu_used / vcpu_limit if vcpu_limit > 0 else 1.0

        if vcpus_needed > vcpu_available:
            status = "BLOCKED"
        elif usage_pct >= self.CRITICAL_THRESHOLD:
            status = "CRITICAL"
        elif usage_pct >= self.WARN_THRESHOLD:
            status = "WARNING"
        else:
            status = "OK"

        return {
            "status":               status,
            "vcpu_limit":           vcpu_limit,
            "vcpu_used":            vcpu_used,
            "vcpu_available":       vcpu_available,
            "vcpu_needed":          vcpus_needed,
            "usage_pct":            round(usage_pct, 4),
            "instances_remaining":  instances_remaining,
            "quota_source":         quota_source,
        }

    @classmethod
    def check_all_regions_capacity(
        cls,
        access_key: Optional[str],
        secret_key: Optional[str],
        vcpus_needed: int,
    ) -> list:
        """
        掃描所有主要 Region 的容量狀況，回傳排序後的清單。
        排序優先級：OK > WARNING > CRITICAL > BLOCKED > ERROR
        同狀態下以可用 vCPU 多的優先。

        Returns:
            list of dict（每個 dict 包含 check_capacity() 的欄位 + region / region_name）
        """
        results = []
        STATUS_ORDER = {"OK": 0, "WARNING": 1, "CRITICAL": 2, "BLOCKED": 3, "ERROR": 4}

        for region, config in cls.REGION_CONFIG.items():
            try:
                tmp = cls(access_key=access_key, secret_key=secret_key, region=region)
                cap = tmp.check_capacity(vcpus_needed)
            except Exception as e:
                cap = {
                    "status":              "ERROR",
                    "vcpu_limit":          0,
                    "vcpu_used":           0,
                    "vcpu_available":      0,
                    "vcpu_needed":         vcpus_needed,
                    "usage_pct":           1.0,
                    "instances_remaining": 0,
                    "quota_source":        "error",
                    "error":               str(e),
                }

            cap["region"]       = region
            cap["region_name"]  = config["name"]
            cap["target_users"] = config["target_users"]
            results.append(cap)

        results.sort(key=lambda x: (
            STATUS_ORDER.get(x["status"], 4),
            -x.get("vcpu_available", 0),
        ))
        return results

    # ──────────────────────────────────────────────────────────
    # 私有輔助方法
    # ──────────────────────────────────────────────────────────

    def _get_vcpu_quota(self) -> tuple[int, str]:
        """
        從 Service Quotas API 取得 Running On-Demand Standard instances vCPU 上限。
        回傳 (limit: int, source: str)
        """
        try:
            sq_client = self._session.client("service-quotas")
            resp  = sq_client.get_service_quota(
                ServiceCode="ec2",
                QuotaCode=self.VCPU_QUOTA_CODE,
            )
            limit = int(resp["Quota"]["Value"])
            return limit, "service_quotas"
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code in ("NoSuchResourceException", "AccessDeniedException"):
                # 嘗試取得預設配額（不需要 IAM 額外權限）
                sq_client = self._session.client("service-quotas")
                resp = sq_client.get_aws_default_service_quota(
                    ServiceCode="ec2",
                    QuotaCode=self.VCPU_QUOTA_CODE,
                )
                limit = int(resp["Quota"]["Value"])
                return limit, "service_quotas(default)"
            raise

    def _count_running_vcpus(self) -> int:
        """
        計算當前 Region 所有 running/pending 實例的 vCPU 總量。
        優先使用 VCPU_COUNT 查找表；查找表沒有的型號再呼叫 describe_instance_types。
        """
        response = self.ec2_client.describe_instances(
            Filters=[{"Name": "instance-state-name", "Values": ["running", "pending"]}]
        )
        type_counts: dict[str, int] = {}
        for reservation in response["Reservations"]:
            for inst in reservation["Instances"]:
                itype = inst["InstanceType"]
                type_counts[itype] = type_counts.get(itype, 0) + 1

        if not type_counts:
            return 0

        # 區分已知 / 未知型號
        known   = {t: c for t, c in type_counts.items() if t in self.VCPU_COUNT}
        unknown = [t for t in type_counts if t not in self.VCPU_COUNT]

        vcpu_map: dict[str, int] = {t: self.VCPU_COUNT[t] for t in known}

        # 未知型號動態查詢（批次，最多 100 個）
        if unknown:
            for i in range(0, len(unknown), 100):
                batch = unknown[i:i + 100]
                try:
                    resp = self.ec2_client.describe_instance_types(InstanceTypes=batch)
                    for it in resp["InstanceTypes"]:
                        vcpu_map[it["InstanceType"]] = it["VCpuInfo"]["DefaultVCpus"]
                except ClientError:
                    # 查不到就保守估計 2 vCPU
                    for t in batch:
                        vcpu_map[t] = 2

        total = sum(vcpu_map.get(t, 2) * cnt for t, cnt in type_counts.items())
        return total

    def _ensure_security_group(self) -> str:
        """取得或建立 openclaw-sg Security Group"""
        sg_name = "openclaw-sg"
        try:
            response = self.ec2_client.describe_security_groups(
                Filters=[{"Name": "group-name", "Values": [sg_name]}]
            )
            if response["SecurityGroups"]:
                sg_id = response["SecurityGroups"][0]["GroupId"]
                logger.debug(f"[AWS/{self.region}] 使用既有 Security Group: {sg_id}")
                return sg_id
        except ClientError:
            pass

        sg = self.ec2_client.create_security_group(
            GroupName=sg_name,
            Description="OpenClaw 自動化管理 Security Group",
        )
        sg_id = sg["GroupId"]

        # 開放 SSH (22) 與 OpenClaw Gateway (18789，官方預設 Port)
        self.ec2_client.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=[
                {
                    "IpProtocol": "tcp",
                    "FromPort": 22,
                    "ToPort": 22,
                    "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "SSH"}],
                },
                {
                    "IpProtocol": "tcp",
                    "FromPort": 18789,
                    "ToPort": 18789,
                    "IpRanges": [
                        {"CidrIp": "0.0.0.0/0", "Description": "OpenClaw Gateway (official default)"}
                    ],
                },
            ],
        )
        logger.info(f"[AWS/{self.region}] 已建立 Security Group: {sg_id}")
        return sg_id

    def _get_ubuntu_ami(self) -> str:
        """取得當前 region 的 Ubuntu 22.04 AMI，優先用預設表；找不到時動態查詢"""
        if self.region in self.UBUNTU_AMI:
            return self.UBUNTU_AMI[self.region]

        # 動態查詢最新 Ubuntu 22.04 AMI
        response = self.ec2_client.describe_images(
            Filters=[
                {"Name": "name", "Values": ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]},
                {"Name": "state", "Values": ["available"]},
            ],
            Owners=["099720109477"],  # Canonical 官方
        )
        images = sorted(response["Images"], key=lambda x: x["CreationDate"], reverse=True)
        if not images:
            raise RuntimeError(f"找不到 region {self.region} 的 Ubuntu 22.04 AMI")
        ami_id = images[0]["ImageId"]
        logger.info(f"[AWS/{self.region}] 動態取得 AMI: {ami_id}")
        return ami_id
