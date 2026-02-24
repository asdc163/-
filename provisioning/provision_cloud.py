#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║         龍蝦雲  自動化開戶與交付系統 v2.0                   ║
║         provision_cloud.py  ─  主控 CLI                     ║
╚══════════════════════════════════════════════════════════════╝

用法範例：

  # 顯示所有方案比較表
  python provision_cloud.py --plans

  # 查看所有 Region 容量狀況（開通前建議先看）
  python provision_cloud.py --capacity-check

  # 開通（自動選最佳 Region）
  python provision_cloud.py --plan starter --user-id ORDER_001 \\
      --ai-provider openai --ai-api-key sk-xxx \\
      --platform telegram --contact @username

  # 開通（指定 Region）
  python provision_cloud.py --plan pro --user-id ORDER_002 \\
      --region ap-east-1 \\
      --ai-provider openai --ai-api-key sk-xxx \\
      --platform telegram --contact @username

  # 列出所有在線實例
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
# AWS 容量檢查 + 區域自動選擇
# ──────────────────────────────────────────────────────────────

def _aws_select_region(
    access_key: str,
    secret_key: str,
    vcpus_needed: int,
    preferred_region: str = None,
) -> tuple:
    """
    掃描各 Region 容量，選出最合適的 Region。

    Returns:
        (selected_region: str, cap_info: dict, all_caps: list)

    若 preferred_region 指定：只檢查該 Region。
    否則：掃描全部主要 Region 並選最優。
    """
    from providers.aws_provider import AWSProvider

    if preferred_region:
        logger.info(f"[容量] 檢查指定 Region: {preferred_region}")
        tmp = AWSProvider(access_key=access_key, secret_key=secret_key, region=preferred_region)
        cap = tmp.check_capacity(vcpus_needed)
        region_name = AWSProvider.REGION_CONFIG.get(preferred_region, {}).get("name", preferred_region)
        cap["region"]      = preferred_region
        cap["region_name"] = region_name
        all_caps = [cap]
        selected = cap
    else:
        logger.info("[容量] 掃描全部 Region 容量...")
        all_caps = AWSProvider.check_all_regions_capacity(access_key, secret_key, vcpus_needed)
        viable = [c for c in all_caps if c["status"] not in ("BLOCKED", "ERROR")]
        selected = viable[0] if viable else all_caps[0]

    return selected["region"], selected, all_caps


def _print_capacity_report(all_caps: list, plan: object, selected_region: str) -> None:
    """
    印出容量掃描報告，標示選定的 Region 並顯示警告級別。
    """
    STATUS_ICON = {
        "OK":       "✅  正常",
        "WARNING":  "⚠️   偏高",
        "CRITICAL": "🔴 危險",
        "BLOCKED":  "🚫 封鎖",
        "ERROR":    "❌ 無法連線",
    }

    W = 68
    print()
    print("┌" + "─" * W + "┐")
    print(f"│  🌏 AWS 容量掃描  ─  需要 {plan.aws_vcpu} vCPU ({plan.aws_instance_type})" + " " * (W - 38 - len(plan.aws_instance_type)) + "│")
    print("├" + "─" * W + "┤")

    for cap in all_caps:
        region      = cap["region"]
        rname       = cap.get("region_name", region)
        status      = cap.get("status", "ERROR")
        icon        = STATUS_ICON.get(status, status)
        is_selected = (region == selected_region)

        # 第一行：Region 名稱 + 狀態 icon
        label = f"  {'→ ' if is_selected else '  '}{rname} ({region})"
        pad   = W - len(label) - len(icon) - 2
        print(f"│{label}{' ' * max(pad, 1)}{icon}  │")

        if status == "ERROR":
            err = cap.get("error", "未知錯誤")[:55]
            print(f"│    錯誤：{err:<{W-10}}│")
        else:
            vcpu_used  = cap.get("vcpu_used", 0)
            vcpu_limit = cap.get("vcpu_limit", 0)
            vcpu_avail = cap.get("vcpu_available", 0)
            remaining  = cap.get("instances_remaining", 0)
            pct        = cap.get("usage_pct", 0) * 100

            bar_len   = 30
            filled    = int(bar_len * pct / 100)
            bar       = "█" * filled + "░" * (bar_len - filled)

            line2 = f"    [{bar}] {pct:.0f}%  已用 {vcpu_used}/{vcpu_limit} vCPU"
            line3 = f"    剩餘可開：{remaining} 台 {plan.aws_instance_type}"
            print(f"│{line2:<{W}}│")
            print(f"│{line3:<{W}}│")

        if is_selected:
            note = "    ▲ 選定此 Region 開通"
            print(f"│{note:<{W}}│")

        print("├" + "─" * W + "┤")

    # 移除最後一條分隔線，換成底線
    print("\033[1A\033[K", end="")   # 刪除上一行
    print("└" + "─" * W + "┘")


