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
curl -fsSL https://raw.githubusercontent.com/GizAI/code/main/install.sh | bash -s -- --repo ~/myproject
```

With options:

```bash
curl -fsSL https://raw.githubusercontent.com/GizAI/code/main/install.sh | bash -s -- \
  --repo ~/myproject \
  --password secret \
  --port 3000 \
  --api-key sk-ant-xxx
```

| Option | Description | Default |
|--------|-------------|---------|
| `--repo PATH` | Target repository | (required) |
| `--password PASS` | Password for web access | (none) |
| `--port PORT` | Gateway port | 3000 |
| `--api-key KEY` | Anthropic API key | (none) |
| `--name NAME` | PM2 process name | giz-code |
| `--dir PATH` | Installation directory | ~/giz-code |

---

## Features

| Tab | Description |
|-----|-------------|
| **Browse** | File tree, syntax highlighting, image/PDF preview |
| **Chat** | AI chatbot for code Q&A |
| **Terminal** | Web terminal with PTY |
| **Desktop** | VNC remote desktop |

---

## Development

```bash
git clone https://github.com/GizAI/code.git
cd code
npm install

cp .env.example .env.local
# Edit: REPO_PATH, ANTHROPIC_API_KEY

npm run dev  # http://localhost:6001
```

### Port Convention

| Mode | Next.js | Gateway |
|------|---------|---------|
| Development | 3000 (internal) | 6001 |
| Production | 7001 | 7002 |

Gateway handles all traffic (HTTP proxy + WebSocket).

---

## Production Build

```bash
npm run build  # Includes static file copy for standalone
npm start      # Or use PM2
```

### PM2 Setup

```bash
# Using ecosystem config
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start on reboot
```

---

## Server Deployment

### 1. Sync Code

```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git --exclude .env.local \
  ~/code/ user@server:~/giz-code/
```

### 2. Server Setup

```bash
ssh user@server
cd ~/giz-code
npm install
npm run build

# Configure
cat > .env.local << EOF
REPO_PATH=/path/to/repo
PORT=7002
NEXT_PORT=7001
REPOTUTOR_PASSWORD=secret
ANTHROPIC_API_KEY=sk-ant-xxx
EOF

# PM2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

### 3. Nginx (Optional)

```nginx
server {
    listen 80;
    server_name code.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name code.example.com;

    ssl_certificate /etc/letsencrypt/live/code.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/code.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:7002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }
}
```

```bash
sudo certbot --nginx -d code.example.com
```

---

## VNC Desktop

Install TigerVNC for Desktop feature:

```bash
sudo apt install tigervnc-standalone-server

# Start VNC
Xvnc :4 -rfbport 5904 -geometry 1920x1080 -depth 24 \
     -SecurityTypes None -AcceptSetDesktopSize=1 &
export DISPLAY=:4
```

Configure in `.env.local`:

```bash
VNC_PORT=5904
VNC_DISPLAY=:4
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REPO_PATH` | Target repository path | Yes |
| `ANTHROPIC_API_KEY` | Claude API key | For Chat |
| `GIZ_CODE_PASSWORD` | Password protection (recommended) | No |
| `REPOTUTOR_PASSWORD` | Password protection (legacy alias) | No |
| `PORT` | Gateway port | No (3000) |
| `NEXT_PORT` | Next.js port | No (3000) |
| `VNC_PORT` | VNC server port | For Desktop |
| `VNC_DISPLAY` | X display | For Desktop |

**Note:** Authentication is enforced at gateway level. All routes except `/login`, `/api/auth/*`, `/_next/*`, `/locales/*` require authentication when password is set.

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| npm install fails | Dependency conflict | Use `pnpm install` |
| node-pty build fails | Missing make | `apt install build-essential` |
| Blank page on 7002 | Static files missing | `npm run build` (includes postbuild) |
| Gateway uses wrong port | Missing .env.local | Set PORT in .env.local |
| VNC connection refused | Auth mismatch | Use `-SecurityTypes None` |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│             Gateway (PORT)                  │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │   Next.js   │  │   WebSocket Proxy    │  │
│  │   Proxy     │  │  - Socket.IO (PTY)   │  │
│  │             │  │  - VNC WebSocket     │  │
│  └─────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │ REPO_PATH │        │ TigerVNC │
   │  (files)  │        │  (VNC)   │
   └──────────┘        └──────────┘
```

---

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Node.js, Socket.IO
- **Terminal**: xterm.js, node-pty
- **VNC**: novnc-next, TigerVNC
- **AI**: Anthropic Claude API

---

## License

MIT License - [LICENSE](LICENSE)

<div align="center">
  <sub>Built by <a href="https://giz.ai">GizAI</a></sub>
</div>
