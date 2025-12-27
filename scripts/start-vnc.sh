#!/bin/bash
# Start VNC server (localhost only)
# Giz Code server proxies VNC via /ws/vnc
#
# Usage: ./start-vnc.sh [display]
# Example: ./start-vnc.sh :99

set -e

DISPLAY_NUM=${1:-:99}
VNC_PORT=$((5900 + ${DISPLAY_NUM#:}))

# XDG Runtime directory
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-$HOME/.runtime}"
mkdir -p "$XDG_RUNTIME_DIR"

# Cleanup existing processes
cleanup() {
    echo "Stopping VNC server..."
    pkill -f "tigervncserver.*$DISPLAY_NUM" 2>/dev/null || true
    pkill -f "Xtigervnc.*$DISPLAY_NUM" 2>/dev/null || true
}

trap cleanup EXIT

# Check if tigervnc is installed
if ! command -v tigervncserver &> /dev/null; then
    echo "TigerVNC not found. Installing..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y tigervnc-standalone-server tigervnc-common
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y tigervnc-server
    else
        echo "Error: Cannot install TigerVNC. Please install manually."
        exit 1
    fi
fi

# Create VNC xstartup if not exists
mkdir -p ~/.vnc
if [ ! -f ~/.vnc/xstartup ]; then
    cat > ~/.vnc/xstartup << 'EOF'
#!/bin/bash
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS

# Try to start a desktop environment
if command -v startxfce4 &> /dev/null; then
    exec startxfce4
elif command -v startlxde &> /dev/null; then
    exec startlxde
elif command -v gnome-session &> /dev/null; then
    exec gnome-session
elif command -v xterm &> /dev/null; then
    exec xterm
else
    echo "No desktop environment found"
    sleep infinity
fi
EOF
    chmod +x ~/.vnc/xstartup
fi

# Kill existing VNC session on this display
vncserver -kill $DISPLAY_NUM 2>/dev/null || true
sleep 1

# Start VNC server (localhost only for security)
echo "Starting VNC server on display $DISPLAY_NUM (localhost:$VNC_PORT)..."
tigervncserver $DISPLAY_NUM \
    -xstartup ~/.vnc/xstartup \
    -SecurityTypes None \
    -AlwaysShared \
    -localhost yes \
    -AcceptSetDesktopSize=1 \
    --I-KNOW-THIS-IS-INSECURE \
    2>&1 || {
        echo "Failed to start TigerVNC. Trying vncserver..."
        vncserver $DISPLAY_NUM -geometry 1920x1080 -depth 24 -localhost 2>&1
    }

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  VNC Server Started                        ║"
echo "╠════════════════════════════════════════════╣"
echo "║  Display:  $DISPLAY_NUM                            ║"
echo "║  Port:     localhost:$VNC_PORT                  ║"
echo "║                                            ║"
echo "║  Access via Giz Code:                      ║"
echo "║  - Run: pnpm dev                           ║"
echo "║  - Open 'Desktop' tab                      ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop..."

# Keep script running
while true; do
    sleep 60
    # Check if VNC is still running
    if ! pgrep -f "Xtigervnc.*$DISPLAY_NUM" > /dev/null; then
        echo "VNC server stopped unexpectedly"
        exit 1
    fi
done
