-- CineHub Music: "Add by link". Run once in Supabase → SQL Editor, after music.sql.
-- Lets the admin save a YouTube / YouTube Music link or a direct audio URL
-- as a song. Existing uploaded songs are not changed.

alter table public.music_tracks add column if not exists provider text;
alter table public.music_tracks add column if not exists provider_id text;
alter table public.music_tracks alter column audio_path drop not null;
alter table public.music_tracks alter column audio_url set default '';