def _print_capacity_warning(cap: dict, plan: object) -> None:
    """
    根據容量狀態印出對應的警告框（WARNING / CRITICAL / BLOCKED）。
    """
    status  = cap.get("status", "OK")
    region  = cap.get("region", "?")
    rname   = cap.get("region_name", region)
    vcpu_u  = cap.get("vcpu_used", 0)
    vcpu_l  = cap.get("vcpu_limit", 0)
    remain  = cap.get("instances_remaining", 0)
    pct     = cap.get("usage_pct", 0) * 100

    if status == "OK":
        return   # 正常，不需要印警告

    W = 66

    if status == "WARNING":
        print()
        print("┌" + "─" * W + "┐")
        print(f"│  ⚠️  警告：{rname} Region 容量偏高（{pct:.0f}%）" + " " * (W - 22 - len(rname) - len(f"{pct:.0f}")) + "│")
        print("├" + "─" * W + "┤")
        print(f"│  已用 vCPU：{vcpu_u} / {vcpu_l}（{pct:.0f}%）" + " " * (W - 16 - len(str(vcpu_u)) - len(str(vcpu_l)) - len(f"{pct:.0f}")) + "│")
        print(f"│  剩餘可開：約 {remain} 台 {plan.aws_instance_type}" + " " * (W - 14 - len(str(remain)) - len(plan.aws_instance_type)) + "│")
        print("├" + "─" * W + "┤")
        print(f"│  建議：前往 AWS Service Quotas 申請配額提升" + " " * (W - 26) + "│")
        print(f"│  路徑：console.aws.amazon.com/servicequotas" + " " * (W - 26) + "│")
        print(f"│  搜尋：Running On-Demand Standard instances" + " " * (W - 26) + "│")
        print("└" + "─" * W + "┘")
        print()

    elif status == "CRITICAL":
        print()
        print("╔" + "═" * W + "╗")
        print(f"║  🔴 緊急：{rname} Region 容量嚴重不足（{pct:.0f}%）" + " " * (W - 22 - len(rname) - len(f"{pct:.0f}")) + "║")
        print("╠" + "═" * W + "╣")
        print(f"║  已用 vCPU：{vcpu_u} / {vcpu_l}（{pct:.0f}%）" + " " * (W - 16 - len(str(vcpu_u)) - len(str(vcpu_l)) - len(f"{pct:.0f}")) + "║")
        print(f"║  剩餘僅剩：約 {remain} 台 {plan.aws_instance_type} 可開" + " " * (W - 17 - len(str(remain)) - len(plan.aws_instance_type)) + "║")
        print("╠" + "═" * W + "╣")
        print(f"║  立即採取行動（擇一）：" + " " * (W - 13) + "║")
        print(f"║  1. 申請配額提升（1~3 工作天）：" + " " * (W - 19) + "║")
        print(f"║     console.aws.amazon.com/servicequotas" + " " * (W - 43) + "║")
        print(f"║  2. 準備開通第二個 AWS 帳號（立即可用）" + " " * (W - 25) + "║")
        print("╚" + "═" * W + "╝")
        print()

    elif status == "BLOCKED":
        print()
        print("╔" + "═" * W + "╗")
        print(f"║  🚫 BLOCKED：{rname} Region 已無法容納新實例！" + " " * (W - 26 - len(rname)) + "║")
        print("╠" + "═" * W + "╣")
        print(f"║  已用 vCPU：{vcpu_u} / {vcpu_l}  ·  需要 {cap.get('vcpu_needed',0)} vCPU，但只剩 {cap.get('vcpu_available',0)}" + " " * max(0, W - 30 - len(str(vcpu_u)) - len(str(vcpu_l))) + "║")
        print("╠" + "═" * W + "╣")
        print(f"║  此 Region 已滿，無法開通！" + " " * (W - 16) + "║")
        print(f"║  請切換到其他 Region（--region 參數）" + " " * (W - 22) + "║")
        print(f"║  或參考下方「需要開通新 AWS 帳號」的說明" + " " * (W - 25) + "║")
        print("╚" + "═" * W + "╝")
        print()


