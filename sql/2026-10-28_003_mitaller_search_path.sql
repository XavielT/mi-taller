-- Mi Taller · 2026-10-28 · 003
-- El advisor de seguridad de Supabase marcó dos funciones auxiliares sin search_path fijo.
-- Migración aditiva: no cambia su comportamiento, solo fija el search_path.

alter function mitaller.set_updated_at() set search_path = mitaller, public;
alter function mitaller.transicion_permitida(mitaller.estado_orden, mitaller.estado_orden) set search_path = mitaller, public;
