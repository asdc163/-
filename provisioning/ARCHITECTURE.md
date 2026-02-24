# 龍蝦雲 系統架構分析

## 一、OpenClaw 認識（重要基礎）

### 它是什麼

OpenClaw 是一個**開源的自主 AI Agent 框架**（前身為 Clawdbot / Moltbot），不是單純的聊天 bot。它的核心是一個 WebSocket Gateway，可以：

- 連接各種 LLM（OpenAI / Gemini / Claude / DeepSeek）
- 同時串接多個通訊平台（Telegram、LINE、Discord、Slack、WhatsApp、Teams 等 10+ 個）
- 在伺服器上執行 Shell 指令、瀏覽器自動化、檔案操作
- 以 **24/7 自主 Agent** 模式持續運行

### 硬體需求（官方文件）

| 等級 | RAM | 適用情境 |
|------|-----|---------|
| 最低 | 2 GB | 可啟動，但體驗緊湊 |
| 建議 | 8~16 GB | 大多數日常用戶推薦值 |
| 高性能 | 32 GB | 企業高流量、多 bot 並行 |

**Node.js 版本要求：>= 22**（舊版本無法啟動，這是關鍵）

### 官方 Gateway 資訊

- **預設 Port：18789**（WebSocket）
- 預設只綁定 loopback（`127.0.0.1`），遠端連線需設定 `gateway.mode = server`
- 安裝指令：`openclaw onboard --install-daemon`（自動建立 systemd 服務）

### 已知安全漏洞

- **CVE-2026-25253**（CVSS 8.8，高危）：惡意連結可觸發遠端代碼執行
- **修補版本：2026.1.29 之後**
- 系統固定安裝最新版本（`npm install -g openclaw@latest`）以確保安全

---

## 二、目前架構（1~500 用戶）

```
Boss 操作 CLI
      │
      ▼
provision_cloud.py
      │
      ├── 1. 選擇方案 + 渲染 Cloud-Init 腳本
      ├── 2. 呼叫 AWS EC2 API 建立實例
      │         └── 每位用戶 = 1 台獨立 VPS（完全隔離）
      ├── 3. 等待實例進入 running 狀態
      ├── 4. 輸出 IP + 登入密鑰 → Boss 手動通知用戶
      └── 5. 儲存交付記錄到 delivery_logs/
```

**現有架構的適用範圍：100~500 用戶**
- 手動操作，Boss 需要在場
- 沒有自動化續約 / 到期終止
- 沒有中央監控（哪台掛了不知道）
- 沒有防止重複開通的機制

---

## 三、擴展到 20,000 用戶：面臨的挑戰

### 3.1 AWS 服務限制（最大瓶頸）

| 限制項目 | AWS 預設值 | 20,000 用戶需求 | 解法 |
|---------|-----------|--------------|------|
| EC2 vCPU 上限（On-Demand t 系列）| 32~96 | ~40,000 vCPU | 申請配額提升 + 多 Region |
| 每個 Region 的實例數 | ~20 | ~5,000/Region | 分佈 4 個 Region |
| Elastic IP 上限 | 5 | 不需要 | 使用動態 IP |
| EBS 卷數量 | 5,000/Region | ~5,000/Region | 多 Region 分佈 |
| EC2 API 速率限制 | ~100 req/s | 並發開通時觸發 | Queue + 限速 |

**結論：單一 AWS 帳號無法支撐 20,000 台實例，必須使用多 Region + 多帳號。**

### 3.2 多 Region 建議分佈（以亞洲市場為例）

| Region | 位置 | 建議分配 | 延遲（台灣） |
|--------|------|---------|------------|
| ap-northeast-1 | 東京 | 8,000 用戶 | ~50ms |
| ap-east-1 | 香港 | 5,000 用戶 | ~30ms |
| ap-southeast-1 | 新加坡 | 4,000 用戶 | ~80ms |
| ap-northeast-3 | 大阪 | 3,000 用戶 | ~55ms |

**讓用戶在購買時選擇節點地區（或自動分配最近節點）**

### 3.3 成本規模試算

以方案均值估算（假設用戶分佈：50% Starter, 30% Standard, 15% Pro, 5% Business）：

