#!/usr/bin/env bash
# =============================================================================
# HL × Aster Arbitrage Bot — Google Cloud Deployment Script
# Target account : john.wu0120@gmail.com
# Region         : asia-east1-b (Taiwan)  ← lowest latency to BNB Chain + HL
# Machine        : e2-micro (~$7/month)   ← more than enough for this bot
#
# Usage (run this on your LOCAL machine with gcloud installed):
#   bash deploy/deploy.sh
#
# Prerequisites:
#   1. gcloud installed → https://cloud.google.com/sdk/docs/install
#   2. gcloud auth login  (one-time, opens browser)
#   3. Billing enabled on the project
# =============================================================================
set -euo pipefail

# ---- Configuration ----------------------------------------------------------
ACCOUNT="john.wu0120@gmail.com"
PROJECT_ID="arb-bot-trading"          # Will be created if it doesn't exist
ZONE="asia-east1-b"                    # Taiwan
REGION="asia-east1"
MACHINE="e2-micro"                     # 1 vCPU 1 GB RAM — plenty for the bot
VM_NAME="arb-bot-vm"
DISK_SIZE="20GB"
OS_IMAGE_FAMILY="debian-12"
OS_IMAGE_PROJECT="debian-cloud"
# Path to the arbitrage_bot/ directory on your local machine
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOT_DIR="$(dirname "$SCRIPT_DIR")/arbitrage_bot"
# -----------------------------------------------------------------------------

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
err()  { echo -e "${RED}[error]${NC} $*"; exit 1; }

# ---- Preflight checks -------------------------------------------------------
command -v gcloud &>/dev/null || err "gcloud not found. Install: https://cloud.google.com/sdk/docs/install"
[[ -d "$BOT_DIR" ]] || err "Bot directory not found: $BOT_DIR"

log "Authenticating with Google Cloud ($ACCOUNT)..."
gcloud auth login --account="$ACCOUNT" --quiet 2>/dev/null || \
  gcloud auth login --account="$ACCOUNT"

# ---- Project setup ----------------------------------------------------------
log "Setting up project: $PROJECT_ID"
if ! gcloud projects describe "$PROJECT_ID" &>/dev/null; then
  log "Creating new project..."
  gcloud projects create "$PROJECT_ID" \
    --name="Arbitrage Bot" \
    --set-as-default
else
  log "Project already exists, reusing."
fi
gcloud config set project "$PROJECT_ID"
gcloud config set account "$ACCOUNT"

log "Enabling Compute Engine API..."
gcloud services enable compute.googleapis.com --quiet

# Check billing (can't enable programmatically, give clear instructions)
BILLING=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null || echo "false")
if [[ "$BILLING" != "True" ]]; then
  warn "Billing not enabled on $PROJECT_ID."
  warn "Please open this URL and link a billing account:"
  warn "  https://console.cloud.google.com/billing/projects"
  warn "Then press Enter to continue..."
  read -r
fi

# ---- Create VM (skip if already exists) -------------------------------------
if gcloud compute instances describe "$VM_NAME" --zone="$ZONE" &>/dev/null; then
  warn "VM '$VM_NAME' already exists. Skipping creation (will update code only)."
  UPDATE_ONLY=true
else
  UPDATE_ONLY=false
  log "Creating Compute Engine VM: $VM_NAME ($MACHINE in $ZONE)..."
  gcloud compute instances create "$VM_NAME" \
    --zone="$ZONE" \
    --machine-type="$MACHINE" \
    --image-family="$OS_IMAGE_FAMILY" \
    --image-project="$OS_IMAGE_PROJECT" \
    --boot-disk-size="$DISK_SIZE" \
    --boot-disk-type="pd-standard" \
    --tags="arb-bot" \
    --metadata="enable-oslogin=FALSE" \
    --scopes="default"

  log "Waiting 30s for VM to finish booting..."
  sleep 30
fi

# ---- Install system dependencies (first time only) --------------------------
if [[ "$UPDATE_ONLY" == "false" ]]; then
  log "Installing Python 3.11 and dependencies on VM..."
  gcloud compute ssh "$VM_NAME" --zone="$ZONE" --tunnel-through-iap -- \
    "sudo apt-get update -qq && \
     sudo apt-get install -y python3.11 python3.11-venv python3-pip git -qq && \
     python3.11 --version"
