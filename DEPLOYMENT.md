# Deploying Ghost Interview (free tier)

This project deploys as **one free Render web service** that serves both the
built React frontend and the Express API from a single URL, connected to your
existing **MongoDB Atlas** cluster. Serving both from one origin means the
httpOnly refresh cookie stays first‑party (no CORS/cross‑site cookie setup) and
there is only one thing to deploy.

**Total cost: $0** (Render free web service + MongoDB Atlas free M0 tier).

> **Free‑tier limitation (important):** Render's free web service *sleeps after
> ~15 minutes of inactivity*. The first request after it sleeps takes ~30–60
> seconds to wake up; subsequent requests are instant. This is fine for a
> demo/FYP defense. (Optional keep‑alive tip is at the end.)

Everything that can be automated is already done for you: the repo contains a
`render.yaml` blueprint, a build script that compiles the React app and copies
it into the backend, and the backend already serves the SPA in production. You
only need to do the steps that require **your** accounts/logins.

---

## What you'll need
- A **GitHub** (or GitLab/Bitbucket) account — to host the code Render pulls from.
- A **Render** account (sign up with GitHub) — to run the app.
- Your existing **MongoDB Atlas** account — to allow Render to connect.

---

## Step 1 — Push a deployment branch to your existing GitHub repo

The local project and the existing GitHub `main` branch have unrelated Git
histories. Push the project as a new `render-deploy` branch so the existing
`main` is preserved. Your secrets (`backend/.env`) are excluded from Git.

1. In a terminal at the project root, run:

   ```bash
   git push https://github.com/waseemfarhat/Ghost-interview.git main:render-deploy
   ```

   This creates/updates only the `render-deploy` branch; it does not replace
   `main`. GitHub may prompt you to sign in.

---

## Step 2 — Allow MongoDB Atlas to accept Render's connection (requires your Atlas login)

Render uses dynamic outbound IPs, so Atlas must allow connections from anywhere.

1. Open https://cloud.mongodb.com → your project → **Network Access**.
2. Click **+ Add IP Address** → **Allow Access from Anywhere** → **Confirm**.
   (This adds `0.0.0.0/0`. Your database is still protected by your username +
   password in the connection string.)

> Already have `0.0.0.0/0` in the list? Skip this step.

---

## Step 3 — Deploy on Render (requires your Render login)

1. Go to https://dashboard.render.com → **New +** → **Blueprint**.
2. Connect your GitHub and select `waseemfarhat/Ghost-interview`, then select
   the `render-deploy` branch. Render reads the included `render.yaml` and
   shows one service: **ghost-interview**.
3. Render will ask you to fill in the **secret** environment variables (these
   are NOT stored in the repo — they stay private in Render). Copy the values
   from your local `backend/.env`:

   | Render env var | Copy from your `backend/.env` |
   |----------------|-------------------------------|
   | `MONGO_URI` | `MONGO_URI` |
   | `JWT_ACCESS_SECRET` | `JWT_ACCESS_SECRET` |
   | `JWT_REFRESH_SECRET` | `JWT_REFRESH_SECRET` |
   | `SMTP_PASS` | `SMTP_PASS` (leave blank if you don't send real email) |

   All other variables (`NODE_ENV`, `CLIENT_URL`, expiry times, etc.) are
   already set in `render.yaml`.
4. Click **Apply** / **Create**. Render builds and deploys automatically. The
   build runs the React build, copies it into the backend, installs the API
   dependencies, and starts the server.
5. When it finishes, Render shows a live URL like
   `https://ghost-interview.onrender.com`. Open it — your app is live. ✅

---

## Step 4 — Set the correct public URL (one small update)

The app's password‑reset email links use `CLIENT_URL`, which defaults to
`https://ghost-interview.onrender.com` in `render.yaml`.

- If your Render URL is exactly that, you're done.
- If Render assigned a different URL (e.g. it appended characters because the
  name was taken), go to the service → **Environment** → set `CLIENT_URL` to
  your actual URL → **Save** (Render redeploys automatically).

---

## Step 5 — (Optional) Seed an admin account

Your existing Atlas database already contains the default job roles, so the
app works immediately. If you want an admin login:

1. In Render, open your service → **Shell** tab.
2. Run (choose your own email/password):

   ```bash
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='YourStrongPass1' node src/utils/seed.js
   ```

   Then log in at your live URL with those credentials.

---

## Optional: reduce free‑tier cold starts

The free service sleeps when idle. To keep it warm, you can ping
`https://<your-url>/api/health` every 10–14 minutes with a free external
cron (e.g. cron-job.org). This is optional and only matters for demos.

---

## Redeploying after code changes

Just commit and push to `main`; Render auto‑deploys on every push:

```bash
git add -A && git commit -m "your change" && git push
```
