# Giz Code

<div align="center">

![Giz Code](https://img.shields.io/badge/Giz%20Code-Explore-00FF00?style=for-the-badge&logo=bookstack&logoColor=white)

**코드베이스 탐색 & AI 가이드 - 어떤 저장소든 대화형으로 탐색**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)

</div>

---

## 기능

| 탭 | 설명 |
|---|---|
| **Browse** | 파일 트리 탐색, 코드 하이라이팅, 이미지/PDF 미리보기 |
| **Chat** | AI 챗봇으로 코드 질문, 설명, 분석 |
| **Terminal** | 웹 터미널로 직접 명령어 실행 |
| **Desktop** | VNC로 원격 데스크탑 접속 (TigerVNC) |

## 빠른 시작

### 1. 자동 설치 (권장)

```bash
git clone https://github.com/GizAI/code.git
cd code
./setup.sh
```

### 2. 수동 설치

```bash
# 의존성 설치
pnpm install

# 환경 설정
cp .env.example .env.local
# .env.local 편집하여 REPO_PATH와 API 키 설정

# 개발 서버 실행
pnpm dev
```

http://localhost:6001 접속

## 환경 설정

`.env.local` 파일:

```bash
# 탐색할 저장소 경로 (필수)
REPO_PATH=/path/to/your/repository

# AI 챗봇 API 키 (선택 - 없으면 챗봇 비활성화)
ANTHROPIC_API_KEY=sk-ant-...

# VNC - Desktop 기능 (선택)
VNC_PORT=5904
VNC_DISPLAY=:4
```

## 아키텍처

```
┌─────────────────────────────────────────────┐
│                 Gateway (6001)              │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │   Next.js   │  │   WebSocket Proxy    │  │
│  │   (3000)    │  │  - Socket.IO         │  │
│  │             │  │  - VNC WebSocket     │  │
│  └─────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │  REPO_PATH │        │  TigerVNC │
   │  (files)  │        │  (5904)   │
   └──────────┘        └──────────┘
```

## 개발

```bash
# 개발 서버 (Next.js + Gateway 동시 실행)
pnpm dev

# 빌드
pnpm build

# 운영 실행
pnpm start
```

### 포트

| 용도 | 개발 | 운영 |
|-----|------|------|
| Gateway (메인) | 6001 | 7001 |
| Next.js (내부) | 3000 | 3000 |
| VNC | 5904 | 5904 |

## VNC Desktop 설정

Desktop 기능을 사용하려면 TigerVNC 설치:

```bash
# Ubuntu/Debian
sudo apt install tigervnc-standalone-server

# Arch Linux
sudo pacman -S tigervnc

# VNC 서버 시작 (Remote Resizing 지원)
Xvnc :4 -rfbport 5904 -geometry 1920x1080 -depth 24 \
     -SecurityTypes VncAuth -AcceptSetDesktopSize=1
```

## 기술 스택

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Socket.IO
- **Terminal**: xterm.js, node-pty
- **VNC**: novnc-next (noVNC fork for Next.js)
- **AI**: Anthropic Claude API

## 라이선스

MIT License - [LICENSE](LICENSE)

---

<div align="center">
  <sub>Built by <a href="https://giz.ai">GizAI</a></sub>
</div>
