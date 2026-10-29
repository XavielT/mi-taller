-- =====================================================================================
-- Mi Taller · 2026-10-29 · 008 · sucursales y equipo (miembros + invitaciones)
-- Las escrituras de sucursales y miembros pasan a RPC que validan rol y límites del plan (planes.limites).
-- Las invitaciones usan un enlace secreto (token) y NO se ligan al correo: en x-core el correo no se verifica
-- al registrarse, así que "quien tenga ese correo" no prueba nada.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Sucursales
-- -------------------------------------------------------------------------------------
create unique index if not exists sucursales_una_principal_idx on mitaller.sucursales (taller_id) where es_principal;

drop policy if exists sucursales_insert on mitaller.sucursales;
drop policy if exists sucursales_update on mitaller.sucursales;
drop policy if exists sucursales_delete on mitaller.sucursales;

create or replace function mitaller._exigir_admin_taller(p_taller uuid) returns void
language plpgsql stable security definer set search_path = mitaller, public as $$
begin
  if coalesce(mitaller.rol_en_taller(p_taller) in ('propietario', 'administrador'), false) is not true then
    raise exception 'Solo el propietario o un administrador pueden hacer esto';
  end if;
end;
$$;

create or replace function mitaller._limite_plan(p_taller uuid, p_clave text) returns int
language sql stable security definer set search_path = mitaller, public as $$
  select nullif(pl.limites ->> p_clave, '')::int
  from mitaller.suscripciones s
  join mitaller.planes pl on pl.id = s.plan_id
  where s.taller_id = p_taller and s.estado = 'activa'
  limit 1;
$$;

create or replace function mitaller.crear_sucursal(
  p_taller uuid, p_nombre text, p_direccion text default null, p_telefono text default null
) returns mitaller.sucursales
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_limite int;
  v_activas int;
  v_suc mitaller.sucursales;
begin
  perform mitaller._exigir_admin_taller(p_taller);
  if nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'El nombre de la sucursal es requerido';
  end if;
  perform 1 from mitaller.talleres where id = p_taller for update;
  v_limite := mitaller._limite_plan(p_taller, 'sucursales');
  select count(*) into v_activas from mitaller.sucursales where taller_id = p_taller and activa;
  if v_limite is not null and v_activas >= v_limite then
    raise exception 'Tu plan permite hasta % sucursal(es). Mejora tu plan para agregar más.', v_limite;
  end if;
  insert into mitaller.sucursales (taller_id, nombre, direccion, telefono)
  values (p_taller, btrim(p_nombre), nullif(btrim(coalesce(p_direccion, '')), ''), nullif(btrim(coalesce(p_telefono, '')), ''))
  returning * into v_suc;
  return v_suc;
end;
$$;

create or replace function mitaller.actualizar_sucursal(
  p_sucursal uuid, p_nombre text, p_direccion text default null, p_telefono text default null
) returns mitaller.sucursales
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_suc mitaller.sucursales;
begin
  select * into v_suc from mitaller.sucursales where id = p_sucursal;
  if not found then
    raise exception 'La sucursal no existe';
  end if;
  perform mitaller._exigir_admin_taller(v_suc.taller_id);
  if nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'El nombre de la sucursal es requerido';
  end if;
  update mitaller.sucursales
     set nombre = btrim(p_nombre),
         direccion = nullif(btrim(coalesce(p_direccion, '')), ''),
         telefono = nullif(btrim(coalesce(p_telefono, '')), '')
   where id = p_sucursal returning * into v_suc;
  return v_suc;
end;
$$;

create or replace function mitaller.activar_sucursal(p_sucursal uuid, p_activa boolean) returns mitaller.sucursales
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_suc mitaller.sucursales;
  v_abiertas int;
  v_limite int;
  v_activas int;
  v_principal uuid;
