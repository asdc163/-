"""
龍蝦雲 方案設定檔 (AWS 五大方案)
─────────────────────────────────────────────────────────────────
OpenClaw 硬體需求（官方文件）：
  最低配備：2 GB RAM（1GB 體驗極差，不應提供）
  建議配備：8~16 GB RAM（大多數日常用戶）
  Node.js：>= 22（必須，22 以下無法啟動）
  每個 openclaw process 約佔用 300~500 MB RAM

方案差異化邏輯：
  伺服器 RAM 決定可同時運行的 Bot 數量與服務品質
  每方案對用戶而言是獨立的專屬 VPS，完全隔離

定價基準（AWS 東京 ap-northeast-1，On-Demand Linux 2024）：
  t3.small   2vCPU  2GB  $0.0232/hr ≈ $16.7/月
  t3.medium  2vCPU  4GB  $0.0464/hr ≈ $33.4/月
  t3.large   2vCPU  8GB  $0.0928/hr ≈ $66.8/月
  t3.xlarge  4vCPU 16GB  $0.1856/hr ≈ $133.6/月
  t3.2xlarge 8vCPU 32GB  $0.3712/hr ≈ $271.0/月
  EBS gp3：$0.08/GB/月

目標毛利率：≥ 20%（含 AWS 偶發費用緩衝，建議設計在 25~35%）
─────────────────────────────────────────────────────────────────
"""

from dataclasses import dataclass
from typing import Dict


@dataclass
class PlanSpec:
    # ── 基本資訊 ─────────────────────────────────────────────────
    plan_id: str
    name: str
    price_usd: float          # 對外月費（USD）
    aws_cost_est: float       # 預估 AWS 成本（月）
    description: str
    use_case: str

    # ── AWS 規格 ─────────────────────────────────────────────────
    aws_instance_type: str
    aws_vcpu: int
    aws_ram_gb: int
    disk_gb: int

    # ── GCP 備援 ─────────────────────────────────────────────────
    gcp_machine_type: str

    # ── OpenClaw 功能上限（由 RAM 決定）─────────────────────────
    # openclaw 官方推薦每 instance 約 300~500 MB
    # 扣除 OS 系統佔用（~500MB），剩餘 RAM 才能給 openclaw
    max_bot_instances: int    # -1 = 無限制
    max_concurrent_users: int
    context_window_k: int     # 上下文記憶（K tokens）
    platforms_limit: int      # 可串接通訊平台數，-1 = 無限制

    # ── 計算屬性 ─────────────────────────────────────────────────
    @property
    def margin_pct(self) -> float:
        return round((self.price_usd - self.aws_cost_est) / self.price_usd * 100, 1)

    @property
    def monthly_profit(self) -> float:
        return round(self.price_usd - self.aws_cost_est, 2)

    @property
    def openclaw_max_tokens(self) -> int:
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
# 注意：最低從 t3.small (2GB) 開始，1GB 體驗極差不提供
# ──────────────────────────────────────────────────────────────

