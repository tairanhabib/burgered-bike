# The Burger Bike 🍔🚲

A blue bike with a burger bell, loose in Boston. People scan a QR code on the
bike and ring in a photo of where they spotted it. Live map, sighting counter,
"guess where it'll be," badges, and a monthly gift-card draw.

Stack: React + Vite + Supabase (Storage + Postgres) + Vercel.

---

## Quick start

You only need **Node.js** (v18+) installed on your machine. Check with `node -v`.
If it errors, install the LTS build from https://nodejs.org. Everything else
installs into this folder.

### 1. Set up Supabase
1. Create a free project at https://supabase.com
2. SQL Editor → paste in `supabase-setup.sql` → Run
3. Settings → API → copy your **Project URL** and **anon public** key

### 2. Run it locally
Your Supabase URL and publishable key are already baked into
`src/lib/supabase.js`, so no `.env.local` is needed.
```bash
npm install
npm run dev
```
Open http://localhost:5173 — a submit should land in your Supabase Table Editor.
New sightings come in unapproved, so they won't show on the board until you
approve them (flip the `approved` checkbox in the Table Editor).

### 3. Push to GitHub + keep-alive
Create a repo and push (this includes `.github/workflows/keepalive.yml`, which
pings Supabase daily so the free project never pauses). In the repo:
Settings → Secrets and variables → Actions → add `SUPABASE_URL` and
`SUPABASE_ANON_KEY` (same values). Run the workflow once from the Actions tab to
confirm it passes.

### 4. Deploy on Vercel
Import the repo at https://vercel.com and deploy — no environment variables
needed, since the keys are baked into the source. (If you ever rotate the keys,
add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel and they'll
override the defaults.)

### 5. Domain
Buy a name at Cloudflare Registrar or Porkbun (flat pricing). In Vercel:
Settings → Domains → add it and follow the DNS instructions. SSL is automatic.

### 6. QR code
```bash
npx qrcode "https://yourdomain.com" -o bike.png
```
Print ~2in, laminate, mount on the bike.

---

## Before launch
- Set `RELEASE_DATE` in `src/BurgerBike.jsx` to the day you let the bike loose.
- Approve sightings as they come in.
- The monthly draw query is at the bottom of `supabase-setup.sql`.
- If you ever upgrade off the free tiers, keep spend caps on.
