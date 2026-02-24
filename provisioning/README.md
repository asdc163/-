# 龍蝦雲 · 自動化開戶與交付系統

> **Boss 收錢，系統幹活。** 一條指令，60 秒完成開戶、裝好 OpenClaw、發出密鑰。

---

## 架構總覽

```
provision_cloud.py          ← 主控 CLI（你唯一需要執行的檔案）
├── config/plans.py         ← 5 大方案設定（含售價、AWS 規格、功能限制）
├── providers/
│   ├── aws_provider.py     ← AWS EC2 自動開機
│   └── gcp_provider.py     ← GCP Compute Engine 自動開機
└── templates/
    └── cloud_init.sh.j2    ← 開機後自動安裝 OpenClaw 的腳本
```

---

## 五大方案

> 定價基準：AWS 東京（ap-northeast-1），On-Demand Linux，2024 Q1

| 方案 | 售價/月 | AWS 成本 | 毛利率 | 規格 | 目標客群 |
|------|---------|---------|--------|------|---------|
| **Starter** | $19.9 | ~$9.95 | 50% | t3.micro · 2C1G · 20GB | 試用、學生、副業測試 |
| **Basic** | $35.9 | ~$19.10 | 47% | t3.small · 2C2G · 30GB | 日常個人使用 |
| **Pro** | $69.9 | ~$37.41 | 46% | t3.medium · 2C4G · 50GB | 重度用戶 / 自由工作者 |
| **Business** | $129.9 | ~$73.22 | 44% | t3.large · 2C8G · 80GB | 小型團隊 / 工作室 |
| **Enterprise** | $249.9 | ~$141.63 | 43% | t3.xlarge · 4C16G · 100GB | 企業級 / 高流量 |

### 功能對照

| 功能 | Starter | Basic | Pro | Business | Enterprise |
|------|---------|-------|-----|----------|-----------|
| 同時對話數 | 1 | 3 | 10 | 30 | 無限 |
| 通訊平台數 | 1 | 2 | 3 | 5 | 無限 |
| 上下文長度 | 8K | 16K | 32K | 64K | 128K |
| 每日備份 | ✗ | ✗ | ✓ | ✓ | ✓ |
| 優先支援 | ✗ | ✗ | ✗ | ✓ | ✓ |

---

## 快速開始

### 1. 安裝依賴

```bash
cd provisioning
pip install -r requirements.txt
```

### 2. 設定環境變數

```bash
cp .env.example .env
# 編輯 .env，填入你的 AWS 金鑰
```

### 3. 查看方案比較表

```bash
python provision_cloud.py --plans
```

### 4. 開通用戶

收到訂單後，一條命令搞定：

```bash
# 範例：開通 Pro 方案
python provision_cloud.py \
    --plan pro \
    --user-id ORDER_20240101 \
    --ai-provider openai \
    --ai-api-key sk-xxxxxxxx \
    --platform telegram \
    --contact @username
```

輸出範例（約 60 秒後）：

```
╔══════════════════════════════════════════════════════════════╗
║  🦞 龍蝦雲 交付完成！
║  用戶 ID     : ORDER_20240101
║  方案        : Pro
║  🌐 連線地址 : http://13.xx.xx.xx:8080
║  🔑 登入密鑰 : eyJxxxxxxxxxxxxxxxxxx...
║  📱 通訊平台 : TELEGRAM / @username
╚══════════════════════════════════════════════════════════════╝
```

---

## 管理指令

```bash
# 查看所有方案規格與毛利
python provision_cloud.py --plans

# 列出所有運行中的實例
python provision_cloud.py --list --provider aws

# 停機（用戶不續約時使用，立即停止 AWS 扣費）
python provision_cloud.py --terminate i-0abc123def --provider aws
```

---

## User Flow 說明

```
用戶下單
   ↓
你提供給系統：--plan <方案> --user-id <訂單號> --ai-api-key <key> --platform <通訊軟體> --contact <帳號>
   ↓
系統自動：
  1. 在 AWS 建立 EC2 實例（對應方案規格）
  2. 伺服器開機後自動安裝 Node.js + OpenClaw
  3. 寫入 openclaw.json（含用戶 API key + 通訊設定）
  4. 啟動 OpenClaw Gateway
   ↓
你收到：IP 地址 + 登入密鑰  →  轉發給用戶
   ↓
用戶到期不續約
   ↓
你執行：--terminate <instance-id>  →  AWS 立即停止扣費
```

---

## AWS 費用最佳化建議

| 使用情境 | 建議策略 | 節省幅度 |
|---------|---------|---------|
| 固定長期用戶（≥ 1 年）| 購買 Reserved Instance | 節省 30~40% |
| 非高峰時段用戶 | 使用 Spot Instance | 節省 60~70%（有中斷風險）|
| 台灣低延遲需求 | 切換 GCP asia-east1 | 延遲降低，價格相近 |
| 大量開戶（10+ 個）| 申請 AWS Savings Plans | 節省 20~30% |
