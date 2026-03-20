# Development Setup

## Prerequisites
- Node.js 18+
- npm
- Git
- Supabase account

## Steps
1. `git clone ...`
2. `npm install --legacy-peer-deps`
3. Copy `.env.local.example` to `.env.local` and set values.
4. Run Supabase migration:
   `npx supabase db push` or use `supabase/migrations` SQL.
5. `npm run dev`
