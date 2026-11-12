-- CineHub Music: run once in Supabase → SQL Editor.
-- Everyone signed in can read and stream; only admins (profiles.role = 'admin')
-- can add, edit or delete tracks and upload files.

create or replace function public.is_cinehub_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create table if not exists public.music_tracks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  artist      text not null default '',
  album       text not null default '',
  audio_path  text not null,
  audio_url   text not null,
  cover_path  text,
  cover_url   text,
  mime_type   text,
  size_bytes  bigint,
  duration_ms integer,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists music_tracks_created_idx
  on public.music_tracks (created_at desc);

alter table public.music_tracks enable row level security;

drop policy if exists "music read" on public.music_tracks;
create policy "music read" on public.music_tracks
  for select to authenticated using (true);

drop policy if exists "music admin insert" on public.music_tracks;
create policy "music admin insert" on public.music_tracks
  for insert to authenticated with check (public.is_cinehub_admin());

drop policy if exists "music admin update" on public.music_tracks;
create policy "music admin update" on public.music_tracks
  for update to authenticated
  using (public.is_cinehub_admin()) with check (public.is_cinehub_admin());

drop policy if exists "music admin delete" on public.music_tracks;
create policy "music admin delete" on public.music_tracks
  for delete to authenticated using (public.is_cinehub_admin());

-- Public bucket: audio streams straight from its URL (no token needed by the
-- player). Writing is admin-only. Make the bucket private instead if you want
-- signed URLs; the app then needs a small change.
insert into storage.buckets (id, name, public)
values ('music', 'music', true)
on conflict (id) do update set public = true;

drop policy if exists "music files admin insert" on storage.objects;
create policy "music files admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'music' and public.is_cinehub_admin());

drop policy if exists "music files admin update" on storage.objects;
create policy "music files admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'music' and public.is_cinehub_admin());

drop policy if exists "music files admin delete" on storage.objects;
create policy "music files admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'music' and public.is_cinehub_admin());
