#!/usr/bin/env bash
# Push code updates to the running VM without full redeploy.
# Usage: bash deploy/update.sh

set -euo pipefail

PROJECT_ID="arb-bot-trading"
ZONE="asia-east1-b"
VM_NAME="arb-bot-vm"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOT_DIR="$(dirname "$SCRIPT_DIR")/arbitrage_bot"

GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[update]${NC} $*"; }

gcloud config set project "$PROJECT_ID" --quiet

log "Uploading updated bot code..."
gcloud compute scp \
  --recurse \
  --zone="$ZONE" \
  "$BOT_DIR/" \
  "$VM_NAME:~/arbitrage_bot/"

log "Restarting arb-bot service..."
gcloud compute ssh "$VM_NAME" --zone="$ZONE" -- \
  "sudo systemctl restart arb-bot && sleep 2 && sudo systemctl status arb-bot --no-pager -l"

log "Done. Streaming logs for 10s..."
gcloud compute ssh "$VM_NAME" --zone="$ZONE" -- \
  'sudo journalctl -u arb-bot -n 30 --no-pager'
