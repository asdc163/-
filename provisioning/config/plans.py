"""
龍蝦雲 方案設定檔 (AWS 五大方案)
─────────────────────────────────────────────────────────────────
定價邏輯（AWS 東京 ap-northeast-1，On-Demand Linux，2024 Q1）：

  EC2 費用：
    t3.micro   2vCPU  1GB  → $0.0116/hr ≈  $8.4/月
    t3.small   2vCPU  2GB  → $0.0232/hr ≈ $16.7/月
    t3.medium  2vCPU  4GB  → $0.0464/hr ≈ $33.4/月
    t3.large   2vCPU  8GB  → $0.0928/hr ≈ $66.8/月
    t3.xlarge  4vCPU 16GB  → $0.1856/hr ≈ $133.6/月

  EBS gp3 Storage：$0.08/GB/月

  目標毛利率：≥ 45%
─────────────────────────────────────────────────────────────────
"""

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class PlanSpec:
    # 基本資訊
    name: str
    plan_id: str
    price_usd: float          # 對外售價（月費）
    aws_cost_est: float       # 預估 AWS 成本（月）
    description: str
    use_case: str             # 目標客群描述

    # AWS 規格
    aws_instance_type: str    # EC2 instance type
    aws_vcpu: int
    aws_ram_gb: int
    disk_gb: int

    # GCP 備援規格（可選）
    gcp_machine_type: str

    # OpenClaw 功能限制
    openclaw_max_tokens: int          # 單次對話上下文
    max_concurrent_chats: int         # 同時進行中的對話數
    platforms_limit: int              # 可接的通訊平台數量（-1 = 無限）
    daily_backup: bool                # 每日 EBS Snapshot 備份
    priority_support: bool            # 優先技術支援

    # 計算欄位（自動）
    @property
    def margin_pct(self) -> float:
        """毛利率 %"""
        return round((self.price_usd - self.aws_cost_est) / self.price_usd * 100, 1)

    @property
    def monthly_profit(self) -> float:
        """每月純利（USD）"""
        return round(self.price_usd - self.aws_cost_est, 2)

    @property
    def platforms_display(self) -> str:
        return "無限制" if self.platforms_limit == -1 else str(self.platforms_limit)

    @property
    def concurrent_display(self) -> str:
        return "無限制" if self.max_concurrent_chats == -1 else str(self.max_concurrent_chats)


# ──────────────────────────────────────────────────────────────
# 五大方案定義
# ──────────────────────────────────────────────────────────────

