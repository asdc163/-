#!/usr/bin/env bash
# Quick shortcut: stream live logs from the bot on GCP.
# Usage: bash deploy/logs.sh

PROJECT_ID="arb-bot-trading"
ZONE="asia-east1-b"
VM_NAME="arb-bot-vm"

gcloud config set project "$PROJECT_ID" --quiet
echo "Streaming logs from $VM_NAME ... (Ctrl+C to stop)"
echo ""
gcloud compute ssh "$VM_NAME" --zone="$ZONE" -- \
  'sudo journalctl -u arb-bot -f --no-pager --output=short-precise'
