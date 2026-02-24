"""
龍蝦雲 方案設定檔 (AWS 五大方案)
─────────────────────────────────────────────────────────────────
差異化邏輯：
  方案等級越高 → 更大的伺服器 → 可同時跑更多 OpenClaw Bot 實例
  每個 Bot 實例佔用記憶體約 300~400MB，因此 RAM 決定了上限

  實例數量與 RAM 對應關係：
    t3.micro   1GB  → 最多  1 個 Bot
    t3.small   2GB  → 最多  3 個 Bot
    t3.medium  4GB  → 最多  8 個 Bot
    t3.large   8GB  → 最多 18 個 Bot
    t3.xlarge 16GB  → 最多 40 個 Bot（無限制模式）

  定價基準（AWS 東京 ap-northeast-1，On-Demand Linux，2024 Q1）：
    t3.micro   $0.0116/hr ≈  $8.4/月
    t3.small   $0.0232/hr ≈ $16.7/月
    t3.medium  $0.0464/hr ≈ $33.4/月
    t3.large   $0.0928/hr ≈ $66.8/月
    t3.xlarge  $0.1856/hr ≈ $133.6/月
    EBS gp3：$0.08/GB/月
─────────────────────────────────────────────────────────────────
"""

from dataclasses import dataclass
from typing import Dict


@dataclass
class PlanSpec:
    # ── 基本資訊 ────────────────────────────────────────────────
    plan_id: str
    name: str
    price_usd: float          # 對外售價（月費 USD）
    aws_cost_est: float       # 預估 AWS 成本（月）
    description: str
    use_case: str             # 目標客群

    # ── AWS 伺服器規格 ───────────────────────────────────────────
    aws_instance_type: str    # EC2 instance type
    aws_vcpu: int
    aws_ram_gb: int
    disk_gb: int

    # ── GCP 備援規格 ─────────────────────────────────────────────
    gcp_machine_type: str

    # ── OpenClaw Bot 功能上限（由伺服器 RAM 決定）───────────────
    max_bot_instances: int    # 可同時運行的 Bot 數（-1 = 無限制）
    max_concurrent_users: int # 每個 Bot 同時可接待的用戶數
    context_window_k: int     # 每個 Bot 的上下文記憶容量（K tokens）
    platforms_limit: int      # 可串接的通訊平台數（-1 = 無限制）

    # ── 計算屬性 ────────────────────────────────────────────────
    @property
    def margin_pct(self) -> float:
        return round((self.price_usd - self.aws_cost_est) / self.price_usd * 100, 1)

    @property
    def monthly_profit(self) -> float:
        return round(self.price_usd - self.aws_cost_est, 2)

    @property
    def openclaw_max_tokens(self) -> int:
        """Cloud-Init 腳本使用，轉換 K → 整數"""
        return self.context_window_k * 1024

    @property
    def bots_display(self) -> str:
        return "無限制" if self.max_bot_instances == -1 else str(self.max_bot_instances)

    @property
    def users_display(self) -> str:
        return "無限制" if self.max_concurrent_users == -1 else str(self.max_concurrent_users)

    @property
    def platforms_display(self) -> str:
        return "無限制" if self.platforms_limit == -1 else str(self.platforms_limit)


# ──────────────────────────────────────────────────────────────
# 五大方案
# ──────────────────────────────────────────────────────────────

