"""
龍蝦雲 方案設定檔
定義每個方案對應的雲端規格與售價
"""

from dataclasses import dataclass
from typing import Dict


@dataclass
class PlanSpec:
    name: str
    price_usd: float
    description: str
    # AWS
    aws_instance_type: str
    # GCP
    gcp_machine_type: str
    # 共用
    disk_gb: int
    openclaw_max_tokens: int   # 傳入 openclaw.json 的限制


PLANS: Dict[str, PlanSpec] = {
    "basic": PlanSpec(
        name="Basic",
        price_usd=9.9,
        description="輕量版 · 個人使用",
        aws_instance_type="t3.micro",    # 2 vCPU, 1 GB RAM
        gcp_machine_type="e2-micro",     # 0.25 vCPU, 1 GB RAM
        disk_gb=20,
        openclaw_max_tokens=4096,
    ),
    "pro": PlanSpec(
        name="Pro",
        price_usd=19.9,
        description="專業版 · 多任務處理",
        aws_instance_type="t3.small",    # 2 vCPU, 2 GB RAM
        gcp_machine_type="e2-small",     # 2 vCPU, 2 GB RAM
        disk_gb=40,
        openclaw_max_tokens=16384,
    ),
    "enterprise": PlanSpec(
        name="Enterprise",
        price_usd=49.9,
        description="旗艦版 · 高流量企業",
        aws_instance_type="t3.medium",   # 2 vCPU, 4 GB RAM
        gcp_machine_type="e2-medium",    # 2 vCPU, 4 GB RAM
        disk_gb=80,
        openclaw_max_tokens=65536,
    ),
}


def get_plan(plan_id: str) -> PlanSpec:
    plan_id = plan_id.lower()
    if plan_id not in PLANS:
        raise ValueError(
            f"Unknown plan '{plan_id}'. Available: {', '.join(PLANS.keys())}"
        )
    return PLANS[plan_id]
