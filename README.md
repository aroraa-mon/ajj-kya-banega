# Aaj Kya Banega? (breakfast MVP)

One breakfast answer a day for the family. Today's breakfast is locked; tomorrow's is open for voting until 11:59 pm IST.

## Run it (local)
Node 22 or newer.
```bash
npm install
npm run dev        # http://localhost:3000 (TypeScript via tsx)
npm test           # rules simulation + voting, re-roll and database tests (real SQL)
```
With no `.env`, it uses a local database in `data/pgdata` (same SQL as Supabase), created automatically. Good for trying it out.

## Use Supabase
1. Create a Supabase project.
2. Project Settings > Database > Connection string. Copy the **Session pooler** URI.
3. `cp .env.example .env` and paste it as `DATABASE_URL` (keep this file private; never commit it).
4. `npm run db:setup` creates the tables and loads the dishes and members. Safe to re-run.
5. `npm run dev` (or build + start below).

All data lives in the database: `members`, `dishes`, `day_plans`, `plan_options`, `votes`, `dish_weights` (see `db/schema.sql`). The server connects directly, so everyone's phones see the same votes. Row level security is on with no policies, so the public Supabase API key can't read or change anything.

## Production (Vercel)
`public/` is the static shell (CDN). `api/index.ts` is the Express serverless function; `vercel.json` rewrites `/api/*` there (region `bom1` / Mumbai).

1. One-time schema/seed against Supabase (from your laptop, with `.env` set):
   ```bash
   npm run db:setup
   ```
2. In the [Vercel dashboard](https://vercel.com): **Add New Project** → import `aroraa-mon/ajj-kya-banega` (or your fork).
3. Project → **Settings → General / Build & Development**:
   - Framework Preset: **Other**
   - Build Command: `npm run typecheck` (or leave blank so `vercel.json` applies) — **not** `npm start`
   - Output Directory: leave **empty** (do not set `public` or `dist`)
   - Install Command: `npm install`
   - Node.js Version: **22.x**
4. Project → **Settings → Environment Variables** → add for Production (and Preview if you want):
   - `DATABASE_URL` = your Supabase **Session pooler** URI (same value as local `.env`)
5. Deploy. Open `https://YOUR_PROJECT.vercel.app/api/health` — expect `{"ok":true}` (JSON, not the HTML page).

CLI alternative (after `npm i -g vercel` and login):
```bash
vercel          # preview
vercel --prod   # production
```
When prompted for env, paste `DATABASE_URL`. Do not commit `.env`.

Local/Docker still work the same:
```bash
npm run build && NODE_ENV=production npm start
```

### Production checklist
- [ ] Supabase project created; session pooler URI ready
- [ ] `npm run db:setup` succeeded against that database
- [ ] `DATABASE_URL` set in Vercel Production env
- [ ] `/api/health` returns `{"ok":true}` on the Vercel URL
- [ ] Family can unlock with their PINs on phones

## Edit things
| What | Where |
|---|---|
| The 6 family members, and who is a cook | `data/members.json` (cooks can re-roll and see the surprise early), then `npm run db:setup` |
| Dishes (names, protein, season, caps) | `src/dishes.ts`, then `npm run db:setup` (or edit the `dishes` table directly in Supabase) |
| Rules (repeat gaps, protein target, paratha cap, surprise day) | `src/config.ts` |

## How it decides
1. Hard rules remove dishes: used within 5 days (14 for "occasional"), weekly/monthly caps, out of season, surprise only on Sundays.
2. Protein target (3 high-protein breakfasts a week) boosts high-protein dishes as the week runs out of days.
3. Learned weights: vote winners come up a bit more, cook-rejected dishes a bit less (never below 0.4x or above 2x).
4. Picks are seeded by date, so every phone sees the same answer.

Voting: 1 vote per member (the database also refuses votes after 11:59 pm) (changeable until close). Most votes wins; a tie or no votes keeps the app's pick. The cook's "can't make this" gives one new pick and skips the vote.

Chole Bhature is a surprise: hidden from voting and from non-cooks the day before. Cooks see it so they can soak the chole.

## Not built yet
Week preview, lunch and dinner, WhatsApp delivery, fasting days.
