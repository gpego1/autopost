-- =====================================================================
-- AutoPost — Supabase Schema
-- Paste this entire file into Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- =====================================================================
-- TABLE: profiles
-- One row per registered user. id mirrors auth.users.id.
-- =====================================================================
create table if not exists public.profiles (
    id          uuid        primary key references auth.users (id) on delete cascade,
    full_name   text,
    avatar_url  text,
    plan        text        not null default 'free',
    created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
    on public.profiles for select
    using (auth.uid() = id);

create policy "profiles_insert_own"
    on public.profiles for insert
    with check (auth.uid() = id);

create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id);

-- =====================================================================
-- TRIGGER: create a profile row automatically when a user signs up
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, avatar_url)
    values (
        new.id,
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'avatar_url'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute procedure public.handle_new_user();

-- =====================================================================
-- TABLE: social_accounts
-- Connected OAuth accounts. Tokens stored as bytea, encrypted at the
-- application layer (Fernet/ENCRYPT_KEY) — never plaintext in the DB.
-- =====================================================================
create table if not exists public.social_accounts (
    id                  uuid        primary key default gen_random_uuid(),
    user_id             uuid        not null references public.profiles (id) on delete cascade,
    platform            text        not null,   -- instagram | facebook | linkedin
    account_name        text        not null,
    platform_user_id    text        not null,
    access_token        bytea,
    refresh_token       bytea,
    token_expires_at    timestamptz,
    is_active           boolean     not null default true,
    created_at          timestamptz not null default now(),

    constraint uq_social_accounts_user_platform_id
        unique (user_id, platform, platform_user_id)
);

create index if not exists ix_social_accounts_user_id
    on public.social_accounts (user_id);

alter table public.social_accounts enable row level security;

create policy "social_accounts_own_rows"
    on public.social_accounts for all
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- =====================================================================
-- TABLE: posts
-- =====================================================================
create table if not exists public.posts (
    id              uuid        primary key default gen_random_uuid(),
    user_id         uuid        not null references public.profiles (id) on delete cascade,
    title           text,
    content         text        not null,
    media_urls      text[]      not null default '{}',
    platforms       text[]      not null default '{}',
    -- draft | scheduled | publishing | done | failed
    status          text        not null default 'draft',
    scheduled_at    timestamptz,
    published_at    timestamptz,
    error_log       text,
    created_at      timestamptz not null default now()
);

create index if not exists ix_posts_user_id      on public.posts (user_id);
create index if not exists ix_posts_status       on public.posts (status);
create index if not exists ix_posts_scheduled_at on public.posts (scheduled_at);

alter table public.posts enable row level security;

create policy "posts_own_rows"
    on public.posts for all
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- =====================================================================
-- TABLE: publish_jobs
-- One row per platform per scheduled post.
-- =====================================================================
create table if not exists public.publish_jobs (
    id          uuid        primary key default gen_random_uuid(),
    post_id     uuid        not null references public.posts (id) on delete cascade,
    platform    text        not null,               -- instagram | facebook | linkedin
    method      text        not null default 'graph_api', -- graph_api | selenium
    -- pending | running | retrying | done | failed
    status      text        not null default 'pending',
    attempts    integer     not null default 0,
    last_error  text,
    executed_at timestamptz
);

create index if not exists ix_publish_jobs_post_id on public.publish_jobs (post_id);
create index if not exists ix_publish_jobs_status  on public.publish_jobs (status);

alter table public.publish_jobs enable row level security;

-- Jobs visible only to the owner of the parent post
create policy "publish_jobs_own_rows"
    on public.publish_jobs for all
    using (
        exists (
            select 1 from public.posts
            where posts.id      = publish_jobs.post_id
              and posts.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.posts
            where posts.id      = publish_jobs.post_id
              and posts.user_id = auth.uid()
        )
    );
