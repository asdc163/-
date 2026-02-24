#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║         龍蝦雲  自動化開戶與交付系統 v1.0                   ║
║         provision_cloud.py  ─  主控 CLI                     ║
╚══════════════════════════════════════════════════════════════╝

用法範例：

  # 顯示所有方案比較表
  python provision_cloud.py --plans

  # 開通 Starter 方案（最省）
  python provision_cloud.py --plan starter --user-id ORDER_001 \\
      --ai-provider openai --ai-api-key sk-xxx \\
      --platform telegram --contact @username

  # 開通 Pro 方案（重度用戶首選）
  python provision_cloud.py --plan pro --user-id ORDER_002 \\
      --ai-provider openai --ai-api-key sk-xxx \\
      --platform telegram --contact @username

  # 開通 Enterprise 方案（旗艦）
  python provision_cloud.py --plan enterprise --user-id ORDER_003 \\
      --ai-provider gemini --ai-api-key AIza... \\
      --platform line --contact +886912345678

  # 列出所有在線實例（含費用參考）
  python provision_cloud.py --list --provider aws

  # 停機指定實例（用戶不續約時使用）
  python provision_cloud.py --terminate i-0abc123 --provider aws
"""

import argparse
import json
import logging
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from config.plans import get_plan, print_plans_table, PLANS

# ──────────────────────────────────────────────────────────────
# 日誌設定
# ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("provision")

TEMPLATES_DIR = Path(__file__).parent / "templates"


# ──────────────────────────────────────────────────────────────
# Cloud-Init 模板渲染
# ──────────────────────────────────────────────────────────────

def render_cloud_init(
    user_id: str,
    plan: object,
    login_token: str,
    ai_provider: str,
    ai_api_key: str,
    platform: str,
    contact: str,
) -> str:
    """用 Jinja2 渲染 cloud_init.sh.j2，填入用戶參數與方案限制"""
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("cloud_init.sh.j2")
    return template.render(
        user_id=user_id,
        plan_name=plan.name,
        login_token=login_token,
        max_tokens=plan.openclaw_max_tokens,
        max_bot_instances=plan.max_bot_instances if plan.max_bot_instances != -1 else 9999,
        max_concurrent_users=plan.max_concurrent_users if plan.max_concurrent_users != -1 else 9999,
        ai_provider=ai_provider,
        ai_api_key=ai_api_key,
        platform=platform,
        contact=contact,
        provisioned_at=datetime.now(timezone.utc).isoformat(),
    )


# ──────────────────────────────────────────────────────────────
# Provider 工廠
# ──────────────────────────────────────────────────────────────

def get_provider(provider_name: str):
    """根據 --provider 參數回傳對應的 Provider 實例"""
    if provider_name == "aws":
        from providers.aws_provider import AWSProvider
        return AWSProvider(
            access_key=os.getenv("AWS_ACCESS_KEY_ID"),
            secret_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region=os.getenv("AWS_DEFAULT_REGION"),
        )
    elif provider_name == "gcp":
        from providers.gcp_provider import GCPProvider
        project_id = os.getenv("GCP_PROJECT_ID")
        if not project_id:
            logger.error("請設定環境變數 GCP_PROJECT_ID")
            sys.exit(1)
        return GCPProvider(
            project_id=project_id,
            zone=os.getenv("GCP_ZONE"),
            credentials_path=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
        )
    else:
        logger.error(f"不支援的 provider: {provider_name}，可選: aws, gcp")
        sys.exit(1)


# ──────────────────────────────────────────────────────────────
# 主要流程
# ──────────────────────────────────────────────────────────────

def cmd_provision(args) -> None:
    """執行開通流程"""
    plan = get_plan(args.plan)
    login_token = secrets.token_urlsafe(32)

    if args.provider == "aws":
        spec_info = f"{plan.aws_instance_type} ({plan.aws_vcpu}vCPU {plan.aws_ram_gb}GB RAM)"
    else:
        spec_info = f"{plan.gcp_machine_type} ({plan.aws_vcpu}vCPU {plan.aws_ram_gb}GB RAM)"

    print(f"""
