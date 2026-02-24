"""
AWS EC2 Provider
自動在 AWS 開啟指定規格的 EC2 實例並部署 OpenClaw
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

    # Ubuntu 22.04 LTS AMI（各 region 不同，此處為常用 region 的 AMI ID）
    UBUNTU_AMI = {
        "ap-northeast-1": "ami-0d52744d6551d851e",   # 東京
        "ap-southeast-1": "ami-0df7a207adb9748c7",   # 新加坡
        "us-east-1":      "ami-0c7217cdde317cfec",   # 美東
        "us-west-2":      "ami-0efcece6bed30fd98",   # 美西
        "eu-central-1":   "ami-0faab6bdbac9486fb",   # 法蘭克福
    }

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
        # 1. 取得（或建立）Security Group
        sg_id = self._ensure_security_group()

        # 2. 取得 AMI
        ami_id = self._get_ubuntu_ami()

        # 3. 建立實例
        logger.info(f"[AWS] 正在建立 {instance_type} 實例 (user={user_id}, plan={plan_name})")
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
                        {"Key": "Name", "Value": f"openclaw-{user_id}"},
                        {"Key": "ManagedBy", "Value": "openclaw-provisioner"},
                        {"Key": "UserId", "Value": user_id},
                        {"Key": "Plan", "Value": plan_name},
                    ],
                }
            ],
            **({"KeyName": key_name} if key_name else {}),
        )

        instance = instances[0]
        logger.info(f"[AWS] 實例已建立: {instance.id}，等待啟動...")

        # 4. 等待進入 running 狀態（最多 3 分鐘）
        instance.wait_until_running()
        instance.reload()

        public_ip = instance.public_ip_address
        logger.info(f"[AWS] 實例 {instance.id} 啟動完成，IP: {public_ip}")

        return {
            "instance_id": instance.id,
            "public_ip": public_ip,
            "region": self.region,
            "provider": "aws",
        }

    def terminate(self, instance_id: str) -> None:
        """終止（刪除）指定實例"""
        instance = self.ec2.Instance(instance_id)
        instance.terminate()
        logger.info(f"[AWS] 實例 {instance_id} 已終止")

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
                    "instance_id": inst["InstanceId"],
                    "public_ip": inst.get("PublicIpAddress", "N/A"),
                    "state": inst["State"]["Name"],
                    "instance_type": inst["InstanceType"],
                    "user_id": tags.get("UserId", "unknown"),
                    "plan": tags.get("Plan", "unknown"),
                    "launched_at": str(inst["LaunchTime"]),
                })
        return instances

    # ──────────────────────────────────────────────────────────
    # 私有輔助方法
    # ──────────────────────────────────────────────────────────

    def _ensure_security_group(self) -> str:
        """取得或建立 openclaw-sg Security Group"""
        sg_name = "openclaw-sg"
        try:
            response = self.ec2_client.describe_security_groups(
                Filters=[{"Name": "group-name", "Values": [sg_name]}]
            )
            if response["SecurityGroups"]:
                sg_id = response["SecurityGroups"][0]["GroupId"]
                logger.debug(f"[AWS] 使用既有 Security Group: {sg_id}")
                return sg_id
        except ClientError:
            pass

        # 建立新的 SG
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
        logger.info(f"[AWS] 已建立 Security Group: {sg_id}")
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
                {"Name": "owner-alias", "Values": ["aws-marketplace"]},
            ],
            Owners=["099720109477"],  # Canonical
        )
        images = sorted(response["Images"], key=lambda x: x["CreationDate"], reverse=True)
        if not images:
            raise RuntimeError(f"找不到 region {self.region} 的 Ubuntu 22.04 AMI")
        ami_id = images[0]["ImageId"]
        logger.info(f"[AWS] 動態取得 AMI: {ami_id}")
        return ami_id
