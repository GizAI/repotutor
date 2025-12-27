#!/bin/bash
# Giz Code - One-line installer
# Usage: curl -fsSL https://raw.githubusercontent.com/GizAI/code/main/install.sh | bash
# With options: curl -fsSL ... | bash -s -- --repo ~/myrepo --password secret --port 3000

set -e

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

VERSION="1.0.0"
REPO_URL="https://github.com/GizAI/code.git"
INSTALL_DIR="${GIZ_CODE_DIR:-$HOME/giz-code}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Defaults
TARGET_REPO=""
PASSWORD=""
PORT="3000"
API_KEY=""
PM2_NAME="giz-code"
NO_PM2=false
DEV_MODE=false
INTERACTIVE=true

# Detect if running in pipe (curl | bash)
if [ ! -t 0 ]; then
    INTERACTIVE=false
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

log() { echo -e "${CYAN}▸${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

banner() {
    echo ""
    echo -e "${BOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║${NC}  ${CYAN}Giz Code${NC} - AI-powered codebase explorer              ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}  ${BLUE}https://github.com/GizAI/code${NC}                          ${BOLD}║${NC}"
    echo -e "${BOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

usage() {
    echo "Usage: install.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --repo PATH       Target repository to explore (required)"
    echo "  --password PASS   Password for web access (optional)"
    echo "  --port PORT       Port to run on (default: 3000)"
    echo "  --api-key KEY     Anthropic API key for AI chat"
    echo "  --name NAME       PM2 process name (default: giz-code)"
    echo "  --dir PATH        Installation directory (default: ~/giz-code)"
    echo "  --no-pm2          Don't use PM2, just build"
    echo "  --dev             Development mode (don't build)"
    echo "  --help            Show this help"
    echo ""
    echo "Examples:"
    echo "  # Interactive install"
    echo "  curl -fsSL https://raw.githubusercontent.com/GizAI/code/main/install.sh | bash"
    echo ""
    echo "  # Non-interactive with all options"
    echo "  curl -fsSL ... | bash -s -- --repo ~/myproject --password secret --port 8080"
    exit 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# Parse arguments
# ═══════════════════════════════════════════════════════════════════════════════

PORT_SET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --repo) TARGET_REPO="$2"; shift 2 ;;
        --password) PASSWORD="$2"; shift 2 ;;
        --port) PORT="$2"; PORT_SET=true; shift 2 ;;
        --api-key) API_KEY="$2"; shift 2 ;;
        --name) PM2_NAME="$2"; shift 2 ;;
        --dir) INSTALL_DIR="$2"; shift 2 ;;
        --no-pm2) NO_PM2=true; shift ;;
        --dev) DEV_MODE=true; shift ;;
        --help|-h) usage ;;
        *) error "Unknown option: $1" ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════════════
# Check dependencies
# ═══════════════════════════════════════════════════════════════════════════════

