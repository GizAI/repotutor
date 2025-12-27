#!/bin/bash
# Giz Code - One-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/GizAI/code/main/install.sh | bash -s -- --repo ~/myrepo

set -e

VERSION="1.1.0"
RELEASE_URL="https://github.com/GizAI/code/releases/download/v${VERSION}/giz-code-linux-x64.tar.gz"
INSTALL_DIR="${GIZ_CODE_DIR:-$HOME/giz-code}"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# Defaults
TARGET_REPO=""
PASSWORD=""
PORT="3000"
API_KEY=""
PM2_NAME="giz-code"

log() { echo -e "${CYAN}▸${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

banner() {
    echo ""
    echo -e "${BOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║${NC}  ${CYAN}Giz Code${NC} v${VERSION} - AI codebase explorer            ${BOLD}║${NC}"
    echo -e "${BOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

usage() {
    echo "Usage: curl -fsSL .../install.sh | bash -s -- [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --repo PATH       Target repository (required)"
    echo "  --password PASS   Password for web access"
    echo "  --port PORT       Port (default: 3000)"
    echo "  --api-key KEY     Anthropic API key"
    echo "  --name NAME       PM2 name (default: giz-code)"
    echo "  --dir PATH        Install dir (default: ~/giz-code)"
    exit 0
}

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --repo) TARGET_REPO="$2"; shift 2 ;;
        --password) PASSWORD="$2"; shift 2 ;;
        --port) PORT="$2"; shift 2 ;;
        --api-key) API_KEY="$2"; shift 2 ;;
        --name) PM2_NAME="$2"; shift 2 ;;
        --dir) INSTALL_DIR="$2"; shift 2 ;;
        --help|-h) usage ;;
        *) error "Unknown: $1" ;;
    esac
done

# Validate
[ -z "$TARGET_REPO" ] && error "--repo is required"
TARGET_REPO="${TARGET_REPO/#\~/$HOME}"
[ ! -d "$TARGET_REPO" ] && error "Directory not found: $TARGET_REPO"

main() {
    banner

    # Check deps
    log "Checking dependencies..."
    command -v node &>/dev/null || error "Node.js required"
    command -v pm2 &>/dev/null || { log "Installing PM2..."; npm install -g pm2; }
    success "Dependencies OK"

    # Download
    log "Downloading Giz Code v${VERSION}..."
    mkdir -p "$INSTALL_DIR"
    curl -fsSL "$RELEASE_URL" | tar -xz -C "$INSTALL_DIR"
    success "Downloaded"

    # Configure
    log "Configuring..."
    cat > "$INSTALL_DIR/.env.local" << EOF
REPO_PATH=$TARGET_REPO
PORT=$PORT
EOF
    [ -n "$PASSWORD" ] && echo "REPOTUTOR_PASSWORD=$PASSWORD" >> "$INSTALL_DIR/.env.local"
    [ -n "$API_KEY" ] && echo "ANTHROPIC_API_KEY=$API_KEY" >> "$INSTALL_DIR/.env.local"
    success "Configured"

    # PM2
    log "Starting with PM2..."
    cd "$INSTALL_DIR"
    pm2 delete "$PM2_NAME" 2>/dev/null || true

    cat > ecosystem.config.cjs << PMEOF
module.exports = {
  apps: [{
    name: '$PM2_NAME',
    script: 'server.js',
    cwd: '$INSTALL_DIR',
    env: { NODE_ENV: 'production', PORT: '$PORT', HOSTNAME: '0.0.0.0' }
  }]
};
PMEOF

    pm2 start ecosystem.config.cjs
    pm2 save
    success "Running"

    echo ""
    echo -e "${BOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║${NC}  ${GREEN}Installation complete!${NC}                                  ${BOLD}║${NC}"
    echo -e "${BOLD}╠═══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC}  URL: ${CYAN}http://localhost:$PORT${NC}                              ${BOLD}║${NC}"
    [ -n "$PASSWORD" ] && echo -e "${BOLD}║${NC}  Password: ${CYAN}$PASSWORD${NC}                                     ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}  Logs: ${YELLOW}pm2 logs $PM2_NAME${NC}                              ${BOLD}║${NC}"
    echo -e "${BOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
}

main
