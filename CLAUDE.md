# CLAUDE.md

Project: **thefanture** — an immersive text-based narrative simulator platform (PWA).
Players inhabit fictional worlds through novel-style prose powered by LLMs.

Full product spec lives in this repo: `沉浸式敘事模擬器平台_整合規劃.md`. **Read it before building.**

## Stack
- Frontend: Vue 3 + Vite. PWA via `vite-plugin-pwa`.
- Backend: Node.js + Express.
- Database: PostgreSQL. Manage schema with migrations (Prisma Migrate or node-pg-migrate). Keep it portable; no platform-locked DB features.
- AI: Anthropic API (`claude-opus-4-8`) and Google Gemini API. Use official SDKs.

## Workflow (important)
- Plan before implementing. State the plan first, then build.
- Build one module at a time; verify each before moving on. Do NOT generate the whole app at once.
- Ask before large refactors or destructive operations.
- Follow the development order in the spec. Start with: backend accounts + daily usage counting.

## Security boundaries (non-negotiable)
- API keys live ONLY on the backend, loaded from `.env`. Never expose them to the frontend or client bundle.
- `.env` is gitignored. NEVER commit secrets.
- Daily usage counting is backend-only and concurrency-safe (atomic increment, e.g. `UPDATE ... RETURNING`).
- Conversation content is encrypted client-side (Web Crypto: AES-GCM; key derivation via PBKDF2). The backend stores ciphertext only and must never see plaintext or keys.
- Envelope encryption: the content key is wrapped by both a password-derived key and a recovery-code-derived key (spec §6).

## Cost discipline (the main cost driver)
- Output tokens dominate cost and cannot be cached. Cap responses with `max_tokens` (~500).
- Use prompt caching: keep the system prompt stable (cacheable threshold is 1024 tokens for Opus 4.8). Never put per-turn-changing content (timestamps, random greetings) before the cache breakpoint.
- Model tiering: free = Gemini Pro or Sonnet (3 turns/day); paid = Gemini Pro or Opus (20 turns/day).
- The daily turn cap is shared across ALL worlds, per user (one global counter).
- Keep a backend global daily spend ceiling AND a per-user cap.

## Content & copy conventions
- All user-facing content and game prose is **Traditional Chinese with full-width punctuation**（。，、「」：；！？）.
- Game prose avoids an "AI tone" and does NOT use em-dashes (—).
- Static text (intros, onboarding flavor, save-block recaps) is pre-written and stored, NOT generated each turn (cost).
- Do NOT copy or paste copyrighted source text (book/film passages) into prompts or content. Write original prose set in these worlds. Note the IP/licensing risk for commercial use (spec §21).

## Architecture: worlds are data, not code
- A "world" (simulator) = a World Definition record: name, intro copy, system prompt, onboarding config, save-block template, assets, model/quota rules.
- Adding a new world is authoring data, not changing engine code (spec §22).

## UI direction
- Style: **dark academia**. Detailed visual design is decided separately; do not hardcode aesthetic guesses without confirmation.

## Project structure
```
thefanture/
├── backend/          Node.js + Express API
│   ├── prisma/       schema.prisma + migrations
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   ├── middleware/auth.js
│   │   └── routes/   auth.js, usage.js, (ai.js next)
│   └── .env.example
└── frontend/         Vue 3 + Vite + PWA
    └── vite.config.js
```

## Commands
- Backend dev: `cd backend && npm run dev`
- Frontend dev: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`
- DB migrate: `cd backend && npx prisma migrate dev`
- DB studio: `cd backend && npx prisma studio`

## Setup (first time)
1. `cd backend && npm install`
2. Copy `backend/.env.example` → `backend/.env` and fill values
3. `cd backend && npx prisma migrate dev --name init`
4. `cd frontend && npm install`
