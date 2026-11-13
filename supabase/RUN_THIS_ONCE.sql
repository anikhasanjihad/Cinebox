-- CineHub: run this once in Supabase → SQL Editor.
-- Adds an optional logo for each server (shown on the Home "Servers" row,
-- in both the mobile app and the desktop app).
alter table public.cinehub_servers add column if not exists logo_url text;

-- OPTIONAL clean-up for the removed Music feature. This DELETES the songs
-- table and its data. Leave it commented out unless you want that.
-- drop table if exists public.music_tracks cascade;
