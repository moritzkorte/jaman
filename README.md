# Personal Dashboard

A set of small, self-contained HTML apps that share a top bar.

## Deploy your own copy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRowanThistlebrooke%2FYTdashh1)

One click → Vercel signs you in, copies the repo to your GitHub, and deploys it. ~30 seconds to a live URL.

## How to use

Open any `.html` file directly in your browser — no build step, no install.

| File | What it is |
|---|---|
| [index.html](index.html) | Goals tracker (Day Ring, Goal Ticker, To Do list) — the home page |
| [health.html](health.html) | Supplement / daily stack tracker |
| [po-water.html](po-water.html) | Water intake tracker |
| [finance.html](finance.html) | Finances |
| [gym.html](gym.html) | Progressive overload gym tracker |
| [topbar.js](topbar.js) | Shared top bar — auto-injected into pages that `<script src="topbar.js">` |

Each app stores its own state in browser `localStorage`. No accounts, no server.

## Cloud sync setup

Supabase sync needs two public browser values:

- Project URL: `https://zsngolrittdtyqhgdwxi.supabase.co`
- Publishable key: copy it in Supabase under **Project Settings -> API**

Paste both values into these constants:

- `sync.js`: `SUPABASE_URL`, `SUPABASE_KEY`
- `topbar.js`: `TOPBAR_SUPABASE_URL`, `TOPBAR_SUPABASE_KEY`
- `gym.html`: `SUPABASE_URL`, `SUPABASE_KEY`

The database migration for `app_state` and the `progress-photos` Storage bucket has already been applied to the Supabase project named `meine app`. If you use a different Supabase project later, run the SQL from the `SQL` and `Gym fix 2` files in the SQL repo again.

## Building from scratch

[BUILD_DASHBOARD.md](BUILD_DASHBOARD.md) is the prompt I gave Claude to generate `index.html` — paste it into Claude if you want to rebuild that page yourself.
