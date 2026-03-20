# System Architecture

## Overview
Green Corridor is a Next.js app with Supabase backend & AI microservices.

## Components
- UI: `/app`, `/components`
- API routes: `/app/api/*`
- AI logic: `/lib/ai`
- Data store: Supabase (Postgres + realtime)

## Data flow
1. Citizen request -> emergency API
2. Dispatcher + AI chooses ambulance
3. Routing + traffic data updates
4. Hospital & traffic updates published