┌──────────────────────────────────────────────────┐
│  龍蝦雲 開通請求
│  用戶 ID   : {args.user_id}
│  方案      : {plan.name}  (售價 ${plan.price_usd}/月)
│  說明      : {plan.description}
│  適用情境  : {plan.use_case}
│  雲端      : {args.provider.upper()}  ─  {spec_info}
│  硬碟      : {plan.disk_gb} GB SSD
├──────────────────────────────────────────────────┤
│  OpenClaw Bot 配置
│  Bot 數量  : {plan.bots_display} 個同時運行
│  同時用戶  : {plan.users_display} 人
│  記憶上下文: {plan.context_window_k}K tokens
│  通訊平台  : {plan.platforms_display} 個
├──────────────────────────────────────────────────┤
│  AI 平台   : {args.ai_provider.upper()}  ─  {args.platform.upper()} / {args.contact}
│  AWS 成本  : ~${plan.aws_cost_est}/月  ｜  毛利率: {plan.margin_pct}%  (+${plan.monthly_profit})
└──────────────────────────────────────────────────┘
""")

    # 1. 渲染 cloud-init 腳本
    logger.info("渲染 Cloud-Init 腳本...")
    provider_name = args.provider
    spec_desc = plan.aws_instance_type if provider_name == "aws" else plan.gcp_machine_type
    logger.info(
        f"規格: {spec_desc} | 硬碟: {plan.disk_gb}GB | "
        f"Bot: {plan.bots_display} | 上下文: {plan.context_window_k}K tokens"
    )

    cloud_init_script = render_cloud_init(
        user_id=args.user_id,
        plan=plan,
        login_token=login_token,
        ai_provider=args.ai_provider,
        ai_api_key=args.ai_api_key,
        platform=args.platform,
        contact=args.contact,
    )

    # 2. 取得 Provider 並開機
    provider = get_provider(provider_name)

    provision_kwargs = dict(
        user_data=cloud_init_script,
        user_id=args.user_id,
        plan_name=plan.name,
        disk_gb=plan.disk_gb,
    )

    if provider_name == "aws":
        provision_kwargs["instance_type"] = plan.aws_instance_type
        if args.key_name:
            provision_kwargs["key_name"] = args.key_name
    else:
        provision_kwargs["machine_type"] = plan.gcp_machine_type

    logger.info(f"開始在 {provider_name.upper()} 建立實例，請稍候...")
    result = provider.provision(**provision_kwargs)

    # 3. 輸出交付資訊
    delivery = {
        "user_id": args.user_id,
        "plan": plan.name,
        "plan_id": plan.plan_id,
        "price_usd": plan.price_usd,
        "provider": result["provider"],
        "public_ip": result["public_ip"],
        "instance_id": result["instance_id"],
        "openclaw_url": f"http://{result['public_ip']}:18789",
        "login_token": login_token,
        "platform": args.platform,
        "contact": args.contact,
        "max_bot_instances": plan.bots_display,
        "max_concurrent_users": plan.users_display,
        "context_window_k": plan.context_window_k,
        "platforms_limit": plan.platforms_display,
        "provisioned_at": datetime.now(timezone.utc).isoformat(),
        "note": "伺服器約需 60 秒完成 OpenClaw 安裝，請稍待後再連線",
    }

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║                  🦞 龍蝦雲 交付完成！                        ║
╠══════════════════════════════════════════════════════════════╣
║  用戶 ID     : {delivery['user_id']:<42}║
║  方案        : {delivery['plan']:<42}║
║  雲端提供商  : {delivery['provider'].upper():<42}║
║  實例 ID     : {delivery['instance_id']:<42}║
╠══════════════════════════════════════════════════════════════╣
║  🌐 連線地址 : {delivery['openclaw_url']:<42}║
║  🔑 登入密鑰 : {delivery['login_token'][:40]:<42}║
║                {delivery['login_token'][40:]:<42}║
╠══════════════════════════════════════════════════════════════╣
║  📱 通訊平台 : {delivery['platform'].upper():<42}║
║  📬 聯絡資訊 : {delivery['contact']:<42}║
╠══════════════════════════════════════════════════════════════╣
║  ⏳ {delivery['note']:<54}║
╚══════════════════════════════════════════════════════════════╝
""")

    # 4. 儲存交付記錄（JSON 格式，可供後續管理）
    log_dir = Path(__file__).parent / "delivery_logs"
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"{args.user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(delivery, f, ensure_ascii=False, indent=2)
    logger.info(f"交付記錄已儲存: {log_file}")