| 方案 | 用戶數 | 月收 | AWS 成本 | 月利潤 |
|------|-------|------|---------|--------|
| Starter $24.9 | 10,000 | $249,000 | $191,000 | $58,000 |
| Standard $49.9 | 6,000 | $299,400 | $224,460 | $74,940 |
| Pro $99.9 | 3,000 | $299,700 | $219,660 | $80,040 |
| Business $189.9 | 1,000 | $189,900 | $141,630 | $48,270 |
| **合計** | **20,000** | **$1,038,000** | **$776,750** | **$261,250** |

**每月純利：~$261,250（毛利率 25.2%）✓**

---

## 四、目標架構（支撐 20,000 用戶）

```
用戶付款（Stripe / USDT）
      │
      ▼
支付 Webhook（Lambda 或你的後端）
      │
      ▼
  訂單佇列（AWS SQS）
      │ 並行 5~10 個 Worker
      ▼
Provisioner Workers（ECS / EC2）
  ├── 選擇可用 Region（負載均衡）
  ├── 呼叫 AWS EC2 API 建立實例
  ├── 等待 running + 健康檢查
  └── 儲存到中央資料庫
      │
      ▼
  中央資料庫（DynamoDB / RDS）
  ┌─────────────────────────────┐
  │ instance_id, user_id, plan  │
  │ region, public_ip, status   │
  │ created_at, expires_at      │
  │ login_token (encrypted)     │
  └─────────────────────────────┘
      │
      ▼
通知服務（Lambda）
  ├── 發送 IP + 密鑰給用戶（Telegram Bot / LINE / Email）
  └── 7 天前發送續約提醒

      ▼
排程任務（EventBridge）
  ├── 每日健康掃描（ping 所有實例的 /health）
  ├── 到期檢查 → 自動 terminate 未續約實例
  └── 異常告警 → 發送通知給 Boss
```

### 關鍵組件說明

| 組件 | 技術選項 | 用途 |
|------|---------|------|
| 任務佇列 | AWS SQS | 緩衝開通請求，防止 API 速率超限 |
| 中央資料庫 | DynamoDB（推薦）或 RDS | 記錄所有用戶實例狀態 |
| Worker | AWS Lambda 或 ECS | 執行 provision_cloud.py 邏輯 |
| 排程器 | EventBridge | 定時健康掃描、到期終止 |
| 通知 | Telegram Bot API / LINE Notify | 自動發送給用戶 |
| 監控 | CloudWatch + SNS | 異常告警給 Boss |

---

## 五、現階段行動建議（分階段）

### 第一階段（現在，0~200 用戶）
- **用現有系統即可**
- 手動收到訂單 → 執行 `provision_cloud.py` → 手動告知用戶
- 重點：驗證 OpenClaw 的實際安裝流程是否順暢

### 第二階段（200~2,000 用戶）
需要增加：
1. **DynamoDB 資料表** 記錄所有實例
2. **Telegram Bot** 自動發送密鑰（Boss 不用手動傳）
3. **到期提醒腳本**（排程掃描 expires_at，提前 7 天發提醒）
4. **自動終止腳本**（到期未續約的實例自動 terminate）

### 第三階段（2,000~20,000 用戶）
需要增加：
1. **SQS 佇列 + Lambda Worker**（自動化，無需 Boss 在場）
2. **多 Region 分佈**（申請 AWS 配額提升）
3. **CloudWatch 監控面板**
4. **考慮 AWS Organizations**（多帳號管理，隔離風險）

---

## 六、立即需要做的事（上線前）

1. **申請 AWS 配額提升**
   - EC2: On-Demand Standard (T,M,C,R,X,Z,A,H instances) vCPUs → 申請至少 500
   - EBS: Volume count → 申請至少 500
   - 入口：AWS Console → Service Quotas → EC2

2. **設定 AWS Budget 告警**
   - 防止意外開支（例如忘記終止測試實例）
   - 建議設定月費上限 $500 告警

3. **建立 AWS Tag 策略**
   - 所有實例必須有 `UserId`, `Plan`, `ExpiresAt` 標籤
   - 這樣才能用 Cost Explorer 追蹤每個用戶的實際成本

4. **測試 openclaw onboard 流程**
   - 在真實 t3.small (2GB) 上跑一次完整安裝
   - 確認健康檢查 endpoint 路徑正確