def _print_all_blocked_warning(all_caps: list, plan: object) -> None:
    """
    所有 Region 都 BLOCKED 時，印出要開新 AWS 帳號的緊急說明。
    """
    W = 66
    print()
    print("╔" + "═" * W + "╗")
    print(f"║  🚨 緊急：所有 Region 均已達配額上限，無法繼續開通！" + " " * (W - 34) + "║")
    print("╠" + "═" * W + "╣")
    print(f"║  當前 Region 狀態：" + " " * (W - 12) + "║")
    for cap in all_caps:
        rname   = cap.get("region_name", cap["region"])
        vcpu_u  = cap.get("vcpu_used", 0)
        vcpu_l  = cap.get("vcpu_limit", 0)
        status  = cap.get("status", "?")
        icon    = "🚫" if status == "BLOCKED" else "❌"
        line    = f"  {icon} {rname}：已用 {vcpu_u}/{vcpu_l} vCPU"
        print(f"║{line:<{W}}║")
    print("╠" + "═" * W + "╣")
    print(f"║  必須採取行動（擇一）：" + " " * (W - 13) + "║")
    print(f"║" + " " * W + "║")
    print(f"║  【方案一】申請 AWS 配額提升（審核需 1~3 工作天）" + " " * (W - 32) + "║")
    print(f"║  前往：console.aws.amazon.com/servicequotas" + " " * (W - 26) + "║")
    print(f"║  搜尋：Running On-Demand Standard instances" + " " * (W - 26) + "║")
    print(f"║  建議申請值：目前上限 × 5 倍" + " " * (W - 18) + "║")
    print(f"║" + " " * W + "║")
    print(f"║  【方案二】開通第二個 AWS 帳號（立即可用）" + " " * (W - 27) + "║")
    print(f"║  1. 前往 aws.amazon.com 建立新帳號" + " " * (W - 22) + "║")
    print(f"║  2. 在新帳號建立 IAM 用戶，取得新的 Access Key" + " " * (W - 31) + "║")
    print(f"║  3. 更新 .env 中的 AWS_ACCESS_KEY_ID / SECRET" + " " * (W - 30) + "║")
    print(f"║  4. 重新執行開通指令" + " " * (W - 13) + "║")
    print(f"║" + " " * W + "║")
    print(f"║  ⚠️  請立即通知 Boss 暫停接受新訂單！" + " " * (W - 24) + "║")
    print("╚" + "═" * W + "╝")
    print()


# ──────────────────────────────────────────────────────────────
# Provider 工廠
# ──────────────────────────────────────────────────────────────