def cmd_list(args) -> None:
    """列出所有管理中的實例"""
    provider = get_provider(args.provider)
    instances = provider.list_managed_instances()

    if not instances:
        print(f"[{args.provider.upper()}] 目前沒有運行中的實例")
        return

    print(f"\n{'─'*70}")
    print(f"  {'USER ID':<15} {'INSTANCE ID':<22} {'IP':<16} {'PLAN':<12} {'STATE'}")
    print(f"{'─'*70}")
    for inst in instances:
        print(
            f"  {inst['user_id']:<15} {inst['instance_id']:<22} "
            f"{inst['public_ip']:<16} {inst['plan']:<12} {inst['state']}"
        )
    print(f"{'─'*70}")
    print(f"  共 {len(instances)} 個實例\n")


def cmd_terminate(args) -> None:
    """終止指定實例"""
    confirm = input(f"確定要終止實例 {args.terminate}？(輸入 yes 確認): ")
    if confirm.strip().lower() != "yes":
        print("已取消")
        return
    provider = get_provider(args.provider)
    provider.terminate(args.terminate)
    print(f"實例 {args.terminate} 已終止")


# ──────────────────────────────────────────────────────────────
# CLI 入口
# ──────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="龍蝦雲 自動化開戶與交付系統",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # 通用
    parser.add_argument(
        "--provider", choices=["aws", "gcp"], default="aws",
        help="雲端提供商 (預設: aws)"
    )

    # 開通方案
    provision_group = parser.add_argument_group("開通方案")
    provision_group.add_argument(
        "--plan",
        choices=["starter", "standard", "pro", "business", "enterprise"],
        help="方案等級 (starter/standard/pro/business/enterprise)"
    )
    provision_group.add_argument("--user-id", help="用戶唯一識別碼（訂單號/UID）")
    provision_group.add_argument("--ai-provider", choices=["openai", "gemini"],
                                 help="AI 平台")
    provision_group.add_argument("--ai-api-key", help="用戶的 AI API Key")
    provision_group.add_argument("--platform", choices=["telegram", "line", "email"],
                                 help="通訊平台")
    provision_group.add_argument("--contact", help="通訊聯絡資訊 (Telegram @handle / LINE ID / Email)")
    provision_group.add_argument("--key-name", help="[AWS only] EC2 Key Pair 名稱 (可選)")

    # 管理
    mgmt_group = parser.add_argument_group("實例管理")
    mgmt_group.add_argument("--list", action="store_true", help="列出所有運行中的實例")
    mgmt_group.add_argument("--terminate", metavar="INSTANCE_ID", help="終止（停機）指定實例")
    mgmt_group.add_argument("--plans", action="store_true", help="顯示所有方案比較表")

    return parser


def main():
    # 載入 .env（開發用）
    _load_dotenv()

    parser = build_parser()
    args = parser.parse_args()

    if args.plans:
        print_plans_table()
        return
    elif args.list:
        cmd_list(args)
    elif args.terminate:
        cmd_terminate(args)
    else:
        # 開通流程 — 檢查必填參數
        required = ["plan", "user_id", "ai_provider", "ai_api_key", "platform", "contact"]
        missing = [f"--{r.replace('_', '-')}" for r in required if not getattr(args, r, None)]
        if missing:
            parser.error(f"開通方案時以下參數為必填: {', '.join(missing)}")
        cmd_provision(args)


def _load_dotenv():
    """簡易 .env 載入（不依賴 python-dotenv）"""
    env_file = Path(__file__).parent / ".env"
    if not env_file.exists():
        return
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


if __name__ == "__main__":
    main()
