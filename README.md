# 🏆 TriviaRoyale

AI-powered multiplayer elimination trivia bot for Discord. Players take turns answering questions — wrong answer or timeout means elimination. Last one standing wins.

---

## Features

- AI-generated questions via Groq (free, 14,400 req/day)
- 12 built-in topic packs + custom topic support
- 2–6 players per game
- Elimination rounds — wrong answer = you're out
- Speed-based scoring (3 / 2 / 1 pts based on how fast you answer)
- 20 second timer per question
- Full lobby system with topic selector
- Podium + scoreboard at the end

---

## Commands

| Command | Description |
|---|---|
| `/trivia` | Start a new game (host picks topics, others join) |
| `/trivia rounds:7` | Set rounds per player (3–10, default 5) |
| `/trivia difficulty:hard` | Set difficulty: easy / medium / hard / mixed |
| `/trivia custom_topic:Bollywood` | Add a custom topic to the pool |

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/trivia-royale.git
cd trivia-royale
npm install
```

### 2. Create Discord Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → give it a name
3. Go to **Bot** tab → click **Add Bot**
4. Under **Token** → click **Reset Token** → copy it
5. Scroll down → enable **applications.commands** scope
6. Go to **OAuth2 → URL Generator**
   - Scopes: `bot` + `applications.commands`
   - Bot Permissions: `Send Messages`, `Read Message History`, `Embed Links`, `Use Application Commands`
7. Copy the generated URL → open it → invite bot to your server

### 3. Get Groq API Key (Free)

1. Go to [groq.com](https://groq.com) → **Start Building**
2. Sign in with Google
3. Go to [console.groq.com](https://console.groq.com) → **API Keys**
4. Click **Create API Key** → copy the key (`gsk_...`)

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id
GUILD_ID=your_dev_server_id_here
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

> `CLIENT_ID` — found in Discord Dev Portal → Your App → General Information → Application ID  
> `GUILD_ID` — right-click your Discord server → Copy Server ID (enable Developer Mode first)  
> Remove `GUILD_ID` line when deploying to production (commands will register globally)

### 5. Run locally

```bash
npm start
```

---

## Hosting

### Option 1 — KataBump (recommended, free)

[katabump.com](https://katabump.com/en/) offers free Node.js bot hosting.

1. Sign up at [katabump.com](https://katabump.com/en/)
2. Create a new service → select **Node.js**
3. Upload your files (zip without `node_modules`)
4. Set environment variables in the dashboard:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GROQ_API_KEY`
5. Set start command: `node index.js`
6. Deploy

> Remove `GUILD_ID` from env on KataBump so commands register globally.

---

### Option 2 — Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Go to **Variables** tab → add all env vars
5. Railway auto-detects `npm start` and deploys

---

### Option 3 — Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Build command: `npm install`
5. Start command: `node index.js`
6. Add environment variables
7. Deploy

> Use the free tier — select the lowest instance type.

---

### Option 4 — VPS (DigitalOcean / Contabo / any Linux server)

```bash
git clone https://github.com/yourusername/trivia-royale.git
cd trivia-royale
npm install
cp .env.example .env
nano .env
npm install -g pm2
pm2 start index.js --name trivia-royale
pm2 save
pm2 startup
```

---

## Project Structure

```
trivia-royale/
├── index.js              ← bot entry point + command registration
├── TriviaGame.js         ← game state + Groq API logic
├── commands/
│   └── trivia.js         ← /trivia slash command
├── .env.example
├── .gitignore
└── package.json
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token from Discord Dev Portal |
| `CLIENT_ID` | ✅ | Application ID from Discord Dev Portal |
| `GROQ_API_KEY` | ✅ | API key from console.groq.com |
| `GUILD_ID` | ❌ | Dev server ID — commands register instantly. Remove for global. |

---

## Tech Stack

- [discord.js v14](https://discord.js.org)
- [Groq API](https://groq.com) — `llama-3.3-70b-versatile`
- Node.js 18+
