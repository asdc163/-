# TikTok AI Auto Poster — Claude 工作手冊

> 每次新對話開始前先讀這份文件，快速掌握專案狀態。

---

## 專案目標

全自動 TikTok 內容發布 Agent：
1. 抓美國 TikTok 熱門話題（TikHub API）
2. 用 AI 生成 9:16 垂直影片（fal.ai Kling 2.6 Pro）
3. 產出 SEO 優化標題與 hashtag
4. 自動發布到 TikTok 帳號
5. 收集初始流量數據
6. 持續循環，每天自動跑 N 次

---

## 架構

```
/
├── App.tsx                   # React 前端，pipeline 狀態機
├── views/                    # UI 頁面
├── api/                      # Vercel Serverless Functions（後端）
│   ├── trending.ts           # GET  /api/trending   → TikHub API
│   ├── generate.ts           # POST /api/generate   → fal.ai Kling 2.6 Pro
│   ├── generate-status.ts    # GET  /api/generate-status → 輪詢進度
│   ├── seo.ts                # POST /api/seo        → 規則式 / OpenAI
│   ├── publish.ts            # POST /api/publish    → TikTok Content Posting API
│   ├── analytics.ts          # GET  /api/analytics  → 流量數據（目前 mock）
│   └── _mock.ts              # 所有 API 的 fallback mock 資料
├── public/
│   ├── tos.html              # Terms of Service（TikTok 開發者必填 URL 用）
│   └── privacy.html          # Privacy Policy
├── vercel.json               # Vercel 部署設定
├── .env.example              # 所有環境變數範本
└── .github/workflows/ci.yml  # TypeScript check + build CI
```

---

## API 金鑰狀態

| 服務 | 環境變數 | 狀態 | 備註 |
|------|---------|------|------|
| **fal.ai Kling 2.6 Pro** | `FAL_AI_KEY` | ✅ **已確認可用** | 測試於 2026-02-22，生成 7.4MB 9:16 影片，約 90 秒 |
| **TikHub**（熱門話題） | `TIKHUB_API_KEY` | ❌ 尚未取得 | 去 tikhub.io 註冊，有免費試用額度 |
| **TikTok Content Posting API** | `TIKTOK_ACCESS_TOKEN` | ❌ 尚未完成 | 見下方「未完成事項」 |
| **OpenAI**（選填，SEO 優化） | `OPENAI_API_KEY` | ⬜ 非必要 | 不填仍可運作，用規則式 SEO |

**fal.ai key（已測試可用）：**
```
f45f96d3-37ac-4e61-9776-4e1181a0af65:19e1eeb5ea18c4cf911b1dc2e79787d4
```

---

## 已完成

- [x] React 前端 pipeline UI（5 階段視覺化進度）
- [x] Vercel Serverless Functions 全部建立
- [x] fal.ai Kling 2.6 Pro 串接（`api/generate.ts` + `api/generate-status.ts`）
  - 使用 queue API，jobId 格式：`fal_{request_id}`
  - 9:16 格式，5s 或 10s，`$0.07/sec`
- [x] TikHub 趨勢串接（`api/trending.ts`），無 key 時 fallback mock
- [x] TikTok Content Posting API 串接（`api/publish.ts`），無 token 時 mock
- [x] 規則式 SEO 產生（`api/seo.ts`）
- [x] 所有 API 都有 graceful degradation（沒有 key 也能完整跑 mock 模式）
- [x] ToS 和 Privacy Policy 靜態頁（`public/tos.html`, `public/privacy.html`）
- [x] GitHub Actions CI（typecheck + build）
- [x] `.env.example` 環境變數說明

---

## 未完成（按優先順序）

### 🔴 P0 — 必須做才能真實發布

#### 1. 部署到 Vercel（取得 HTTPS 網址）
- 去 [vercel.com](https://vercel.com) Import GitHub repo
- 加入環境變數：`FAL_AI_KEY=f45f96d3-...`
- 部署後取得網址，例如 `https://your-app.vercel.app`
- **這個網址是 TikTok 開發者填表必需的**

#### 2. 完成 TikTok Developer App 設定
- 進度：已建立 App，卡在填表（Description / ToS URL / Privacy URL）
- 填寫內容備用：
  ```
  Description:
  AI-powered app that creates and publishes trending TikTok videos
  automatically using AI video generation technology.

  Terms of Service URL:
  https://[vercel 網址]/tos.html

  Privacy Policy URL:
  https://[vercel 網址]/privacy.html
  ```
- 完成後在 App 頁面取得：`Client Key` + `Client Secret`
- 加入產品：Login Kit + Content Posting API

#### 3. 建立 TikTok OAuth 授權流程
- 目前 `api/publish.ts` 需要 `TIKTOK_ACCESS_TOKEN`
- 需要建立：
  - `api/auth/tiktok.ts` — 導向 TikTok OAuth URL
  - `api/auth/callback.ts` — 接收 code，換取 access_token + refresh_token
  - `api/auth/refresh.ts` — 自動刷新 token（有效期 24 小時）
- access_token 存在環境變數，refresh 機制存在 Vercel KV 或檔案

#### 4. 測試完整 end-to-end 真實發布
- 確認 TikTok 帳號有收到影片

---

### 🟡 P1 — 讓自動化真正持續跑

#### 5. 排程自動執行（每天 N 次）
- 選項 A：**Vercel Cron Jobs**（`vercel.json` 加 cron 設定，Hobby 免費）
  ```json
  "crons": [{ "path": "/api/cron/run", "schedule": "0 9,15,21 * * *" }]
  ```
  建立 `api/cron/run.ts` 執行完整 pipeline
- 選項 B：**GitHub Actions schedule**（免費，但 Vercel 函數有 10s timeout 限制）
- **建議選項 A**

#### 6. 避免重複發布同一話題
- 需要一個簡單的 published log
- 可用 **Vercel KV**（免費 tier）記錄已發布的 topic tag + timestamp

#### 7. TikHub API 金鑰
- 去 [tikhub.io](https://tikhub.io) 註冊
- User Center → API Token → 加到 Vercel 環境變數

---

### 🟢 P2 — 優化與監控

#### 8. 真實 TikTok Analytics
- 目前 `api/analytics.ts` 是 seeded mock
- TikTok Research API 或 Business API 才能取得真實數據
- 需要申請額外 API 存取權限

#### 9. 通知機制（選填）
- 每次發布成功 / 失敗通知
- 可選：Line Notify / Discord Webhook / Email

#### 10. 當 Seedance 2.0 官方 API 上線
- 預計 2026-02-24 Volcengine ARK 開放
- 切換方式：只需改環境變數
  ```
  FAL_AI_KEY=           (清空)
  SEEDANCE_API_KEY=ark-xxxxx
  SEEDANCE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
  ```
- `api/generate.ts` 已支援 Seedance fallback 路徑

---

## 分支資訊

```
branch: claude/tiktok-seedance-agent-fLEXR
```

---

## 下次繼續時，告訴 Claude

> 「讀 CLAUDE.md，我們繼續做 TikTok Auto Poster，現在要做 [項目編號]」

常見接續點：
- **「做 Vercel 部署」** → P0 第 1 項
- **「做 TikTok OAuth」** → P0 第 3 項，需要先有 Client Key + Client Secret
- **「做排程自動化」** → P1 第 5 項
- **「TikHub key 拿到了，串接一下」** → 直接更新 Vercel 環境變數即可，code 已寫好
