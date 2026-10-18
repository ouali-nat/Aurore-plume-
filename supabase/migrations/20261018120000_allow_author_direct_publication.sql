-- Allow a connected author to choose public or private visibility for their own work.
-- Existing row-level security policies still restrict writes to author_id = auth.uid().
grant insert (publication_status, is_public, published_at)
  on public.plume_works to authenticated;

grant update (publication_status, is_public, published_at)
  on public.plume_works to authenticated;

comment on table public.plume_works is
  'Author-owned drafts and published works. Authors may choose visibility for their own works; RLS restricts each write to the owning author.';