PLANS: Dict[str, PlanSpec] = {

    # ── 1. Starter：最省，功能可用但緊湊 ──────────────────────────
    # RAM 2GB：扣除 OS(~500MB)，openclaw 可用約 1.5GB
    # 只夠跑 1 個 bot，上下文較小，適合個人試用
    "starter": PlanSpec(
        plan_id="starter",
        name="Starter",
        price_usd=24.9,
        aws_cost_est=19.10,    # t3.small($16.70) + 30GB SSD($2.40)
        description="入門版 · 2GB RAM · 單 Bot · 個人試用",
        use_case="初次體驗、學生、副業測試、預算有限",

        aws_instance_type="t3.small",   # 2 vCPU, 2 GB RAM（最低可用門檻）
        aws_vcpu=2,
        aws_ram_gb=2,
        disk_gb=30,
        gcp_machine_type="e2-small",

        max_bot_instances=1,
        max_concurrent_users=5,
        context_window_k=16,
        platforms_limit=1,
        # 毛利率：(24.9 - 19.10) / 24.9 = 23.3% ✓
    ),

    # ── 2. Standard：日常主力，體驗良好 ────────────────────────────
    # RAM 4GB：openclaw 可用約 3.5GB，3 個 bot 流暢運行
    "standard": PlanSpec(
        plan_id="standard",
        name="Standard",
        price_usd=49.9,
        aws_cost_est=37.41,    # t3.medium($33.41) + 50GB SSD($4.00)
        description="標準版 · 4GB RAM · 多 Bot · 日常流暢使用",
        use_case="每天使用 AI、同時跑 Telegram + LINE 兩個 Bot",

        aws_instance_type="t3.medium",  # 2 vCPU, 4 GB RAM
        aws_vcpu=2,
        aws_ram_gb=4,
        disk_gb=50,
        gcp_machine_type="e2-medium",

        max_bot_instances=3,
        max_concurrent_users=15,
        context_window_k=32,
        platforms_limit=2,
        # 毛利率：(49.9 - 37.41) / 49.9 = 25.0% ✓
    ),

    # ── 3. Pro：官方建議等級，重度用戶首選 ────────────────────────
    # RAM 8GB：openclaw 官方「建議配備」起點
    # 可流暢跑 8~10 個 bot，適合工作流整合
    "pro": PlanSpec(
        plan_id="pro",
        name="Pro",
        price_usd=99.9,
        aws_cost_est=73.22,    # t3.large($66.82) + 80GB SSD($6.40)
        description="專業版 · 8GB RAM · 官方建議等級 · 工作流整合",
        use_case="自由工作者、多渠道 AI 助理、工作流自動化",

        aws_instance_type="t3.large",   # 2 vCPU, 8 GB RAM（openclaw 建議起點）
        aws_vcpu=2,
        aws_ram_gb=8,
        disk_gb=80,
        gcp_machine_type="e2-standard-2",

        max_bot_instances=8,
        max_concurrent_users=40,
        context_window_k=64,
        platforms_limit=5,
        # 毛利率：(99.9 - 73.22) / 99.9 = 26.7% ✓
    ),

    # ── 4. Business：高性能，小型團隊 ─────────────────────────────
    # RAM 16GB：openclaw 官方「建議配備」上限，全速運行
    "business": PlanSpec(
        plan_id="business",
        name="Business",
        price_usd=189.9,
        aws_cost_est=141.63,   # t3.xlarge($133.63) + 100GB SSD($8.00)
        description="商業版 · 16GB RAM · 高性能 · 小型團隊",
        use_case="3~10 人小團隊、高頻客服機器人、電商自動化",

        aws_instance_type="t3.xlarge",  # 4 vCPU, 16 GB RAM
        aws_vcpu=4,
        aws_ram_gb=16,
        disk_gb=100,
        gcp_machine_type="e2-standard-4",

        max_bot_instances=18,
        max_concurrent_users=100,
        context_window_k=128,
        platforms_limit=10,
        # 毛利率：(189.9 - 141.63) / 189.9 = 25.4% ✓
    ),

    # ── 5. Enterprise：旗艦，無限制 ────────────────────────────────
    # RAM 32GB：超越 openclaw 建議，應付最高強度需求
    "enterprise": PlanSpec(
        plan_id="enterprise",
        name="Enterprise",
        price_usd=369.9,
        aws_cost_est=280.56,   # t3.2xlarge($270.96) + 120GB SSD($9.60)
        description="旗艦版 · 32GB RAM · 無限制 · 企業高流量",
        use_case="中大型企業、高流量 AI 服務、多部門自動化",

        aws_instance_type="t3.2xlarge", # 8 vCPU, 32 GB RAM
        aws_vcpu=8,
        aws_ram_gb=32,
        disk_gb=120,
        gcp_machine_type="e2-standard-8",

        max_bot_instances=-1,
        max_concurrent_users=-1,
        context_window_k=128,
        platforms_limit=-1,
        # 毛利率：(369.9 - 280.56) / 369.9 = 24.2% ✓
    ),
}


def get_plan(plan_id: str) -> PlanSpec:
    plan_id = plan_id.lower()
    if plan_id not in PLANS:
        available = ", ".join(PLANS.keys())
        raise ValueError(f"未知方案 '{plan_id}'，可選方案：{available}")
    return PLANS[plan_id]


def print_plans_table() -> None:
    divider = "─" * 88
    print(f"\n{divider}")
    print(f"  {'龍蝦雲 五大方案（OpenClaw 官方建議：8~16GB RAM）':^84}")
    print(divider)
    print(f"  {'方案':<12} {'售價/月':>8}  {'AWS成本':>8}  {'毛利率':>6}  {'規格':<20}  {'適用情境'}")
    print(divider)
    for plan in PLANS.values():
        spec = f"{plan.aws_vcpu}C{plan.aws_ram_gb}G/{plan.disk_gb}GB"
        note = " ← 官方建議" if plan.aws_ram_gb in (8, 16) else ""
        print(
            f"  {plan.name:<12} ${plan.price_usd:>6.1f}   ${plan.aws_cost_est:>7.2f}   "
            f"{plan.margin_pct:>5.1f}%  {spec:<20}  {plan.use_case[:22]}{note}"
        )
    print(divider)
    print(f"\n  {'OpenClaw Bot 功能對照':^84}")
    print(divider)
    print(f"  {'方案':<12} {'Bot 數量':>10}  {'同時用戶':>10}  {'記憶容量':>10}  {'通訊平台數'}")
    print(divider)
    for plan in PLANS.values():
        print(
            f"  {plan.name:<12} {plan.bots_display:>10}  {plan.users_display:>10}  "
            f"{plan.context_window_k}K tokens   {plan.platforms_display}"
        )
    print(divider)
    print()
