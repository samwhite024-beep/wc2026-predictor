# ⚽ WC 2026 Score Predictor

A real-time score prediction web app for FIFA World Cup 2026. Built with React + Vite + Supabase.

## Features

- 🧑 Name-based entry (no login required)
- 📋 Predict all 72 group stage matches + knockout rounds
- 🔢 Auto-scoring: 3pts exact, 1pt correct result
- 🏆 Live leaderboard with real-time updates
- 📊 Charts: points progression, lucky/skilled scatter, upset tracker
- 🔒 Admin dashboard (PIN-protected) for entering results
- 🔀 Tiebreaker questions

---

## 🚀 Quick Setup

### 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy your **Project URL** and **anon public key** from Settings → API
3. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
   - This creates all tables, the leaderboard view, RLS policies, and seeds all 104 matches

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_PIN=MARSH2026          # Change this!
VITE_DEADLINE=2026-06-10T20:00:00 # Prediction deadline
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## 🌐 Deploy to Vercel (free)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. In Vercel project settings → **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PIN`
   - `VITE_DEADLINE`
4. Click **Deploy** — done. Vercel gives you a URL like `your-project.vercel.app`

Subsequent pushes to `main` auto-redeploy.

---

## 📱 How it works

### For players
1. Visit the site → click **Make Your Predictions**
2. Enter your name (same name = loads existing predictions)
3. Fill in home/away scores for all group stage matches + tiebreakers
4. Hit **Save** — predictions stored instantly
5. Come back any time to edit until the deadline

### For admin (you — Sam)
1. Go to `/admin` → enter the PIN
2. **Enter Results**: as matches finish, type the score and click Save
   - Points auto-calculate for all players instantly
3. **Open/Close Rounds**: control which rounds players can predict
   - Group stage is open by default
   - Open Round of 32 when those teams are confirmed, etc.
4. **Leaderboard** updates in real-time for all players

---

## 📐 Scaling

| Players  | Cost    | Notes |
|----------|---------|-------|
| Up to 500 | Free   | Supabase free tier (500MB storage, 50k rows/month) |
| 500–5,000 | $25/mo | Supabase Pro |
| 5,000+   | $25+/mo | Still cheap — auto-scales |

**To change player cap**: There's no hard limit in the code — just remove the 20-player assumption from the admin dashboard if needed. Supabase handles the rest.

**To add login**: Replace the name-based flow with Supabase Auth (email magic link or Google OAuth). Takes about 2 hours to add.

**To add a custom domain**: In Vercel project settings → Domains → add your domain. Free SSL included.

---

## 🗂 Project structure

```
src/
  lib/
    supabase.js    — Supabase client
    scoring.js     — Points calculation + flags + constants
  pages/
    Home.jsx       — Landing page + countdown + mini leaderboard
    Predict.jsx    — Player prediction form
    Leaderboard.jsx — Full leaderboard + charts
    Admin.jsx      — Admin dashboard
  App.jsx          — Router + Navbar
supabase/
  schema.sql       — Database setup (run this once)
```