PLANS: Dict[str, PlanSpec] = {

    # ── 1. Starter：試水溫，最省 ───────────────────────────────
    "starter": PlanSpec(
        plan_id="starter",
        name="Starter",
        price_usd=19.9,
        aws_cost_est=9.95,       # t3.micro($8.35) + 20GB($1.60)
        description="試用入門版 · 輕度個人使用",
        use_case="想先試試看的新用戶、學生、副業測試",

        aws_instance_type="t3.micro",   # 2 vCPU, 1 GB RAM
        aws_vcpu=2,
        aws_ram_gb=1,
        disk_gb=20,
        gcp_machine_type="e2-micro",

        openclaw_max_tokens=8192,
        max_concurrent_chats=1,
        platforms_limit=1,
        daily_backup=False,
        priority_support=False,
    ),

    # ── 2. Basic：日常使用 ─────────────────────────────────────
    "basic": PlanSpec(
        plan_id="basic",
        name="Basic",
        price_usd=35.9,
        aws_cost_est=19.10,      # t3.small($16.70) + 30GB($2.40)
        description="基礎版 · 日常個人使用",
        use_case="每天使用 AI 助理、需要 2 個通訊軟體同時串接",

        aws_instance_type="t3.small",   # 2 vCPU, 2 GB RAM
        aws_vcpu=2,
        aws_ram_gb=2,
        disk_gb=30,
        gcp_machine_type="e2-small",

        openclaw_max_tokens=16384,
        max_concurrent_chats=3,
        platforms_limit=2,
        daily_backup=False,
        priority_support=False,
    ),

    # ── 3. Pro：重度用戶首選 ───────────────────────────────────
    "pro": PlanSpec(
        plan_id="pro",
        name="Pro",
        price_usd=69.9,
        aws_cost_est=37.41,      # t3.medium($33.41) + 50GB($4.00)
        description="專業版 · 重度用戶 / 自由工作者",
        use_case="每天大量使用、工作流程整合、需要每日備份保障資料",

        aws_instance_type="t3.medium",  # 2 vCPU, 4 GB RAM
        aws_vcpu=2,
        aws_ram_gb=4,
        disk_gb=50,
        gcp_machine_type="e2-medium",

        openclaw_max_tokens=32768,
        max_concurrent_chats=10,
        platforms_limit=3,
        daily_backup=True,
        priority_support=False,
    ),

    # ── 4. Business：小型團隊 ──────────────────────────────────
    "business": PlanSpec(
        plan_id="business",
        name="Business",
        price_usd=129.9,
        aws_cost_est=73.22,      # t3.large($66.82) + 80GB($6.40)
        description="商業版 · 小型團隊 / 工作室",
        use_case="3~10 人小團隊、多任務並行、客服自動化、需要優先支援",

        aws_instance_type="t3.large",   # 2 vCPU, 8 GB RAM
        aws_vcpu=2,
        aws_ram_gb=8,
        disk_gb=80,
        gcp_machine_type="e2-standard-2",

        openclaw_max_tokens=65536,
        max_concurrent_chats=30,
        platforms_limit=5,
        daily_backup=True,
        priority_support=True,
    ),

    # ── 5. Enterprise：企業旗艦 ────────────────────────────────
    "enterprise": PlanSpec(
        plan_id="enterprise",
        name="Enterprise",
        price_usd=249.9,
        aws_cost_est=141.63,     # t3.xlarge($133.63) + 100GB($8.00)
        description="旗艦版 · 企業級 / 高流量",
        use_case="中大型企業、高流量 AI 服務、需要最大資源與無限制功能",

        aws_instance_type="t3.xlarge",  # 4 vCPU, 16 GB RAM
        aws_vcpu=4,
        aws_ram_gb=16,
        disk_gb=100,
        gcp_machine_type="e2-standard-4",

        openclaw_max_tokens=131072,
        max_concurrent_chats=-1,         # 無限制
        platforms_limit=-1,              # 無限制
        daily_backup=True,
        priority_support=True,
    ),
}


def get_plan(plan_id: str) -> PlanSpec:
    plan_id = plan_id.lower()
    if plan_id not in PLANS:
        available = ", ".join(PLANS.keys())
        raise ValueError(f"未知方案 '{plan_id}'，可選方案：{available}")
    return PLANS[plan_id]


def print_plans_table() -> None:
    """在終端機印出所有方案的比較表"""
    print("""
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                        龍蝦雲 五大方案一覽                                       ║
╠══════════╦═════════╦══════════╦═══════════╦════════════╦═══════════════════════╣
║  方案    ║  月費   ║  AWS成本 ║  毛利率   ║  規格      ║  目標客群             ║
╠══════════╬═════════╬══════════╬═══════════╬════════════╬═══════════════════════╣""")
    for plan in PLANS.values():
        spec = f"{plan.aws_vcpu}C{plan.aws_ram_gb}G/{plan.disk_gb}GB"
        print(
            f"║  {plan.name:<8}║ ${plan.price_usd:<7.1f}║ ${plan.aws_cost_est:<7.2f}║"
            f"  {plan.margin_pct:>4.1f}%   ║  {spec:<10}║  {plan.use_case[:21]:<21}║"
        )
    print("╚══════════╩═════════╩══════════╩═══════════╩════════════╩═══════════════════════╝")
    print()
    print("  功能對照：")
    print(f"  {'方案':<12} {'同時對話':<10} {'通訊平台':<10} {'每日備份':<10} {'優先支援':<10} {'上下文'}")
    print(f"  {'─'*68}")
    for plan in PLANS.values():
        print(
            f"  {plan.name:<12} {plan.concurrent_display:<10} {plan.platforms_display:<10}"
            f" {'✓' if plan.daily_backup else '✗':<10} {'✓' if plan.priority_support else '✗':<10}"
            f" {plan.openclaw_max_tokens // 1024}K tokens"
        )
    print()
