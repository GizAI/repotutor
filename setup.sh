#!/bin/bash
# Giz Code - 자동 설치 스크립트
# Linux에서 모든 기능이 자동으로 동작하도록 설정

set -e

echo "╔════════════════════════════════════════════════╗"
echo "║  Giz Code 설치 스크립트                        ║"
echo "║  코드베이스 탐색 & AI 가이드                   ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 의존성 체크
check_dependency() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 설치됨"
        return 0
    else
        echo -e "${RED}✗${NC} $1 미설치"
        return 1
    fi
}

echo "1. 의존성 확인..."
echo ""

MISSING_DEPS=0

# Node.js 체크
if check_dependency node; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}  ⚠ Node.js v18+ 필요 (현재: $(node -v))${NC}"
        MISSING_DEPS=1
    fi
else
    MISSING_DEPS=1
fi

# pnpm 체크
if ! check_dependency pnpm; then
    echo -e "${YELLOW}  → npm install -g pnpm 으로 설치 가능${NC}"
    MISSING_DEPS=1
fi

# 선택적: VNC (Desktop 기능)
echo ""
echo "선택적 의존성 (Desktop 기능):"
if check_dependency Xvnc; then
    echo -e "${GREEN}  ✓ TigerVNC 설치됨 - Desktop 기능 사용 가능${NC}"
else
    echo -e "${YELLOW}  ⚠ TigerVNC 미설치 - Desktop 기능 비활성화${NC}"
    echo -e "  → Ubuntu: sudo apt install tigervnc-standalone-server"
    echo -e "  → Arch: sudo pacman -S tigervnc"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo -e "${RED}필수 의존성이 없습니다. 위 안내에 따라 설치 후 다시 실행하세요.${NC}"
    exit 1
fi

echo ""
echo "2. 패키지 설치..."
pnpm install

echo ""
echo "3. 환경 설정..."

# .env.local 생성
if [ -f .env.local ]; then
    echo -e "${YELLOW}  .env.local 이미 존재 - 건너뜀${NC}"
else
    echo "  .env.local 생성 중..."

    # REPO_PATH
    read -p "  탐색할 저장소 경로 (기본: 현재 디렉토리): " REPO_PATH
    REPO_PATH=${REPO_PATH:-$(pwd)}

    # API Key
    echo ""
    echo "  AI 챗봇을 사용하려면 API 키가 필요합니다."
    echo "  (없으면 Enter - 챗봇 기능 비활성화)"
    read -p "  Anthropic API Key: " ANTHROPIC_KEY

    # VNC 설정
    VNC_CONFIG=""
    if command -v Xvnc &> /dev/null; then
        echo ""
        read -p "  VNC 포트 (기본: 5904): " VNC_PORT
        VNC_PORT=${VNC_PORT:-5904}
        read -p "  VNC 디스플레이 (기본: :4): " VNC_DISPLAY
        VNC_DISPLAY=${VNC_DISPLAY:-:4}
        VNC_CONFIG="
# VNC - TigerVNC
VNC_PORT=$VNC_PORT
VNC_DISPLAY=$VNC_DISPLAY"
    fi

    # .env.local 작성
    cat > .env.local << EOF
# Giz Code Environment Variables

# 탐색할 저장소 경로
REPO_PATH=$REPO_PATH

# AI API Keys
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
$VNC_CONFIG
EOF

    echo -e "${GREEN}  ✓ .env.local 생성 완료${NC}"
fi

echo ""
echo "4. VNC 서버 설정..."

if command -v Xvnc &> /dev/null; then
    # VNC 설정 읽기
    VNC_DISPLAY=$(grep VNC_DISPLAY .env.local 2>/dev/null | cut -d'=' -f2 || echo ":4")
    VNC_PORT=$(grep VNC_PORT .env.local 2>/dev/null | cut -d'=' -f2 || echo "5904")

    # VNC 서버 실행 여부 확인
    if pgrep -f "Xvnc.*$VNC_DISPLAY" > /dev/null; then
        echo -e "${GREEN}  ✓ VNC 서버 이미 실행 중 ($VNC_DISPLAY)${NC}"
    else
        echo "  VNC 서버 시작..."
        # VNC 비밀번호 설정 (없으면 생성)
        if [ ! -f ~/.vnc/passwd ]; then
            echo "  VNC 비밀번호를 설정하세요:"
            vncpasswd
        fi

        # Xvnc 시작 (AcceptSetDesktopSize=1 for Remote Resizing)
        Xvnc $VNC_DISPLAY -rfbport $VNC_PORT -geometry 1920x1080 -depth 24 \
             -SecurityTypes VncAuth -PasswordFile ~/.vnc/passwd \
             -AcceptSetDesktopSize=1 &
        sleep 2

        # 데스크탑 환경 시작 (있으면)
        if command -v startxfce4 &> /dev/null; then
            DISPLAY=$VNC_DISPLAY startxfce4 &
        elif command -v mate-session &> /dev/null; then
            DISPLAY=$VNC_DISPLAY mate-session &
        elif command -v cinnamon-session &> /dev/null; then
            DISPLAY=$VNC_DISPLAY cinnamon-session &
        else
            echo -e "${YELLOW}  ⚠ 데스크탑 환경 없음 - 수동 시작 필요${NC}"
        fi

        echo -e "${GREEN}  ✓ VNC 서버 시작됨 ($VNC_DISPLAY, 포트 $VNC_PORT)${NC}"
    fi
else
    echo -e "${YELLOW}  VNC 미설치 - Desktop 기능 건너뜀${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  설치 완료!                                    ║"
echo "╠════════════════════════════════════════════════╣"
echo "║  실행: pnpm dev                                ║"
echo "║  접속: http://localhost:6001                   ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "빌드 후 운영 실행:"
echo "  pnpm build && pnpm start"
