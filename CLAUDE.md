# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoPost is a social media scheduling platform. Users connect Facebook, Instagram, and LinkedIn accounts via OAuth, compose posts, schedule them, and a Celery worker publishes them at the scheduled time.

## Architecture

**Backend** (`backend/`) — FastAPI + async SQLAlchemy + PostgreSQL (via Supabase), deployed as a Vercel Serverless Function via `api/index.py` (Mangum ASGI adapter)

**Frontend** (`frontend/`) — React 18 + Vite + TanStack Query + Tailwind CSS, deployed as Vercel Static Site

**Scheduled publishing** — Vercel Cron Job calls `POST /api/jobs/process-due` every minute; the endpoint queries for `scheduled` posts with `scheduled_at <= now()` and publishes them. No Redis or Celery required.

### Auth flow

Supabase handles all user auth (sign-up, login, session management). The frontend attaches the Supabase JWT as a Bearer token on every API request (`frontend/src/services/api.ts`). The backend verifies the JWT using `SUPABASE_JWT_SECRET` (`backend/app/core/security.py:verify_supabase_jwt`) and extracts the user UUID from the `sub` claim.

### Publish pipeline

1. User creates a post via `POST /api/posts/` → status `draft` or `scheduled`
2. User triggers scheduling via `POST /api/posts/{id}/schedule` → creates `PublishJob` rows (one per platform), sets `scheduled_at`, status becomes `scheduled`
3. Vercel Cron fires `POST /api/jobs/process-due` every minute → calls `run_due_posts()` → finds all posts where `status = scheduled AND scheduled_at <= now`
4. `publish_post()` in `backend/app/workers/publish_task.py` decrypts the OAuth token, calls the platform service, updates job + post status
5. Post status transitions: `draft` → `scheduled` → `publishing` → `done` / `failed`
6. Failed jobs are retried up to 3 times on subsequent cron ticks (status = `retrying`)

### OAuth token storage

Tokens are encrypted at rest with Fernet symmetric encryption. `ENCRYPT_KEY` must be a base64-encoded 32-byte key. Use `encrypt_token` / `decrypt_token` from `backend/app/core/security.py` — never store plaintext tokens.

### Platform services

- `backend/app/services/facebook_service.py` — Facebook Graph API v19.0, handles photo upload + feed post, retries on rate limit codes 17/32/613
- `backend/app/services/instagram_service.py` — Instagram via Graph API
- `backend/app/services/linkedin_service.py` — LinkedIn v2 API
- `backend/app/services/selenium_service.py` — Selenium fallback (not wired into the main publish flow)

## Development Commands

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Copy and fill in env vars
cp .env.example .env

# Run database migrations
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "description"

# Start API server (hot-reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and fill in env vars
cp .env.example .env

# Start dev server (http://localhost:5173)
npm run dev

# Type-check and build
npm run build
```

## Environment Variables

**Backend** (`backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL` (asyncpg format: `postgresql+asyncpg://...`), `ENCRYPT_KEY`, `CRON_SECRET`, `META_APP_ID`, `META_APP_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`

**Vercel env vars** (set in Vercel dashboard, mirror of backend .env for production): same keys as above. Vercel automatically injects `CRON_SECRET` into cron request headers — set the same value in both places.

**Frontend** (`frontend/.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

## Key Patterns

- All API routes require `get_current_user_id` dependency — always scope DB queries to the authenticated `user_id`
- `get_db` dependency auto-commits on success and rolls back on exception
- SQLAlchemy models use `mapped_column` with explicit `UUID(as_uuid=True)` for PostgreSQL UUIDs
- Frontend API calls go through the axios instance in `frontend/src/services/api.ts` which automatically injects the Supabase session token; a 401 triggers sign-out
- TanStack Query hooks live in `frontend/src/hooks/`; React Query client config is in `frontend/src/lib/queryClient.ts`