begin
  select * into v_suc from mitaller.sucursales where id = p_sucursal for update;
  if not found then
    raise exception 'La sucursal no existe';
  end if;
  perform mitaller._exigir_admin_taller(v_suc.taller_id);

  if p_activa then
    if not v_suc.activa then
      v_limite := mitaller._limite_plan(v_suc.taller_id, 'sucursales');
      select count(*) into v_activas from mitaller.sucursales where taller_id = v_suc.taller_id and activa;
      if v_limite is not null and v_activas >= v_limite then
        raise exception 'Tu plan permite hasta % sucursal(es). Mejora tu plan para activar más.', v_limite;
      end if;
    end if;
  else
    if v_suc.es_principal then
      raise exception 'No puedes desactivar la sucursal principal. Define otra como principal primero.';
    end if;
    select count(*) into v_abiertas from mitaller.ordenes_trabajo
     where sucursal_id = p_sucursal and estado not in ('entregado', 'cancelado');
    if v_abiertas > 0 then
      raise exception 'La sucursal tiene % orden(es) abierta(s). Ciérralas o muévelas antes de desactivarla.', v_abiertas;
    end if;
    select id into v_principal from mitaller.sucursales where taller_id = v_suc.taller_id and es_principal;
    update mitaller.miembros set sucursal_id = v_principal where sucursal_id = p_sucursal;
  end if;

  update mitaller.sucursales set activa = p_activa where id = p_sucursal returning * into v_suc;
  return v_suc;
end;
$$;

create or replace function mitaller.definir_sucursal_principal(p_sucursal uuid) returns mitaller.sucursales
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_suc mitaller.sucursales;
begin
  select * into v_suc from mitaller.sucursales where id = p_sucursal for update;
  if not found then
    raise exception 'La sucursal no existe';
  end if;
  perform mitaller._exigir_admin_taller(v_suc.taller_id);
  if not v_suc.activa then
    raise exception 'Solo una sucursal activa puede ser la principal';
  end if;
  update mitaller.sucursales set es_principal = false where taller_id = v_suc.taller_id and es_principal;
  update mitaller.sucursales set es_principal = true where id = p_sucursal returning * into v_suc;
  return v_suc;
end;
$$;

-- crear_orden: sin sucursal explícita usa la del miembro que recibe el vehículo; si no tiene, la principal.
create or replace function mitaller.crear_orden(
  p_taller uuid,
  p_cliente uuid,
  p_vehiculo uuid,
  p_motivo text,
  p_kilometraje int default null,
  p_combustible int default null,
  p_inventario jsonb default '{}'::jsonb,
  p_fecha_promesa timestamptz default null,
  p_mecanico uuid default null,
  p_sucursal uuid default null
) returns mitaller.ordenes_trabajo
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_limite int;
  v_usadas int;
  v_sucursal uuid := p_sucursal;
  v_orden mitaller.ordenes_trabajo;
