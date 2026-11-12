-- CineHub: optional logo for each server. Run once in Supabase → SQL Editor.
alter table public.cinehub_servers add column if not exists logo_url text;
