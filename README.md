# Ghost Interview — AI Mock Interviewer

Full-stack implementation of the FYP described in the Scope Document, SRS, and SDD
(Ehsan Hamza & Shaharyar Altaf, COMSATS Vehari).

> **🚀 Want to deploy it online for free?** See [`DEPLOYMENT.md`](./DEPLOYMENT.md)
> for a step-by-step guide (Render + your existing MongoDB Atlas). The repo is
> already configured with a `render.yaml` blueprint — you mainly just push to
> GitHub and click through Render.


## Architecture

```
frontend/    React 19 + Vite + Tailwind CSS — SPA, served via nginx in production
backend/     Node.js 20 + Express + MongoDB (Mongoose) — REST API
ai-service/  Python + FastAPI — currently a health-check-only stub (see below)
```

**AI provider strategy:** The backend supports Gemini question generation,
OpenAI Whisper transcription, and ElevenLabs question audio when their
server-side keys are configured. Curated questions, browser speech
recognition/synthesis, and browser-side `face-api.js` emotion analysis remain
available as fallbacks. Only microphone audio is uploaded when Whisper is
configured; raw webcam video stays in the browser. Hume/DeepFace provider
integration is not implemented; emotion analysis currently uses the
pre-trained browser model. The `ai-service/` folder remains a health-check
stub and is not used by the application.

**Auth model**: short-lived JWT access token (kept in memory on the client,
sent via `Authorization: Bearer`) + long-lived refresh token in an `httpOnly`,
`Secure`, `SameSite=strict` cookie. See `backend/src/utils/tokens.js` for the
full rationale.

## Current status

- ✅ **Auth & authorization**: register, login, refresh, logout, logout-all,
  forgot/reset password, change password, brute-force lockout, role-based
  access control
- ✅ **AI Interview module**: job role selection → live interview (AI avatar
  speaks each question via TTS, candidate answers by voice with live
  speech-to-text, webcam emotion detection runs throughout) → automatic
  filler-word and sentiment analysis per answer → Confidence & Competency
  Report generation (confidence, competency, communication, emotional
  stability, overall readiness, strengths/improvement areas, emotion
  distribution) with one-click **PDF export** of the report → interview
  history dashboard
- ✅ **Admin panel**: user management (search, suspend/reactivate, delete),
  job role management (create/edit/deactivate roles and their question
  banks), platform-wide analytics
- ✅ Security: rate limiting, NoSQL-injection sanitization, CSRF-guarded
  refresh endpoint, ownership checks on every session/report endpoint
- **Remaining validation:** real-device camera/microphone testing, provider
  tests with valid service keys, load testing, uptime/backup verification,
  and production HTTPS deployment still need to be completed.

## What's been verified

- Backend unit tests: run with `cd backend && npm test`. Tests cover AI
  provider response handling/fallbacks and report metrics.
- Backend regression scripts (added during the verification pass):
  - `npm run test:smoke` — boots the Express app in-process and checks the
    request pipeline (health, 404 handler, Zod validation, JWT auth guard,
    CSRF header guard, NoSQL-injection sanitization) with no database needed.
  - `npm run test:e2e` — runs the full candidate workflow against the
    configured MongoDB (register → login → refresh → role select → start
    session → submit answer + emotion batch → complete → fetch report), plus
    ownership and RBAC checks. It creates throwaway `*_smoke_*` records and
    deletes them all at the end.
- Frontend: `npm run build` and `npm run lint` are available from `frontend/`.
  The build has a known large-chunk warning for the interview/emotion bundle;
  lint has two existing Fast Refresh warnings in the auth/theme contexts.
- **Not yet verified:** a full browser interview using a physical
  camera/microphone, live paid-provider credentials, 50 concurrent sessions,
  99% uptime, database restore, or the production TLS profile.

## Design system ("Aurora Intelligence")

The UI is built on a custom design system defined in `frontend/src/index.css`
— no UI/CSS framework beyond Tailwind v4, and no extra runtime dependencies
for styling or animation (all effects are pure CSS keyframes/utilities).

- **Palette:** indigo→violet→fuchsia primary gradient with a teal accent for
  data/positive signals; layered light/dark surface tokens via CSS variables.
- **Effects:** glass surfaces (`.gi-glass`), aurora background blooms
  (`.gi-aurora`), gradient text/borders (`.gi-gradient-text`,
  `.gi-gradient-border`), interactive card lift (`.gi-lift`), and glow.
