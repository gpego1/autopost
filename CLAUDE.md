# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoPost is a social media scheduling platform. Users connect Facebook, Instagram, and LinkedIn accounts via OAuth, compose posts, schedule them, and a Vercel Cron Job publishes them at the scheduled time.

## Architecture

**Backend** (`backend/`) — FastAPI + async SQLAlchemy + PostgreSQL (via Supabase). Deployed as a Vercel Serverless Function via `api/index.py` (Mangum ASGI adapter). `api/index.py` inserts `backend/` into `sys.path` so `app.main:app` is importable. Vercel rewrites all `/api/*` requests to `api/index.py`.

**Frontend** (`frontend/`) — React 18 + Vite + TanStack Query + Tailwind CSS, deployed as a Vercel static site. React Router v6 with `<ProtectedRoute>` gating authenticated pages.

**Scheduled publishing** — Vercel Cron Job calls `POST /api/jobs/process-due` at `0 3 * * *` UTC (midnight São Paulo, UTC-3), configured in `vercel.json`. The endpoint uses `SELECT FOR UPDATE SKIP LOCKED` so concurrent invocations never pick up the same post twice.

**Database** — `NullPool` is intentional in `backend/app/database.py`; serverless functions must not maintain a persistent connection pool.

### Frontend routes

Defined in `frontend/src/App.tsx`. Public routes: `/login`, `/register`, `/privacy-policy`, `/data-deletion`. Protected (require auth): `/dashboard`, `/composer`, `/composer/:id` (edit), `/calendar`, `/accounts`, `/history`. All unmatched paths redirect to `/dashboard`.

### Auth flow

Supabase handles user auth. The frontend attaches the Supabase JWT as a Bearer token on every request (`frontend/src/services/api.ts`). The backend verifies the JWT in `backend/app/core/security.py:verify_supabase_jwt` — ES256/RS256 path fetches JWKS from Supabase (cached 5 min), HS256 path uses `SUPABASE_JWT_SECRET` as fallback. User UUID is extracted from the `sub` claim.

After login the frontend must call `POST /api/auth/profile` to upsert the profile row — profiles are not auto-created on signup.

### Publish pipeline

1. `POST /api/posts/` → creates post; status is `scheduled` if `scheduled_at` is provided at creation, otherwise `draft`
2. `POST /api/posts/{id}/schedule` → sets `scheduled_at`, creates one `PublishJob` row per platform (with `social_account_id`), status becomes `scheduled`
3. Cron fires `POST /api/jobs/process-due` → `run_due_posts()` claims all due posts atomically (sets status to `publishing` before publishing begins), then publishes each
4. `_publish()` in `backend/app/workers/publish_task.py` decrypts the OAuth token and calls the platform service
5. Post status transitions: `draft` → `scheduled` → `publishing` → `done` / `failed`
6. Jobs retry up to 3 times (status `retrying`); after 3 failures status becomes `failed`
7. `PublishJob.social_account_id` was added in migration `002`; a fallback query (by `user_id` + `platform`) handles jobs created before that migration

### OAuth token storage

Tokens are encrypted at rest with Fernet symmetric encryption (`LargeBinary` column). Use `encrypt_token` / `decrypt_token` from `backend/app/core/security.py`. `ENCRYPT_KEY` must be a URL-safe base64-encoded 32-byte key.

### Platform services

- `backend/app/services/facebook_service.py` — Facebook Graph API v19.0, photo upload + feed post, retries on rate-limit codes 17/32/613 with exponential backoff
- `backend/app/services/instagram_service.py` — Instagram via Graph API
- `backend/app/services/linkedin_service.py` — LinkedIn v2 API; tokens have an expiry stored in `token_expires_at`
- `backend/app/services/selenium_service.py` — Selenium fallback, not wired into the publish flow

The OAuth redirect URI is validated against an allowlist (`settings.frontend_url` + localhost) in `backend/app/api/accounts.py:_validate_redirect_uri`.

## Development Commands

### Backend

There are two `requirements.txt` files: `backend/requirements.txt` for local dev (includes `python-jose`, `supabase`, `passlib`) and `api/requirements.txt` for the Vercel serverless function. When adding a dependency needed at runtime in production, update both.

```bash
cd backend

pip install -r requirements.txt

cp .env.example .env   # fill in env vars

alembic upgrade head

# New migration after model changes (run from backend/)
alembic revision --autogenerate -m "description"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

npm install

cp .env.example .env   # fill in env vars

npm run dev            # http://localhost:5173

npm run build          # tsc + vite build
```

In dev, Vite proxies `/api/*` to `http://localhost:8000`. The `@` alias resolves to `frontend/src/` (e.g. `import { Post } from '@/types'`). In production, `VITE_API_URL` is left unset so the frontend hits the same domain's `/api/*` routes.

## Environment Variables

