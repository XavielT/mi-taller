-- Mi Taller · 2026-10-29 · 010 · ajustes del advisor de Supabase (seguridad y rendimiento)
-- Sin cambios de comportamiento: fija el search_path de un helper, evalúa auth.uid() una sola vez por consulta
-- en las políticas RLS y agrega índices a las llaves foráneas que se consultan.

alter function mitaller._hash_token(text) set search_path = pg_catalog, public;

drop policy if exists perfiles_select on mitaller.perfiles;
create policy perfiles_select on mitaller.perfiles for select to authenticated
  using (user_id = (select auth.uid()) or mitaller.comparte_taller(user_id));

drop policy if exists perfiles_insert on mitaller.perfiles;
create policy perfiles_insert on mitaller.perfiles for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists perfiles_update on mitaller.perfiles;
create policy perfiles_update on mitaller.perfiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists admins_plataforma_select on mitaller.admins_plataforma;
create policy admins_plataforma_select on mitaller.admins_plataforma for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists orden_historial_insert on mitaller.orden_historial;
create policy orden_historial_insert on mitaller.orden_historial for insert to authenticated
  with check (mitaller.es_miembro(taller_id) and user_id = (select auth.uid()));

create index if not exists ordenes_sucursal_idx      on mitaller.ordenes_trabajo (sucursal_id);
create index if not exists facturas_sucursal_idx     on mitaller.facturas (sucursal_id);
create index if not exists miembros_sucursal_idx     on mitaller.miembros (sucursal_id);
create index if not exists orden_items_articulo_idx  on mitaller.orden_items (articulo_id);
create index if not exists invitaciones_sucursal_idx on mitaller.invitaciones (sucursal_id);
create index if not exists movimientos_sucursal_idx  on mitaller.movimientos_inventario (sucursal_id);
create index if not exists suscripciones_plan_idx    on mitaller.suscripciones (plan_id);
