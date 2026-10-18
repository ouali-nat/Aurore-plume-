-- Fields used by the dedicated Aurore Plume text editor.
-- This migration was applied to the Aurore Plume Supabase project.
ALTER TABLE public.plume_works
  ADD COLUMN IF NOT EXISTS cover_media_key text;

ALTER TABLE public.plume_works
  ADD COLUMN IF NOT EXISTS editorial_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