begin
  if not mitaller.es_miembro(p_taller) then
    raise exception 'No tienes acceso a este taller';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'El motivo de la visita es requerido';
  end if;
  if p_combustible is not null and (p_combustible < 0 or p_combustible > 100) then
    raise exception 'El nivel de combustible debe estar entre 0 y 100';
  end if;

  if not exists (select 1 from mitaller.clientes where id = p_cliente and taller_id = p_taller) then
    raise exception 'El cliente no existe en este taller';
  end if;
  if not exists (select 1 from mitaller.vehiculos where id = p_vehiculo and taller_id = p_taller and cliente_id = p_cliente) then
    raise exception 'El vehículo no existe o no pertenece a ese cliente';
  end if;
  if p_mecanico is not null and not exists (
       select 1 from mitaller.miembros
       where taller_id = p_taller and user_id = p_mecanico and activo and rol = 'mecanico') then
    raise exception 'El mecánico seleccionado no pertenece a este taller';
  end if;

  if v_sucursal is null then
    select m.sucursal_id into v_sucursal
    from mitaller.miembros m
    join mitaller.sucursales s on s.id = m.sucursal_id and s.activa
    where m.taller_id = p_taller and m.user_id = auth.uid() and m.activo;
    if v_sucursal is null then
      select id into v_sucursal from mitaller.sucursales
      where taller_id = p_taller and es_principal order by created_at limit 1;
    end if;
  elsif not exists (select 1 from mitaller.sucursales where id = v_sucursal and taller_id = p_taller and activa) then
    raise exception 'La sucursal no existe o está desactivada';
  end if;

  perform 1 from mitaller.talleres where id = p_taller for update;

  v_limite := mitaller._limite_plan(p_taller, 'ordenes_mes');
  if v_limite is not null then
    select count(*) into v_usadas from mitaller.ordenes_trabajo
    where taller_id = p_taller and created_at >= date_trunc('month', now());
    if v_usadas >= v_limite then
      raise exception 'Alcanzaste el límite de % órdenes por mes de tu plan. Mejora tu plan para seguir recibiendo vehículos.', v_limite;
    end if;
  end if;

  insert into mitaller.ordenes_trabajo (
    taller_id, sucursal_id, numero, cliente_id, vehiculo_id, motivo,
    kilometraje_entrada, nivel_combustible, inventario_entrada,
    fecha_promesa, mecanico_id, recibido_por
  ) values (
    p_taller, v_sucursal, mitaller.siguiente_numero(p_taller, 'orden'), p_cliente, p_vehiculo, btrim(p_motivo),
    p_kilometraje, p_combustible, coalesce(p_inventario, '{}'::jsonb),
    p_fecha_promesa, p_mecanico, auth.uid()
  ) returning * into v_orden;

  insert into mitaller.orden_historial (taller_id, orden_id, de_estado, a_estado, user_id, comentario)
  values (p_taller, v_orden.id, null, 'recepcion', auth.uid(), 'Vehículo recibido');

  if p_kilometraje is not null then
    update mitaller.vehiculos set kilometraje = p_kilometraje where id = p_vehiculo and taller_id = p_taller;
  end if;

  return v_orden;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Equipo: invitaciones y gestión de miembros
-- -------------------------------------------------------------------------------------
create table mitaller.invitaciones (
  id           uuid primary key default gen_random_uuid(),
  taller_id    uuid not null references mitaller.talleres(id) on delete cascade,
  etiqueta     text,
  rol          mitaller.rol_miembro not null,
  sucursal_id  uuid references mitaller.sucursales(id) on delete set null,
  token_hash   text not null unique,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'cancelada')),
  expira_en    timestamptz not null default now() + interval '7 days',
  invitado_por uuid references auth.users(id),
  aceptada_por uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  check (rol <> 'propietario')
);
create index invitaciones_taller_idx on mitaller.invitaciones (taller_id, estado);
create trigger invitaciones_set_updated_at before update on mitaller.invitaciones
  for each row execute function mitaller.set_updated_at();

