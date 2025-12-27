# Giz Code

<div align="center">

![Giz Code](https://img.shields.io/badge/Giz%20Code-Explore-00FF00?style=for-the-badge&logo=bookstack&logoColor=white)

**AI-powered codebase explorer - Chat with any repository**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)

</div>

---

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/GizAI/code/main/install.sh | bash
```

Or with options:

```bash
curl -fsSL https://raw.githubusercontent.com/GizAI/code/main/install.sh | bash -s -- \
  --repo ~/myproject \
  --password secret \
  --port 3000 \
  --api-key sk-ant-xxx
```

### Install Options

| Option | Description | Default |
|--------|-------------|---------|
| `--repo PATH` | Target repository to explore | (required) |
| `--password PASS` | Password for web access | (none) |
| `--port PORT` | Port to run on | 3000 |
| `--api-key KEY` | Anthropic API key for AI chat | (none) |
| `--name NAME` | PM2 process name | giz-code |
| `--dir PATH` | Installation directory | ~/giz-code |
| `--no-pm2` | Don't use PM2, just build | false |
| `--dev` | Development mode (skip build) | false |

---

## Features

| Tab | Description |
|-----|-------------|
| **Browse** | File tree, code highlighting, image/PDF preview |
| **Chat** | AI chatbot for code Q&A, analysis |
| **Terminal** | Web terminal for command execution |
| **Desktop** | VNC remote desktop (TigerVNC) |

## Manual Installation

```bash
# Clone
git clone https://github.com/GizAI/code.git
cd code

# Install
npm install

# Configure
cp .env.example .env.local
# Edit .env.local: set REPO_PATH and API key

# Run
npm run dev      # Development
npm run build && npm start  # Production
```

## Environment Variables

`.env.local`:

```bash
# Repository to explore (required)
REPO_PATH=/path/to/your/repository

# AI chatbot API key (optional)
ANTHROPIC_API_KEY=sk-ant-...

# Password protection (optional)
REPOTUTOR_PASSWORD=your-secret

# VNC Desktop (optional)
VNC_PORT=5904
VNC_DISPLAY=:4
```

## Architecture

```
┌─────────────────────────────────────────────┐
│             Gateway (PORT)                  │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │   Next.js   │  │   WebSocket Proxy    │  │
│  │   (3000)    │  │  - Socket.IO         │  │
│  │             │  │  - VNC WebSocket     │  │
│  └─────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │ REPO_PATH │        │ TigerVNC │
   │  (files)  │        │  (5904)  │
   └──────────┘        └──────────┘
```

## PM2 Commands

```bash
# View logs
pm2 logs giz-code

# Restart
pm2 restart giz-code

# Stop
pm2 stop giz-code

# Status
pm2 status
```

## VNC Desktop Setup

For Desktop feature, install TigerVNC:

```bash
# Ubuntu/Debian
sudo apt install tigervnc-standalone-server

# Start VNC
Xvnc :4 -rfbport 5904 -geometry 1920x1080 -depth 24 \
     -SecurityTypes VncAuth -AcceptSetDesktopSize=1
```

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Node.js, Socket.IO
- **Terminal**: xterm.js, node-pty
- **VNC**: novnc-next
- **AI**: Anthropic Claude API

## License

MIT License - [LICENSE](LICENSE)

---

<div align="center">
  <sub>Built by <a href="https://giz.ai">GizAI</a></sub>
</div>
