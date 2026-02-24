# 部署指南 — HL × Aster 套利機器人

## 快速部署（一鍵）

```bash
# 1. 在你的本機安裝 gcloud CLI（如果還沒裝）
#    macOS:
brew install --cask google-cloud-sdk
#    或直接下載：https://cloud.google.com/sdk/docs/install

# 2. 登入 Google Cloud
gcloud auth login

# 3. 執行部署腳本（會自動建 VM、上傳程式、設定服務）
bash deploy/deploy.sh
```

腳本會詢問一次 `ARB_KEY_PASSWORD`（解密憑證用的密碼），填入：
```
Arb$ecure2026!xHL
```

---

## 部署後的操作

### 看即時 Log
```bash
bash deploy/logs.sh
# 或直接：
gcloud compute ssh arb-bot-vm --zone=asia-east1-b -- 'sudo journalctl -u arb-bot -f'
```

### 更新程式碼（改了設定或程式後）
```bash
bash deploy/update.sh
```

### 手動停止 / 啟動
```bash
gcloud compute ssh arb-bot-vm --zone=asia-east1-b -- 'sudo systemctl stop arb-bot'
gcloud compute ssh arb-bot-vm --zone=asia-east1-b -- 'sudo systemctl start arb-bot'
```

### 切換到實盤模式
```bash
# 先修改 config.yaml
# simulation.enabled: false

# 再更新到 VM
bash deploy/update.sh
```

---

## 費用估算

| 項目 | 費用 |
|------|------|
| e2-micro VM（asia-east1）| ~$7/月 |
| 20GB 磁碟 | ~$1/月 |
| 網路流量 | < $1/月 |
| **合計** | **~$9/月** |

> GCP 新帳戶有 $300 免費額度，足夠用 30 個月以上。

---

## VM 規格

- 區域：asia-east1-b（台灣）
- 機型：e2-micro（1 vCPU / 1 GB RAM）
- OS：Debian 12
- 自動重啟：是（systemd on-failure）

---

## 日誌位置

在 VM 上：
```bash
sudo journalctl -u arb-bot        # 全部
sudo journalctl -u arb-bot -f     # 即時
sudo journalctl -u arb-bot -n 50  # 最近 50 行
```

本地 log 檔案（VM 上）：
```
~/arbitrage_bot/logs/arb_bot.log
```