alter table mitaller.invitaciones enable row level security;
create policy invitaciones_select on mitaller.invitaciones for select to authenticated
  using (coalesce(mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'), false));
revoke insert, update, delete on mitaller.invitaciones from authenticated;

-- Las escrituras de miembros solo por RPC (reglas de roles y límite de usuarios).
drop policy if exists miembros_insert on mitaller.miembros;
drop policy if exists miembros_update on mitaller.miembros;
drop policy if exists miembros_delete on mitaller.miembros;

create or replace function mitaller._hash_token(p_token text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(p_token, 'utf8')), 'hex');
$$;

create or replace function mitaller.invitar_miembro(
  p_taller uuid, p_rol mitaller.rol_miembro, p_etiqueta text default null, p_sucursal uuid default null
) returns jsonb
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_rol_caller mitaller.rol_miembro := mitaller.rol_en_taller(p_taller);
  v_limite int;
  v_ocupados int;
  v_token text;
  v_inv mitaller.invitaciones;
begin
  perform mitaller._exigir_admin_taller(p_taller);
  if p_rol = 'propietario' then
    raise exception 'No se puede invitar a otro propietario';
  end if;
  if p_rol = 'administrador' and v_rol_caller <> 'propietario' then
    raise exception 'Solo el propietario puede invitar administradores';
  end if;
  if p_sucursal is not null and not exists (
       select 1 from mitaller.sucursales where id = p_sucursal and taller_id = p_taller and activa) then
    raise exception 'La sucursal no existe o está desactivada';
  end if;

  perform 1 from mitaller.talleres where id = p_taller for update;
  v_limite := mitaller._limite_plan(p_taller, 'usuarios');
  if v_limite is not null then
    select (select count(*) from mitaller.miembros where taller_id = p_taller and activo)
         + (select count(*) from mitaller.invitaciones where taller_id = p_taller and estado = 'pendiente' and expira_en > now())
      into v_ocupados;
    if v_ocupados >= v_limite then
      raise exception 'Tu plan permite hasta % usuarios (incluye invitaciones pendientes). Mejora tu plan para agregar más.', v_limite;
    end if;
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into mitaller.invitaciones (taller_id, etiqueta, rol, sucursal_id, token_hash, invitado_por)
  values (p_taller, nullif(btrim(coalesce(p_etiqueta, '')), ''), p_rol, p_sucursal, mitaller._hash_token(v_token), auth.uid())
  returning * into v_inv;

  -- El token en claro solo existe en esta respuesta: no se puede volver a leer.
  return jsonb_build_object('id', v_inv.id, 'token', v_token, 'expira_en', v_inv.expira_en);
end;
$$;

create or replace function mitaller.cancelar_invitacion(p_invitacion uuid) returns void
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_taller uuid;
begin
  select taller_id into v_taller from mitaller.invitaciones where id = p_invitacion;
  if v_taller is null then
    raise exception 'La invitación no existe';
  end if;
  perform mitaller._exigir_admin_taller(v_taller);
  update mitaller.invitaciones set estado = 'cancelada' where id = p_invitacion and estado = 'pendiente';
end;
$$;

-- Para la pantalla /unirse/:token, también sin sesión: solo revela el nombre del taller y el rol a quien tiene el token.
create or replace function mitaller.ver_invitacion(p_token text) returns jsonb
language plpgsql stable security definer set search_path = mitaller, public as $$
declare
  v_inv mitaller.invitaciones;
  v_nombre text;
begin
  select * into v_inv from mitaller.invitaciones where token_hash = mitaller._hash_token(coalesce(p_token, ''));
  if not found then
    return jsonb_build_object('valida', false, 'motivo', 'La invitación no existe');
  end if;
  if v_inv.estado <> 'pendiente' then
    return jsonb_build_object('valida', false, 'motivo', 'Esta invitación ya fue usada o cancelada');
  end if;
  if v_inv.expira_en <= now() then
    return jsonb_build_object('valida', false, 'motivo', 'Esta invitación venció. Pide una nueva');
  end if;
  select nombre into v_nombre from mitaller.talleres where id = v_inv.taller_id;
  return jsonb_build_object('valida', true, 'taller', v_nombre, 'rol', v_inv.rol);
end;
$$;

create or replace function mitaller.aceptar_invitacion(p_token text) returns mitaller.miembros
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_uid uuid := auth.uid();
  v_inv mitaller.invitaciones;
  v_miembro mitaller.miembros;
  v_email text;
  v_nombre text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para aceptar la invitación';
  end if;
  select * into v_inv from mitaller.invitaciones
   where token_hash = mitaller._hash_token(coalesce(p_token, '')) for update;
  if not found or v_inv.estado <> 'pendiente' or v_inv.expira_en <= now() then
    raise exception 'La invitación no es válida o ya venció';
  end if;

  insert into mitaller.miembros (taller_id, user_id, rol, sucursal_id)
  values (v_inv.taller_id, v_uid, v_inv.rol,
          coalesce(v_inv.sucursal_id, (select id from mitaller.sucursales where taller_id = v_inv.taller_id and es_principal)))
  on conflict (taller_id, user_id) do update
    set rol = case when mitaller.miembros.rol = 'propietario' then mitaller.miembros.rol else excluded.rol end,
        sucursal_id = excluded.sucursal_id,
        activo = true
  returning * into v_miembro;

  update mitaller.invitaciones set estado = 'aceptada', aceptada_por = v_uid where id = v_inv.id;

  select u.email, coalesce(u.raw_user_meta_data ->> 'nombre', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
    into v_email, v_nombre from auth.users u where u.id = v_uid;
  insert into mitaller.perfiles (user_id, nombre, email) values (v_uid, v_nombre, v_email)
  on conflict (user_id) do update
    set nombre = coalesce(mitaller.perfiles.nombre, excluded.nombre),
        email = coalesce(mitaller.perfiles.email, excluded.email);

  return v_miembro;
end;
$$;

create or replace function mitaller.cambiar_miembro(p_miembro uuid, p_rol mitaller.rol_miembro, p_sucursal uuid default null)
returns mitaller.miembros
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_m mitaller.miembros;
  v_rol_caller mitaller.rol_miembro;
begin
  select * into v_m from mitaller.miembros where id = p_miembro for update;
  if not found then
    raise exception 'El miembro no existe';
  end if;
  perform mitaller._exigir_admin_taller(v_m.taller_id);
  v_rol_caller := mitaller.rol_en_taller(v_m.taller_id);

  if v_m.rol = 'propietario' then
    raise exception 'No se puede cambiar el rol del propietario';
  end if;
  if p_rol = 'propietario' then
    raise exception 'No se puede asignar el rol de propietario';
  end if;
  if (p_rol = 'administrador' or v_m.rol = 'administrador') and v_rol_caller <> 'propietario' then
    raise exception 'Solo el propietario puede asignar o quitar el rol de administrador';
  end if;
  if p_sucursal is not null and not exists (
       select 1 from mitaller.sucursales where id = p_sucursal and taller_id = v_m.taller_id and activa) then
    raise exception 'La sucursal no existe o está desactivada';
  end if;

  update mitaller.miembros set rol = p_rol, sucursal_id = coalesce(p_sucursal, sucursal_id)
   where id = p_miembro returning * into v_m;
  return v_m;
end;
$$;

create or replace function mitaller.quitar_miembro(p_miembro uuid) returns void
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_m mitaller.miembros;
begin
  select * into v_m from mitaller.miembros where id = p_miembro for update;
  if not found then
    raise exception 'El miembro no existe';
  end if;
  perform mitaller._exigir_admin_taller(v_m.taller_id);
  if v_m.rol = 'propietario' then
    raise exception 'No se puede quitar al propietario';
  end if;
  if v_m.user_id = auth.uid() then
    raise exception 'No puedes quitarte a ti mismo';
  end if;
  if v_m.rol = 'administrador' and mitaller.rol_en_taller(v_m.taller_id) <> 'propietario' then
    raise exception 'Solo el propietario puede quitar a un administrador';
  end if;
  update mitaller.miembros set activo = false where id = p_miembro;
end;
$$;

-- Funciones nuevas: solo usuarios autenticados, salvo ver_invitacion (pantalla de invitación sin sesión).
revoke execute on all functions in schema mitaller from public, anon;
grant execute on all functions in schema mitaller to authenticated;
revoke execute on function mitaller._mover_stock(uuid, uuid, mitaller.tipo_movimiento, numeric, text, uuid, text) from authenticated;
revoke execute on function mitaller.orden_items_stock_trg() from authenticated;
revoke execute on function mitaller.ordenes_cancelar_stock_trg() from authenticated;
revoke execute on function mitaller.ordenes_borrar_stock_trg() from authenticated;
revoke execute on function mitaller._exigir_admin_taller(uuid) from authenticated;
revoke execute on function mitaller._limite_plan(uuid, text) from authenticated;
grant execute on function mitaller.ver_invitacion(text) to anon;
