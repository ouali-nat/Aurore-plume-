create table public.plume_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Auteur' check (char_length(display_name) between 1 and 80),
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  bio text not null default '' check (char_length(bio) <= 600),
  avatar_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plume_works (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.plume_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  subtitle text not null default '' check (char_length(subtitle) <= 180),
  summary text not null default '' check (char_length(summary) <= 1200),
  genre text not null default 'Texte libre' check (char_length(genre) <= 60),
  body text not null default '',
  publication_status text not null default 'draft'
    check (publication_status in ('draft','published','rejected','archived')),
  is_public boolean not null default false,
  submission_requested_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plume_works_public_feed_idx
  on public.plume_works (published_at desc nulls last, created_at desc)
  where publication_status = 'published' and is_public = true;
create index plume_works_author_updated_idx
  on public.plume_works (author_id, updated_at desc);

create table public.plume_comments (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.plume_works(id) on delete cascade,
  author_id uuid not null references public.plume_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1600),
  review_status text not null default 'pending'
    check (review_status in ('pending','visible','hidden')),
  created_at timestamptz not null default now()
);

create index plume_comments_work_created_idx on public.plume_comments (work_id, created_at desc);

alter table public.plume_profiles enable row level security;
alter table public.plume_works enable row level security;
alter table public.plume_comments enable row level security;

revoke all on public.plume_profiles, public.plume_works, public.plume_comments from anon, authenticated;
grant select on public.plume_profiles, public.plume_works, public.plume_comments to anon, authenticated;

grant insert (id, display_name, handle, bio, avatar_url, is_public)
  on public.plume_profiles to authenticated;
grant update (display_name, handle, bio, avatar_url, is_public, updated_at)
  on public.plume_profiles to authenticated;
grant delete on public.plume_profiles to authenticated;

grant insert (author_id, title, subtitle, summary, genre, body, submission_requested_at)
  on public.plume_works to authenticated;
grant update (title, subtitle, summary, genre, body, submission_requested_at, updated_at)
  on public.plume_works to authenticated;
grant delete on public.plume_works to authenticated;

grant insert (work_id, author_id, body) on public.plume_comments to authenticated;
grant delete on public.plume_comments to authenticated;

create policy "Public author profiles or own profile"
  on public.plume_profiles for select to anon, authenticated
  using (is_public = true or id = (select auth.uid()));
create policy "Authors create own profile"
  on public.plume_profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "Authors update own profile"
  on public.plume_profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "Authors delete own profile"
  on public.plume_profiles for delete to authenticated
  using (id = (select auth.uid()));

create policy "Published works are public"
  on public.plume_works for select to anon, authenticated
  using (publication_status = 'published' and is_public = true);
create policy "Authors can read own works"
  on public.plume_works for select to authenticated
  using (author_id = (select auth.uid()));
create policy "Authors create own works"
  on public.plume_works for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "Authors update own works"
  on public.plume_works for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "Authors delete own works"
  on public.plume_works for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "Visible comments on published works"
  on public.plume_comments for select to anon, authenticated
  using (
    review_status = 'visible'
    and exists (
      select 1 from public.plume_works w
      where w.id = work_id
        and w.publication_status = 'published'
        and w.is_public = true
    )
  );
create policy "Readers can see own comments"
  on public.plume_comments for select to authenticated
  using (author_id = (select auth.uid()));
create policy "Readers comment as themselves"
  on public.plume_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.plume_works w
      where w.id = work_id
        and w.publication_status = 'published'
        and w.is_public = true
    )
  );
create policy "Readers remove own comments"
  on public.plume_comments for delete to authenticated
  using (author_id = (select auth.uid()));

comment on table public.plume_profiles is 'Public author identity and author-owned profile details for Aurore Plume.';
comment on table public.plume_works is 'Literary drafts and published works. publication_status and is_public are moderation-controlled columns.';
comment on table public.plume_comments is 'Comments on published works. review_status is moderation-controlled.';
