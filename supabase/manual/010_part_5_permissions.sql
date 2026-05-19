-- GEOQUERY-3 / Migration 010 manual split
-- Parte 5: permissoes/reload de schema.
-- A migration original 010 nao adiciona GRANTs nem altera policies.
-- Por isso, este bloco preserva a mesma logica e apenas recarrega o schema do PostgREST.
-- Rode por ultimo no Supabase de teste.

notify pgrst, 'reload schema';
