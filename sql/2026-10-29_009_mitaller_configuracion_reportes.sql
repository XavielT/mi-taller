-- =====================================================================================
-- Mi Taller · 2026-10-29 · 009 · configuración del taller (datos, ITBIS, logo) y reporte 607
-- Las escrituras de `talleres` pasan a RPC: la política de update directo permitía tocar `contadores`
-- (numeración de OT y facturas) y `config` sin validar.
-- =====================================================================================

drop policy if exists talleres_update on mitaller.talleres;

create or replace function mitaller.actualizar_taller(
  p_taller uuid,
  p_nombre text,
  p_rnc text default null,
  p_telefono text default null,
  p_email text default null,
  p_direccion text default null,
  p_itbis numeric default 18,
  p_dias_vencimiento int default 30
) returns mitaller.talleres
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_rnc text := nullif(btrim(coalesce(p_rnc, '')), '');
  v_taller mitaller.talleres;
begin
  perform mitaller._exigir_admin_taller(p_taller);
  if nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'El nombre del taller es requerido';
  end if;
  if v_rnc is not null and v_rnc !~ '^([0-9]{9}|[0-9]{11})$' then
    raise exception 'El RNC debe tener 9 u 11 dígitos';
  end if;
  if p_itbis is null or p_itbis < 0 or p_itbis > 100 then
    raise exception 'El ITBIS debe estar entre 0 y 100';
  end if;
  if p_dias_vencimiento is null or p_dias_vencimiento < 0 or p_dias_vencimiento > 365 then
    raise exception 'Los días de vencimiento deben estar entre 0 y 365';
  end if;

  update mitaller.talleres
     set nombre = btrim(p_nombre),
         rnc = v_rnc,
         telefono = nullif(btrim(coalesce(p_telefono, '')), ''),
         email = nullif(btrim(coalesce(p_email, '')), ''),
         direccion = nullif(btrim(coalesce(p_direccion, '')), ''),
         config = coalesce(config, '{}'::jsonb) || jsonb_build_object('itbis', p_itbis, 'dias_vencimiento', p_dias_vencimiento)
   where id = p_taller
  returning * into v_taller;
  if not found then
    raise exception 'El taller no existe';
  end if;
  return v_taller;
end;
$$;

-- p_url debe apuntar al bucket público mt-logos dentro de la carpeta del propio taller (o ser null para quitar el logo).
create or replace function mitaller.definir_logo(p_taller uuid, p_url text) returns mitaller.talleres
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_taller mitaller.talleres;
begin
  perform mitaller._exigir_admin_taller(p_taller);
  if p_url is not null and p_url not like '%/storage/v1/object/public/mt-logos/' || p_taller::text || '/%' then
    raise exception 'La imagen del logo no es válida';
  end if;
  update mitaller.talleres set logo_url = p_url where id = p_taller returning * into v_taller;
  return v_taller;
end;
$$;

-- Storage: bucket público mt-logos (path: <taller_id>/logo-<n>.<ext>); solo propietario/administrador escriben.
create or replace function mitaller.es_admin_path(p_name text) returns boolean
language sql stable security definer set search_path = mitaller, public as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then coalesce(mitaller.rol_en_taller(((storage.foldername(p_name))[1])::uuid) in ('propietario', 'administrador'), false)
    else false
  end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mt-logos', 'mt-logos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy mt_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'mt-logos' and mitaller.es_admin_path(name));
create policy mt_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'mt-logos' and mitaller.es_admin_path(name))
  with check (bucket_id = 'mt-logos' and mitaller.es_admin_path(name));
create policy mt_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'mt-logos' and mitaller.es_admin_path(name));

-- -------------------------------------------------------------------------------------
-- Reporte 607 (ventas) de la DGII: una fila por factura no anulada del período.
-- Es una ayuda para el contador: revisa el formato vigente de la DGII antes de declarar.
-- -------------------------------------------------------------------------------------
create or replace function mitaller.reporte_607(p_taller uuid, p_desde date, p_hasta date)
returns table (
  numero text,
  rnc_cedula text,
  tipo_id int,
  cliente text,
  ncf text,
  tipo_ingreso text,
  fecha_comprobante date,
  monto_facturado numeric,
  itbis_facturado numeric,
  efectivo numeric,
  transferencia numeric,
  tarjeta numeric,
  otro numeric,
  credito numeric
)
language plpgsql stable set search_path = mitaller, public as $$
#variable_conflict use_column
begin
  if not mitaller.es_miembro(p_taller) then
    raise exception 'No tienes acceso a este taller';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'El rango de fechas no es válido';
  end if;
  return query
  select f.numero,
         nullif(regexp_replace(coalesce(c.documento, ''), '[^0-9]', '', 'g'), ''),
         case length(regexp_replace(coalesce(c.documento, ''), '[^0-9]', '', 'g')) when 9 then 1 when 11 then 2 else null end,
         c.nombre,
         f.ncf,
         '01'::text,
         f.fecha_emision,
         f.subtotal,
         f.itbis,
         coalesce(p.efectivo, 0)::numeric,
         coalesce(p.transferencia, 0)::numeric,
         coalesce(p.tarjeta, 0)::numeric,
         coalesce(p.otro, 0)::numeric,
         (f.total - coalesce(p.pagado, 0))::numeric
  from mitaller.facturas f
  left join mitaller.clientes c on c.id = f.cliente_id
  left join lateral (
    select sum(pg.monto) filter (where pg.metodo = 'efectivo') as efectivo,
           sum(pg.monto) filter (where pg.metodo = 'transferencia') as transferencia,
           sum(pg.monto) filter (where pg.metodo = 'tarjeta') as tarjeta,
           sum(pg.monto) filter (where pg.metodo = 'otro') as otro,
           sum(pg.monto) as pagado
    from mitaller.pagos pg where pg.factura_id = f.id
  ) p on true
  where f.taller_id = p_taller and f.estado <> 'anulada' and f.fecha_emision between p_desde and p_hasta
  order by f.fecha_emision, f.numero;
end;
$$;

revoke execute on all functions in schema mitaller from public, anon;
grant execute on all functions in schema mitaller to authenticated;
revoke execute on function mitaller._mover_stock(uuid, uuid, mitaller.tipo_movimiento, numeric, text, uuid, text) from authenticated;
revoke execute on function mitaller.orden_items_stock_trg() from authenticated;
revoke execute on function mitaller.ordenes_cancelar_stock_trg() from authenticated;
revoke execute on function mitaller.ordenes_borrar_stock_trg() from authenticated;
revoke execute on function mitaller._exigir_admin_taller(uuid) from authenticated;
revoke execute on function mitaller._limite_plan(uuid, text) from authenticated;
grant execute on function mitaller.ver_invitacion(text) to anon;
