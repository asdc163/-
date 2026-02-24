# 龍蝦雲 · 自動化開戶與交付系統

> **Boss 收錢，系統幹活。** 一條指令，60 秒完成開戶。

---

## 架構總覽

```
provision_cloud.py          ← 主控 CLI（你唯一需要執行的檔案）
├── config/plans.py         ← 方案設定（Basic / Pro / Enterprise）
├── providers/
│   ├── aws_provider.py     ← AWS EC2 自動開機
│   └── gcp_provider.py     ← GCP Compute Engine 自動開機
└── templates/
    └── cloud_init.sh.j2    ← 伺服器開機後自動安裝 OpenClaw 的腳本
```

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
# 編輯 .env，填入你的 AWS 或 GCP 金鑰
```

### 3. 開通一個用戶

#### AWS（推薦首選）

```bash
python provision_cloud.py \
    --provider aws \
    --plan pro \
    --user-id ORDER_20240101 \
    --ai-provider openai \
    --ai-api-key sk-xxxxxxxx \
    --platform telegram \
    --contact @username
```

#### GCP

```bash
python provision_cloud.py \
    --provider gcp \
    --plan basic \
    --user-id ORDER_20240102 \
    --ai-provider gemini \
    --ai-api-key AIzaSy... \
    --platform line \
    --contact +886912345678
```

---

## 方案規格對照

| 方案 | 售價 | AWS 規格 | GCP 規格 | 硬碟 |
|------|------|----------|----------|------|
| Basic | $9.9 | t3.micro (1GB RAM) | e2-micro (1GB RAM) | 20GB |
| Pro | $19.9 | t3.small (2GB RAM) | e2-small (2GB RAM) | 40GB |
| Enterprise | $49.9 | t3.medium (4GB RAM) | e2-medium (4GB RAM) | 80GB |

---

## 管理指令

```bash
# 列出所有在線實例
python provision_cloud.py --list --provider aws

# 終止指定實例（用戶到期後使用）
python provision_cloud.py --terminate i-0abc123def --provider aws
```

---

## 交付記錄

每次開通後，系統自動在 `delivery_logs/` 目錄儲存 JSON 格式的交付記錄，包含：
- 用戶 ID、方案、實例 ID
- 公開 IP、OpenClaw 連線網址
- 登入密鑰（請妥善保管）

---

## AWS vs GCP 選擇建議

| 比較項目 | AWS EC2 | GCP Compute Engine |
|---------|---------|-------------------|
| 管理介面 | AWS Console（功能最完整）| Google Cloud Console |
| 計費管理 | AWS Cost Explorer | GCP Billing |
| 台灣節點 | 無（最近：東京）| 有（asia-east1 台灣）|
| 自動化成熟度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 入門難度 | 中 | 中 |

**推薦：初期使用 AWS（boto3 生態最成熟）；台灣用戶低延遲需求選 GCP（台灣有機房）**