check_deps() {
    log "Checking dependencies..."

    # Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js not found. Install: https://nodejs.org/"
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js 18+ required (current: $(node -v))"
    fi
    success "Node.js $(node -v)"

    # npm
    if ! command -v npm &> /dev/null; then
        error "npm not found"
    fi
    success "npm $(npm -v)"

    # PM2
    if [ "$NO_PM2" = false ]; then
        if ! command -v pm2 &> /dev/null; then
            log "Installing PM2..."
            npm install -g pm2 2>/dev/null || sudo npm install -g pm2
        fi
        success "PM2 $(pm2 -v)"
    fi

    # Git
    if ! command -v git &> /dev/null; then
        error "Git not found"
    fi
    success "Git $(git --version | cut -d' ' -f3)"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Interactive prompts
# ═══════════════════════════════════════════════════════════════════════════════

interactive_setup() {
    # Non-interactive mode: require --repo
    if [ "$INTERACTIVE" = false ]; then
        if [ -z "$TARGET_REPO" ]; then
            error "Non-interactive mode requires --repo option"
        fi
        # Expand ~ to $HOME
        TARGET_REPO="${TARGET_REPO/#\~/$HOME}"
        if [ ! -d "$TARGET_REPO" ]; then
            error "Directory not found: $TARGET_REPO"
        fi
        return
    fi

    # Interactive mode
    if [ -z "$TARGET_REPO" ]; then
        echo ""
        read -p "$(echo -e "${CYAN}?${NC} Target repository path: ")" TARGET_REPO
        if [ -z "$TARGET_REPO" ]; then
            error "Repository path is required"
        fi
    fi

    # Expand ~ to $HOME
    TARGET_REPO="${TARGET_REPO/#\~/$HOME}"

    # Validate repo exists
    if [ ! -d "$TARGET_REPO" ]; then
        error "Directory not found: $TARGET_REPO"
    fi

    # Password
    if [ -z "$PASSWORD" ]; then
        read -p "$(echo -e "${CYAN}?${NC} Password for web access (Enter to skip): ")" PASSWORD
    fi

    # Port (only ask if not explicitly set)
    if [ "$PORT_SET" = false ]; then
        read -p "$(echo -e "${CYAN}?${NC} Port [3000]: ")" input_port
        PORT="${input_port:-3000}"
    fi

    # API Key
    if [ -z "$API_KEY" ]; then
        read -p "$(echo -e "${CYAN}?${NC} Anthropic API key (Enter to skip): ")" API_KEY
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Install
# ═══════════════════════════════════════════════════════════════════════════════

install_code() {
    log "Installing Giz Code to $INSTALL_DIR..."

    if [ -d "$INSTALL_DIR" ]; then
        log "Updating existing installation..."
        cd "$INSTALL_DIR"
        git fetch origin
        git reset --hard origin/main
    else
        git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    success "Code downloaded"
}

install_deps() {
    log "Installing dependencies..."
    cd "$INSTALL_DIR"
    npm install --legacy-peer-deps 2>&1 | tail -5
    success "Dependencies installed"
}

create_env() {
    log "Creating .env.local..."

    cat > "$INSTALL_DIR/.env.local" << EOF
# Giz Code Configuration
# Generated by install.sh

REPO_PATH=$TARGET_REPO
PORT=$PORT
EOF

    if [ -n "$PASSWORD" ]; then
        echo "REPOTUTOR_PASSWORD=$PASSWORD" >> "$INSTALL_DIR/.env.local"
    fi

    if [ -n "$API_KEY" ]; then
        echo "ANTHROPIC_API_KEY=$API_KEY" >> "$INSTALL_DIR/.env.local"
    fi

    success "Environment configured"
}

build_app() {
    if [ "$DEV_MODE" = true ]; then
        log "Skipping build (dev mode)"
        return
    fi

    log "Building application..."
    cd "$INSTALL_DIR"
    npm run build 2>&1 | tail -10
    success "Build complete"
}

setup_pm2() {
    if [ "$NO_PM2" = true ]; then
        return
    fi

    log "Setting up PM2..."
    cd "$INSTALL_DIR"

    # Stop existing
    pm2 delete "$PM2_NAME" 2>/dev/null || true
    pm2 delete "${PM2_NAME}-gateway" 2>/dev/null || true

    # Start Next.js
    PORT=$PORT pm2 start npm --name "$PM2_NAME" -- start

    # Start Gateway
    pm2 start node --name "${PM2_NAME}-gateway" -- --import tsx gateway.ts

    # Save PM2 config
    pm2 save

    success "PM2 processes started"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    banner
    check_deps
    interactive_setup
    install_code
    install_deps
    create_env
    build_app
    setup_pm2

    echo ""
    echo -e "${BOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║${NC}  ${GREEN}Installation complete!${NC}                                  ${BOLD}║${NC}"
    echo -e "${BOLD}╠═══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC}  ${CYAN}URL:${NC}      http://localhost:$PORT                           ${BOLD}║${NC}"
    if [ -n "$PASSWORD" ]; then
    echo -e "${BOLD}║${NC}  ${CYAN}Password:${NC} $PASSWORD                                        ${BOLD}║${NC}"
    fi
    echo -e "${BOLD}║${NC}  ${CYAN}Repo:${NC}     $TARGET_REPO ${BOLD}║${NC}"
    echo -e "${BOLD}╠═══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC}  ${YELLOW}Commands:${NC}                                               ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}    pm2 logs $PM2_NAME                                   ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}    pm2 restart $PM2_NAME                                ${BOLD}║${NC}"
    echo -e "${BOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

main
