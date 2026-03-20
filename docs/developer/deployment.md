# Deployment Guide

## 1. Vercel
- Connect GitHub repo in Vercel.
- Set env vars from `.env.local`.
- Deploy branch.

## 2. Supabase
- Ensure database and auth config exists.
- Run migrations in production project.

## 3. Post-deploy
- Test `/health` and core API endpoints.
- Monitor logs and analyze metrics.