fi

# ---- Upload bot code ---------------------------------------------------------
log "Uploading bot code to VM..."

# Ensure remote directory exists
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --tunnel-through-iap -- \
  "mkdir -p ~/arbitrage_bot"

# Upload the entire arbitrage_bot directory (rsync-like, overwrites)
gcloud compute scp \
  --recurse \
  --zone="$ZONE" \
  "$BOT_DIR/" \
  "$VM_NAME:~/arbitrage_bot/"

# ---- Install Python dependencies --------------------------------------------
log "Installing Python packages on VM..."
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --tunnel-through-iap -- \
  "pip3 install --quiet -r ~/arbitrage_bot/requirements.txt 2>&1 | tail -3"

# ---- Set up systemd service -------------------------------------------------
log "Configuring systemd service..."

# Prompt for password securely — this is the ARB_KEY_PASSWORD
echo ""
echo "The bot needs the ARB_KEY_PASSWORD to decrypt credentials in config.yaml."
echo "This is the password: Arb\$ecure2026!xHL"
echo "(You set this when encrypting your credentials.)"
echo ""
read -rsp "Confirm ARB_KEY_PASSWORD: " BOT_PASSWORD
echo ""

# Write environment file on the VM (permissions: root only)
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --tunnel-through-iap -- \
  "echo 'ARB_KEY_PASSWORD=${BOT_PASSWORD}' | sudo tee /root/arb-bot.env > /dev/null && \
   sudo chmod 600 /root/arb-bot.env && \
   echo 'Environment file written (mode 600).'"

# Write systemd service file
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --tunnel-through-iap -- "
sudo tee /etc/systemd/system/arb-bot.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=HL x Aster Funding Rate Arbitrage Bot
Documentation=https://github.com/asterdex/api-docs
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/arbitrage_bot
EnvironmentFile=/root/arb-bot.env
ExecStart=/usr/bin/python3 main.py
Restart=on-failure
RestartSec=30s
StartLimitInterval=5min
StartLimitBurst=5

# Logging — view with: sudo journalctl -u arb-bot -f
StandardOutput=journal
StandardError=journal
SyslogIdentifier=arb-bot

# Resource limits
MemoryMax=512M

[Install]
WantedBy=multi-user.target
SERVICE_EOF
"

# ---- Start/Restart the bot --------------------------------------------------
log "Enabling and starting arb-bot service..."
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --tunnel-through-iap -- \
  "sudo systemctl daemon-reload && \
   sudo systemctl enable arb-bot && \
   sudo systemctl restart arb-bot && \
   sleep 3 && \
   sudo systemctl status arb-bot --no-pager -l"

# ---- Get VM external IP for reference ---------------------------------------
VM_IP=$(gcloud compute instances describe "$VM_NAME" \
  --zone="$ZONE" \
  --format="value(networkInterfaces[0].accessConfigs[0].natIP)")

echo ""
echo "======================================================================"
echo -e "${GREEN}  Deployment complete!${NC}"
echo "======================================================================"
echo ""
echo "  VM Name     : $VM_NAME"
echo "  IP Address  : $VM_IP"
echo "  Region      : $ZONE"
echo "  Machine     : $MACHINE"
echo ""
echo "  Useful commands:"
echo ""
echo "  # View live logs:"
echo "  gcloud compute ssh $VM_NAME --zone=$ZONE -- 'sudo journalctl -u arb-bot -f'"
echo ""
echo "  # Check bot status:"
echo "  gcloud compute ssh $VM_NAME --zone=$ZONE -- 'sudo systemctl status arb-bot'"
echo ""
echo "  # Update bot code after changes:"
echo "  bash deploy/deploy.sh    # re-run this script"
echo ""
echo "  # Stop the bot:"
echo "  gcloud compute ssh $VM_NAME --zone=$ZONE -- 'sudo systemctl stop arb-bot'"
echo ""
echo "  # SSH into VM:"
echo "  gcloud compute ssh $VM_NAME --zone=$ZONE"
echo "======================================================================"
