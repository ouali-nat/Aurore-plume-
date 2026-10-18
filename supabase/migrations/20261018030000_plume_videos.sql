create table if not exists public.plume_videos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  video_url text not null check (char_length(video_url) <= 1000 and video_url ~* '^https?://'),
  category text not null default 'Création' check (char_length(category) <= 60),
  description text not null default '' check (char_length(description) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plume_videos_author_updated_idx
  on public.plume_videos (author_id, updated_at desc);

alter table public.plume_videos enable row level security;
revoke all on public.plume_videos from anon, authenticated;
grant select on public.plume_videos to authenticated;
grant insert (author_id, title, video_url, category, description) on public.plume_videos to authenticated;
grant update (title, video_url, category, description, updated_at) on public.plume_videos to authenticated;
grant delete on public.plume_videos to authenticated;

create policy "Authors read own videos"
  on public.plume_videos for select to authenticated
  using (author_id = (select auth.uid()));
create policy "Authors create own videos"
  on public.plume_videos for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "Authors update own videos"
  on public.plume_videos for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "Authors delete own videos"
  on public.plume_videos for delete to authenticated
  using (author_id = (select auth.uid()));

comment on table public.plume_videos is 'Private video links saved by each Aurore Plume user.';