PLANS: Dict[str, PlanSpec] = {

    # ── 1. Starter：單機單Bot，試水溫 ────────────────────────────
    "starter": PlanSpec(
        plan_id="starter",
        name="Starter",
        price_usd=19.9,
        aws_cost_est=9.95,        # t3.micro($8.35) + 20GB SSD($1.60)
        description="入門版 · 單一 Bot · 個人試用",
        use_case="想先試試看、學生、副業測試",

        aws_instance_type="t3.micro",
        aws_vcpu=2,
        aws_ram_gb=1,
        disk_gb=20,
        gcp_machine_type="e2-micro",

        max_bot_instances=1,
        max_concurrent_users=5,
        context_window_k=8,
        platforms_limit=1,
    ),

    # ── 2. Basic：雙Bot，日常個人 ─────────────────────────────────
    "basic": PlanSpec(
        plan_id="basic",
        name="Basic",
        price_usd=35.9,
        aws_cost_est=19.10,       # t3.small($16.70) + 30GB SSD($2.40)
        description="基礎版 · 雙 Bot · 日常個人使用",
        use_case="每天使用 AI 助理、同時跑 Telegram + LINE 兩個 Bot",

        aws_instance_type="t3.small",
        aws_vcpu=2,
        aws_ram_gb=2,
        disk_gb=30,
        gcp_machine_type="e2-small",

        max_bot_instances=3,
        max_concurrent_users=15,
        context_window_k=16,
        platforms_limit=2,
    ),

    # ── 3. Pro：多Bot，重度用戶 ────────────────────────────────────
    "pro": PlanSpec(
        plan_id="pro",
        name="Pro",
        price_usd=69.9,
        aws_cost_est=37.41,       # t3.medium($33.41) + 50GB SSD($4.00)
        description="專業版 · 多 Bot · 工作流程整合",
        use_case="自由工作者、多場景 AI 助理、需要 3 個以上通訊管道同時運作",

        aws_instance_type="t3.medium",
        aws_vcpu=2,
        aws_ram_gb=4,
        disk_gb=50,
        gcp_machine_type="e2-medium",

        max_bot_instances=8,
        max_concurrent_users=40,
        context_window_k=32,
        platforms_limit=3,
    ),

    # ── 4. Business：高並發，小型團隊 ─────────────────────────────
    "business": PlanSpec(
        plan_id="business",
        name="Business",
        price_usd=129.9,
        aws_cost_est=73.22,       # t3.large($66.82) + 80GB SSD($6.40)
        description="商業版 · 高並發 Bot · 小型團隊 / 客服自動化",
        use_case="3~10 人小團隊、多客服 Bot 並行、電商 / 客服自動化場景",

        aws_instance_type="t3.large",
        aws_vcpu=2,
        aws_ram_gb=8,
        disk_gb=80,
        gcp_machine_type="e2-standard-2",

        max_bot_instances=18,
        max_concurrent_users=100,
        context_window_k=64,
        platforms_limit=5,
    ),

    # ── 5. Enterprise：無限制，旗艦 ───────────────────────────────
    "enterprise": PlanSpec(
        plan_id="enterprise",
        name="Enterprise",
        price_usd=249.9,
        aws_cost_est=141.63,      # t3.xlarge($133.63) + 100GB SSD($8.00)
        description="旗艦版 · 無限 Bot · 企業級高流量",
        use_case="中大型企業、高流量 AI 服務、需要最大資源與無限制功能",

        aws_instance_type="t3.xlarge",
        aws_vcpu=4,
        aws_ram_gb=16,
        disk_gb=100,
        gcp_machine_type="e2-standard-4",

        max_bot_instances=-1,       # 無限制
        max_concurrent_users=-1,    # 無限制
        context_window_k=128,
        platforms_limit=-1,         # 無限制
    ),
}


def get_plan(plan_id: str) -> PlanSpec:
    plan_id = plan_id.lower()
    if plan_id not in PLANS:
        available = ", ".join(PLANS.keys())
        raise ValueError(f"未知方案 '{plan_id}'，可選方案：{available}")
    return PLANS[plan_id]


def print_plans_table() -> None:
    """在終端機印出所有方案比較表"""
    divider = "─" * 82
    print(f"\n{divider}")
    print(f"  {'龍蝦雲 五大方案一覽':^78}")
    print(divider)
    print(f"  {'方案':<12} {'售價/月':>8}  {'AWS成本':>8}  {'毛利率':>6}  {'規格':<18}  {'目標客群'}")
    print(divider)
    for plan in PLANS.values():
        spec = f"{plan.aws_vcpu}C{plan.aws_ram_gb}G/{plan.disk_gb}GB"
        print(
            f"  {plan.name:<12} ${plan.price_usd:>6.1f}   ${plan.aws_cost_est:>6.2f}   "
            f"{plan.margin_pct:>5.1f}%  {spec:<18}  {plan.use_case[:28]}"
        )
    print(divider)

    print(f"\n  {'OpenClaw Bot 功能對照':^78}")
    print(divider)
    print(f"  {'方案':<12} {'Bot 數量':>10}  {'同時用戶':>10}  {'記憶上下文':>12}  {'通訊平台數'}")
    print(divider)
    for plan in PLANS.values():
        print(
            f"  {plan.name:<12} {plan.bots_display:>10}  {plan.users_display:>10}  "
            f"{plan.context_window_k}K tokens{'':<4}  {plan.platforms_display}"
        )
    print(divider)
    print()
