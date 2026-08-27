-- GEOGESTAO-UI-ACESSIBILIDADE-PROFISSIONAL-1
-- Preferencias visuais adicionais por usuario. Migration incremental.

alter table if exists public.user_preferences
  add column if not exists lightweight_mode boolean not null default false;

notify pgrst, 'reload schema';