**Backend** (`backend/.env`):
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`
- `DATABASE_URL` — asyncpg format: `postgresql+asyncpg://...`
- `ENCRYPT_KEY` — URL-safe base64 32-byte key
- `CRON_SECRET` — Vercel injects this into cron request headers; the cron endpoint checks `Authorization: Bearer <CRON_SECRET>`. In dev, call `POST /api/jobs/process-due` with `Authorization: Bearer ` (empty string after `Bearer `) if left unset
- `META_APP_ID`, `META_APP_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `FRONTEND_URL` — defaults to `http://localhost:5173`; controls CORS and redirect URI allowlist
- `SENTRY_DSN` — optional; enables Sentry tracing at 10% sample rate
- `ENVIRONMENT` — defaults to `development`; sets log level (DEBUG in dev, INFO otherwise)

**Frontend** (`frontend/.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

## Testing & Linting

There are no tests and no linting/formatting configuration in this repo.

## Key Patterns

- All API routes depend on `get_current_user_id` — always scope DB queries to the authenticated `user_id`
- `get_db` auto-commits on success and rolls back on exception
- SQLAlchemy models use `mapped_column` with explicit `UUID(as_uuid=True)` for PostgreSQL UUIDs; `platforms` and `media_urls` are `ARRAY(Text)` columns
- `profiles.id` must equal the Supabase `auth.users.id` UUID — it is not auto-generated
- Frontend API calls use the axios instance in `frontend/src/services/api.ts`; a 401 response attempts a session refresh before signing out
- TanStack Query hooks live in `frontend/src/hooks/`; query client config is in `frontend/src/lib/queryClient.ts`
- Shared TypeScript types (Post, PublishJob, SocialAccount, Platform, etc.) are in `frontend/src/types/index.ts`
- Forms use `react-hook-form` with `zod` resolvers; `date-fns` handles date formatting in the frontend

### OAuth flow (frontend side)

Before redirecting the user to the provider, `Accounts.tsx` writes `sessionStorage.setItem('oauth_platform', 'facebook' | 'linkedin')`. When the provider redirects back to `/accounts?code=...`, a `useEffect` reads `?code` and `sessionStorage.getItem('oauth_platform')`, then calls the backend callback endpoint. This `useRef`-guarded effect fires only once. The `REDIRECT_URI` is always `window.location.origin + '/accounts'`.

### OAuth callback pattern (important)

`meta_oauth_callback` and `linkedin_oauth_callback` in `backend/app/api/accounts.py` do **not** use `Depends(get_db)`. They open `AsyncSessionLocal()` manually, **only after** all external HTTP calls complete. Reason: `Depends(get_db)` opens the DB connection before the function body, so the connection sits idle during 3 Meta API calls (~seconds); PgBouncer closes idle connections and the DB operations then fail. Never refactor these callbacks to use `Depends(get_db)`.

### Database / PgBouncer

`backend/app/database.py:_resolve_db_url` auto-converts `db.<ref>.supabase.co:5432` to the Supabase **Session Pooler** (`aws-0-us-east-1.pooler.supabase.com:5432`). The production `DATABASE_URL` already uses the Session Pooler directly. `NullPool` + `statement_cache_size=0` are both required. Do not switch to a connection pool or remove these settings.

### datetime / timezone handling

- Cron always runs in UTC; `0 3 * * *` = midnight São Paulo (UTC-3).
- `datetime-local` inputs are local time; use `new Date(scheduledAt).toISOString()` to convert to UTC before sending.
- Dates from the API have no `Z` suffix; append `'Z'` before passing to `new Date()` so browsers interpret them as UTC, not local time.

### Publish-now endpoint

`POST /api/posts/{id}/publish-now` (`backend/app/api/posts.py`) allows immediate publishing of `scheduled` or `failed` posts. The button appears on hover in `PostCard` for those statuses.

## Current state (2026-06-07)

### What works (verified end-to-end)
- Creating, scheduling, and publishing posts — confirmed a live Facebook post published successfully.
- `POST /api/posts/{id}/publish-now` works and actually publishes to Facebook.
- Timezone is displayed correctly in PostCard and Composer (no more +3 hour offset).

### Open issue: Facebook OAuth callback (connecting a new account)

`POST /api/accounts/connect/meta/callback` still returns 500 intermittently. The likely cause is a PgBouncer connection issue during Vercel cold starts — all DB-dependent endpoints fail for ~10–20 seconds after a cold start.

**What was tried:**
- Moved DB session open to after HTTP calls — deployed in commit `914c3a3`.
- Added top-level `try/except` with `logger.exception` to surface the full traceback — deployed in commit `0567322`.

**Next step:** Have the user try to connect Facebook again after a cold start. The `logger.exception` wrapper will now write the full Python traceback to Vercel logs. Fetch logs with the Vercel MCP (`get_runtime_logs`, project `prj_X3eYfNhRb7ZPMSXyPN4y4aF4MuoD`, team `team_bVAEU5rN0oQXkOkJvVL7s1vM`) and search for `"meta_oauth_callback unhandled exception"` to find the root cause.
