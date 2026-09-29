# Plate

Mobile-first nutrition tracker: snap a meal photo, Claude breaks it into ingredients with estimated
grams, and meal totals are always the sum of those ingredients. Edit any ingredient's weight and
everything recalculates.

**Stack:** Next.js 16 (App Router) · Tailwind v4 + shadcn/ui (Base UI) · Supabase (Auth, Postgres + RLS, Storage) · Claude API (`claude-opus-5-5`)

## Setup

1. **Supabase project** (supabase.com → New project)
   - SQL Editor → paste [`supabase/schema.sql`](supabase/schema.sql) → Run. Creates tables, row-level security, the `meal-photos` bucket and a trigger that creates a profile row for each new user.
   - Authentication → URL Configuration: Site URL `http://localhost:3000`, and add `http://localhost:3000/auth/callback` to Redirect URLs (add your Vercel URL later too).
   - Optional for faster testing: Authentication → Sign In / Providers → Email → turn off "Confirm email".
2. **Claude API key**: console.anthropic.com → API Keys.
3. **Env vars**: fill in `.env.local` (template in `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API; the anon/publishable key)
   - `ANTHROPIC_API_KEY`
4. `npm install` then `npm run dev` → http://localhost:3000

**Google sign-in (optional):** create an OAuth client in Google Cloud Console, then enable Google under Supabase → Authentication → Providers with its client ID/secret.

## How it works

| Piece | Where |
|---|---|
| Mifflin-St Jeor targets, ingredient scaling, totals | `src/lib/nutrition.ts` |
| Built-in food database (~290 foods, per 100 g) + search | `src/lib/foods.ts` |
| AI: photo analysis, day coach, ingredient lookup (server actions) | `src/app/actions/ai.ts`, `src/lib/ai/` |
| Meal CRUD + photo upload (browser → Supabase Storage) | `src/lib/meals.ts` |
| Session refresh + route protection | `src/proxy.ts` |
| "Continue as" account switcher | `src/lib/accounts.ts`, `src/app/auth/page.tsx` |

Photos are resized in the browser (≤1568 px JPEG), uploaded to the user's private folder in
Storage, and the server action reads them from there. This keeps requests under the 1 MB
server-action limit.