def get_provider(provider_name: str, region: str = None):
    """根據 --provider 參數回傳對應的 Provider 實例"""
    if provider_name == "aws":
        from providers.aws_provider import AWSProvider
        return AWSProvider(
            access_key=os.getenv("AWS_ACCESS_KEY_ID"),
            secret_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region=region or os.getenv("AWS_DEFAULT_REGION"),
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
    """執行開通流程（含容量檢查 + 自動 Region 選擇）"""
    plan        = get_plan(args.plan)
    login_token = secrets.token_urlsafe(32)

    # ── 步驟 1：AWS 容量檢查 + 自動選最佳 Region ───────────────
    if args.provider == "aws":
        access_key = os.getenv("AWS_ACCESS_KEY_ID")
        secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

        preferred_region = getattr(args, "region", None) or os.getenv("AWS_DEFAULT_REGION")

        selected_region, cap_info, all_caps = _aws_select_region(
            access_key=access_key,
            secret_key=secret_key,
            vcpus_needed=plan.aws_vcpu,
            preferred_region=preferred_region,
        )

        # 印出容量掃描結果（多 Region 概覽）
        _print_capacity_report(all_caps, plan, selected_region)

        # 如果所有 Region 都 BLOCKED → 必須開新帳號，終止
        if all(c.get("status") in ("BLOCKED", "ERROR") for c in all_caps):
            _print_all_blocked_warning(all_caps, plan)
            sys.exit(1)

        # 印出選定 Region 的詳細警告
        _print_capacity_warning(cap_info, plan)

        if cap_info["status"] == "BLOCKED":
            # 選定的 Region 被封鎖，但可能其他 Region 沒有（只有在 preferred_region 指定且滿了才會到這）
            logger.error(f"指定的 Region {selected_region} 容量不足，請移除 --region 讓系統自動選擇，或改用其他 Region")
            sys.exit(1)

        if cap_info["status"] == "CRITICAL":
            confirm = input("容量嚴重不足，確定繼續開通？（輸入 yes 繼續，其他鍵退出）: ")
            if confirm.strip().lower() != "yes":
                print("已取消。建議先申請配額提升再繼續。")
                sys.exit(0)

        spec_info = f"{plan.aws_instance_type} ({plan.aws_vcpu}vCPU {plan.aws_ram_gb}GB RAM)"
    else:
        selected_region = None
        spec_info = f"{plan.gcp_machine_type} ({plan.aws_vcpu}vCPU {plan.aws_ram_gb}GB RAM)"

    # ── 步驟 2：印出開通摘要 ────────────────────────────────────
    region_display = f"{selected_region}" if selected_region else "GCP"
    print(f"""
┌──────────────────────────────────────────────────┐
│  龍蝦雲 開通請求
│  用戶 ID   : {args.user_id}
│  方案      : {plan.name}  (售價 ${plan.price_usd}/月)
│  說明      : {plan.description}
│  適用情境  : {plan.use_case}
│  雲端      : {args.provider.upper()} {region_display}  ─  {spec_info}
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

    # ── 步驟 3：渲染 cloud-init 腳本 ────────────────────────────
    logger.info("渲染 Cloud-Init 腳本...")
    cloud_init_script = render_cloud_init(
        user_id=args.user_id,
        plan=plan,
        login_token=login_token,
        ai_provider=args.ai_provider,
        ai_api_key=args.ai_api_key,
        platform=args.platform,
        contact=args.contact,
    )

    # ── 步驟 4：建立實例 ─────────────────────────────────────────
    provider = get_provider(args.provider, region=selected_region)

    provision_kwargs = dict(
        user_data=cloud_init_script,
        user_id=args.user_id,
        plan_name=plan.name,
        disk_gb=plan.disk_gb,
    )

    if args.provider == "aws":
        provision_kwargs["instance_type"] = plan.aws_instance_type
        if args.key_name:
            provision_kwargs["key_name"] = args.key_name
    else:
        provision_kwargs["machine_type"] = plan.gcp_machine_type

    logger.info(f"開始在 {args.provider.upper()} 建立實例，請稍候...")
    result = provider.provision(**provision_kwargs)

    # ── 步驟 5：輸出交付資訊 ─────────────────────────────────────
    delivery = {
        "user_id":              args.user_id,
        "plan":                 plan.name,
        "plan_id":              plan.plan_id,
        "price_usd":            plan.price_usd,
        "provider":             result["provider"],
        "region":               result["region"],
        "public_ip":            result["public_ip"],
        "instance_id":          result["instance_id"],
        "openclaw_url":         f"http://{result['public_ip']}:18789",
        "login_token":          login_token,
        "platform":             args.platform,
        "contact":              args.contact,
        "max_bot_instances":    plan.bots_display,
        "max_concurrent_users": plan.users_display,
        "context_window_k":     plan.context_window_k,
        "platforms_limit":      plan.platforms_display,
        "provisioned_at":       datetime.now(timezone.utc).isoformat(),
        "note":                 "伺服器約需 60 秒完成 OpenClaw 安裝，請稍待後再連線",
    }

    print(f"""
╔══════════════════════════════════════════════════════════════╗
║              龍蝦雲 交付完成！                               ║
╠══════════════════════════════════════════════════════════════╣
║  用戶 ID     : {delivery['user_id']:<42}║
║  方案        : {delivery['plan']:<42}║
║  雲端 Region : {delivery['region']:<42}║
║  實例 ID     : {delivery['instance_id']:<42}║
╠══════════════════════════════════════════════════════════════╣
║  連線地址    : {delivery['openclaw_url']:<42}║
║  登入密鑰    : {delivery['login_token'][:40]:<42}║
║                {delivery['login_token'][40:]:<42}║
╠══════════════════════════════════════════════════════════════╣
║  通訊平台    : {delivery['platform'].upper():<42}║
║  聯絡資訊    : {delivery['contact']:<42}║
╠══════════════════════════════════════════════════════════════╣
║  {delivery['note']:<60}║
╚══════════════════════════════════════════════════════════════╝
""")

    # ── 步驟 6：儲存交付記錄 ────────────────────────────────────
    log_dir  = Path(__file__).parent / "delivery_logs"
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"{args.user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(delivery, f, ensure_ascii=False, indent=2)
    logger.info(f"交付記錄已儲存: {log_file}")


def cmd_capacity_check(args) -> None:
    """掃描所有 Region 容量並輸出報告（不開通實例）"""
    from providers.aws_provider import AWSProvider

    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

    # 如果指定了方案，就用那個方案的 vCPU；否則顯示 t3.small (2 vCPU) 的情況
    if getattr(args, "plan", None):
        plan = get_plan(args.plan)
        vcpus = plan.aws_vcpu
        label = f"{plan.name} ({plan.aws_instance_type}, {vcpus} vCPU)"
    else:
        vcpus = 2
        label = "t3.small (2 vCPU, Starter 方案)"

    print(f"\n  掃描各 Region 容量，基準方案：{label}")
    print("  請稍候...\n")

    all_caps = AWSProvider.check_all_regions_capacity(access_key, secret_key, vcpus)

    STATUS_ICON = {
        "OK":       "✅  正常",
        "WARNING":  "⚠️   偏高",
        "CRITICAL": "🔴 危險",
        "BLOCKED":  "🚫 封鎖",
        "ERROR":    "❌ 錯誤",
    }

    W = 68
    print("┌" + "─" * W + "┐")
    print(f"│  AWS 多 Region 容量報告{'':>{W-14}}│")
    print("├" + "─" * W + "┤")

    blocked_count = 0
    for cap in all_caps:
        region  = cap["region"]
        rname   = cap.get("region_name", region)
        status  = cap.get("status", "ERROR")
        icon    = STATUS_ICON.get(status, status)

        if status == "BLOCKED":
            blocked_count += 1

        label_text = f"  {rname} ({region})"
        pad = W - len(label_text) - len(icon) - 2
        print(f"│{label_text}{' ' * max(pad, 1)}{icon}  │")

        if status == "ERROR":
            err = cap.get("error", "")[:W - 6]
            print(f"│    {err:<{W-4}}│")
        else:
            vcpu_u  = cap.get("vcpu_used", 0)
            vcpu_l  = cap.get("vcpu_limit", 0)
            remain  = cap.get("instances_remaining", 0)
            pct     = cap.get("usage_pct", 0) * 100
            src     = cap.get("quota_source", "")

            bar_len = 28
            filled  = int(bar_len * pct / 100)
            bar     = "█" * filled + "░" * (bar_len - filled)

            line2 = f"    [{bar}] {pct:.0f}%  vCPU {vcpu_u}/{vcpu_l}  來源:{src}"
            line3 = f"    以 {vcpus} vCPU/台計，還可開：{remain} 台"
            print(f"│{line2:<{W}}│")
            print(f"│{line3:<{W}}│")

        print("├" + "─" * W + "┤")

    print("\033[1A\033[K", end="")
    print("└" + "─" * W + "┘")

    # 全部封鎖時的緊急提示
    if blocked_count == len(all_caps):
        print()
        print("  🚨 所有 Region 均已滿！需要開通新 AWS 帳號或申請配額提升。")
        print("  執行 python provision_cloud.py --plan starter 可看完整說明。")
    elif blocked_count > 0:
        print(f"\n  ⚠️  {blocked_count} 個 Region 已滿，其餘仍可使用。")

    print()


def cmd_list(args) -> None:
    """列出所有管理中的實例"""
    provider = get_provider(args.provider, region=getattr(args, "region", None))
    instances = provider.list_managed_instances()

    if not instances:
        print(f"[{args.provider.upper()}] 目前沒有運行中的實例")
        return

    print(f"\n{'─'*78}")
    print(f"  {'USER ID':<15} {'INSTANCE ID':<22} {'IP':<16} {'PLAN':<12} {'REGION':<16} {'STATE'}")
    print(f"{'─'*78}")
    for inst in instances:
        print(
            f"  {inst['user_id']:<15} {inst['instance_id']:<22} "
            f"{inst['public_ip']:<16} {inst['plan']:<12} "
            f"{inst.get('region','?'):<16} {inst['state']}"
        )
    print(f"{'─'*78}")
    print(f"  共 {len(instances)} 個實例\n")


def cmd_terminate(args) -> None:
    """終止指定實例"""
    confirm = input(f"確定要終止實例 {args.terminate}？(輸入 yes 確認): ")
    if confirm.strip().lower() != "yes":
        print("已取消")
        return
    provider = get_provider(args.provider, region=getattr(args, "region", None))
    provider.terminate(args.terminate)
    print(f"實例 {args.terminate} 已終止")


# ──────────────────────────────────────────────────────────────
# CLI 入口
# ──────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    from providers.aws_provider import AWSProvider

    parser = argparse.ArgumentParser(
        description="龍蝦雲 自動化開戶與交付系統",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # 通用
    parser.add_argument(
        "--provider", choices=["aws", "gcp"], default="aws",
        help="雲端提供商 (預設: aws)"
    )
    parser.add_argument(
        "--region",
        choices=list(AWSProvider.REGION_CONFIG.keys()),
        metavar="|".join(AWSProvider.REGION_CONFIG.keys()),
        help=(
            "指定 AWS Region（不指定則自動選最佳）\n"
            + "  " + " | ".join(
                f"{r} ({c['name']})" for r, c in AWSProvider.REGION_CONFIG.items()
            )
        ),
    )

    # 開通方案
    provision_group = parser.add_argument_group("開通方案")
    provision_group.add_argument(
        "--plan",
        choices=["starter", "standard", "pro", "business", "enterprise"],
        help="方案等級 (starter/standard/pro/business/enterprise)"
    )
    provision_group.add_argument("--user-id",     help="用戶唯一識別碼（訂單號/UID）")
    provision_group.add_argument("--ai-provider", choices=["openai", "gemini"], help="AI 平台")
    provision_group.add_argument("--ai-api-key",  help="用戶的 AI API Key")
    provision_group.add_argument(
        "--platform", choices=["telegram", "line", "discord", "slack", "whatsapp", "email"],
        help="通訊平台"
    )
    provision_group.add_argument("--contact",  help="聯絡資訊 (Telegram @handle / LINE ID / Email)")
    provision_group.add_argument("--key-name", help="[AWS only] EC2 Key Pair 名稱 (可選)")

    # 管理
    mgmt_group = parser.add_argument_group("實例管理")
    mgmt_group.add_argument("--list",            action="store_true", help="列出所有運行中的實例")
    mgmt_group.add_argument("--terminate",       metavar="INSTANCE_ID", help="終止（停機）指定實例")
    mgmt_group.add_argument("--plans",           action="store_true", help="顯示所有方案比較表")
    mgmt_group.add_argument(
        "--capacity-check", action="store_true",
        help="掃描所有 Region 容量（可搭配 --plan 指定方案規格）"
    )

    return parser


def main():
    _load_dotenv()

    parser = build_parser()
    args   = parser.parse_args()

    if args.plans:
        print_plans_table()
    elif getattr(args, "capacity_check", False):
        cmd_capacity_check(args)
    elif args.list:
        cmd_list(args)
    elif args.terminate:
        cmd_terminate(args)
    else:
        # 開通流程 — 檢查必填參數
        required = ["plan", "user_id", "ai_provider", "ai_api_key", "platform", "contact"]
        missing  = [f"--{r.replace('_', '-')}" for r in required if not getattr(args, r, None)]
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