- **Motion:** fade/slide/scale entrances, staggered reveals (`.gi-stagger`),
  audio-activity bars, and count-up numbers — all gated behind
  `prefers-reduced-motion`.
- **Reusable primitives** (in `components/ui`): `Button`, `Card`, `Input`,
  `Modal`, `ConfirmDialog`, `ScoreBar`, `EmotionDonut`, `ProgressRing`,
  `Skeleton`, `Reveal`, `Aurora`, plus the `useCountUp`/`useInView` hooks.

## Running locally without Docker

**Prerequisites**: Node.js 20+, a MongoDB instance (local `mongod` or a free
MongoDB Atlas cluster), a Chromium-based browser (Chrome/Edge) for full voice
support during interviews.

1. Copy environment templates:
   ```bash
   cp .env.example .env               # reference for docker-compose
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
2. Fill in `backend/.env`: at minimum set `MONGO_URI` (e.g.
  `mongodb://127.0.0.1:27017/ghost_interview`) and generate two strong
  secrets for `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`. Optional AI keys
  (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` plus
  `ELEVENLABS_VOICE_ID`) enable the matching server-side providers. Keep
  them only in `backend/.env`; blank values use the documented fallbacks.
  On networks where Node's DNS resolver cannot resolve MongoDB SRV records,
  set `MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Leave `SMTP_*` blank to have registration/reset emails logged to the
   console instead of actually sent — fine for local development.
3. Install and run the backend:
   ```bash
   cd backend
   npm install
   npm run dev          # http://localhost:5000
   ```
4. Seed an admin account and the default job roles:
   ```bash
   ADMIN_EMAIL=admin@ghostinterview.local ADMIN_PASSWORD=ChangeMe123! npm run seed
   npm run seed:roles
   ```
5. Install and run the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev           # http://localhost:5173
   ```
6. Register a candidate account (or log in as the seeded admin), grant
   camera/microphone permission when prompted, and start an interview from
   the dashboard.

## Running with Docker Compose

```bash
cp .env.example .env    # then fill in JWT secrets at minimum
docker compose up --build
```

Then run the seed commands inside the backend container once it's up:
```bash
docker compose exec backend sh -c "ADMIN_EMAIL=admin@ghostinterview.local ADMIN_PASSWORD=ChangeMe123! npm run seed"
docker compose exec backend npm run seed:roles
```

- Frontend: http://localhost:5173
- Backend API (bound to local machine): http://localhost:5000/api

The Compose stack is HTTP-only by default for local use. For public HTTPS,
set `PUBLIC_DOMAIN` to a DNS name pointing at the host and set `CLIENT_URL`
to `https://<your-domain>`, then run `docker compose --profile production up
--build`. The Caddy profile obtains and renews TLS certificates; ports 80 and
443 must be reachable from the internet. Docker/Caddy deployment has not yet
been exercised in this environment.

## Security notes

- Passwords are hashed with bcrypt (cost factor 12).
- Access tokens are never persisted client-side (no localStorage/sessionStorage) —
  they live only in memory and are lost on tab close, which is intentional.
- The refresh endpoint requires both the `httpOnly` cookie and a custom
  `X-Requested-With` header as a second layer of CSRF defense.
- All Mongo queries go through Mongoose with `express-mongo-sanitize` stripping
  `$`/`.` operator injection from user input.
- Rate limiting is tighter on `/auth/*` routes to slow credential stuffing and
  brute force.
- Every session/report endpoint checks resource ownership (`session.user ===
  req.user.id`) before returning data, in addition to authentication.
- Admin routes require `role: 'admin'`; admins cannot suspend/delete other
  admins or themselves through the API.

## Known SRS/SDD differences

- **Database**: MongoDB, per the SDD.
- Gemini, Whisper, and ElevenLabs are supported but require credentials;
  without them the application uses curated/browser-native fallbacks.
- Hume/DeepFace analysis is specified by the SRS/SDD but not integrated;
  emotion analysis uses a browser-hosted face model instead.
- No raw webcam video is stored or uploaded. Microphone audio is sent to
  Whisper only when that provider is configured; derived transcripts and
  emotion metrics are stored.
- Automated email delivery requires SMTP configuration; development mode
  logs email content instead of delivering it.
- Performance/concurrency, availability, backup/restore, and physical-device
  camera/microphone acceptance criteria still require deployment testing.
