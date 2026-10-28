-- =====================================================================================
-- Mi Taller · migración base · 2026-10-28 · schema `mitaller`
-- Implementa docs/01-MODELO-DE-DATOS.md y las reglas de docs/00-ARQUITECTURA.md.
--
-- ANTES DE USAR LA APP:
--   1. Ejecutar este archivo en el SQL editor de X Core.
--   2. Supabase → Project Settings → API → "Exposed schemas": agregar `mitaller`
--      (sin esto supabase-js responde "schema must be one of the following ...").
--
-- Todo vive en el schema `mitaller`; nada se crea en `public`.
-- Decisiones tomadas donde el documento deja huecos (ver también el informe de la ronda):
--   * `perfiles` tiene columna `email` (copiada de auth.users) para que `miembros_detalle`,
--     que es security_invoker, pueda mostrar el correo sin tocar auth.users.
--   * Escrituras directas bloqueadas por RLS en tablas cuya lógica vive en RPC:
--     ordenes_trabajo (insert), facturas, factura_items, pagos, suscripciones.
--   * Las políticas de update llevan también `with check` para impedir mover filas de taller.
-- =====================================================================================

create schema if not exists mitaller;

-- -------------------------------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------------------------------
create type mitaller.rol_miembro        as enum ('propietario','administrador','recepcionista','mecanico');
create type mitaller.estado_orden       as enum ('recepcion','diagnostico','en_progreso','esperando_repuestos','listo','entregado','cancelado');
create type mitaller.tipo_item          as enum ('mano_obra','repuesto');
create type mitaller.estado_factura     as enum ('pendiente','pagada','vencida','anulada');
create type mitaller.tipo_ncf           as enum ('B01','B02','B14','B15');
create type mitaller.metodo_pago        as enum ('efectivo','transferencia','tarjeta','otro');
create type mitaller.estado_suscripcion as enum ('activa','vencida','cancelada');
create type mitaller.tipo_movimiento    as enum ('entrada','salida','ajuste');

-- -------------------------------------------------------------------------------------
-- Utilidades
-- -------------------------------------------------------------------------------------
create or replace function mitaller.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Tablas
-- -------------------------------------------------------------------------------------
create table mitaller.planes (
  id              text primary key,
  nombre          text not null,
  precio_mensual  numeric(12,2) not null default 0,
  limites         jsonb,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create table mitaller.talleres (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  rnc         text,
  telefono    text,
  email       text,
  direccion   text,
  logo_url    text,
  contadores  jsonb not null default '{"orden":0,"factura":0}'::jsonb,
  config      jsonb not null default '{"itbis":18,"dias_vencimiento":30,"moneda":"DOP"}'::jsonb,
  creado_por  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table mitaller.suscripciones (
  id          uuid primary key default gen_random_uuid(),
  taller_id   uuid not null references mitaller.talleres(id) on delete cascade,
  plan_id     text not null references mitaller.planes(id),
  estado      mitaller.estado_suscripcion not null default 'activa',
  inicio      date not null default current_date,
  fin         date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index suscripciones_taller_idx on mitaller.suscripciones (taller_id);
create unique index suscripciones_una_activa_idx on mitaller.suscripciones (taller_id) where estado = 'activa';

create table mitaller.sucursales (
  id            uuid primary key default gen_random_uuid(),
  taller_id     uuid not null references mitaller.talleres(id) on delete cascade,
  nombre        text not null,
  direccion     text,
  telefono      text,
  es_principal  boolean not null default false,
  activa        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create index sucursales_taller_idx on mitaller.sucursales (taller_id);

create table mitaller.miembros (
  id           uuid primary key default gen_random_uuid(),
  taller_id    uuid not null references mitaller.talleres(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  rol          mitaller.rol_miembro not null,
  sucursal_id  uuid references mitaller.sucursales(id) on delete set null,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  unique (taller_id, user_id)
);
create index miembros_taller_idx on mitaller.miembros (taller_id);
create index miembros_user_idx on mitaller.miembros (user_id);

create table mitaller.perfiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  nombre      text,
  telefono    text,
  avatar_url  text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table mitaller.clientes (
  id         uuid primary key default gen_random_uuid(),
  taller_id  uuid not null references mitaller.talleres(id) on delete cascade,
  nombre     text not null,
  telefono   text,
  email      text,
  documento  text,
  direccion  text,
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index clientes_taller_idx on mitaller.clientes (taller_id);
create index clientes_taller_nombre_idx on mitaller.clientes (taller_id, lower(nombre));
create index clientes_taller_telefono_idx on mitaller.clientes (taller_id, telefono);

create table mitaller.vehiculos (
  id          uuid primary key default gen_random_uuid(),
  taller_id   uuid not null references mitaller.talleres(id) on delete cascade,
  cliente_id  uuid not null references mitaller.clientes(id),
  placa       text not null,
  marca       text,
  modelo      text,
  anio        int,
  color       text,
  vin         text,
  kilometraje int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  unique (taller_id, placa)
);
create index vehiculos_taller_idx on mitaller.vehiculos (taller_id);
create index vehiculos_cliente_idx on mitaller.vehiculos (cliente_id);

create table mitaller.articulos (
  id            uuid primary key default gen_random_uuid(),
  taller_id     uuid not null references mitaller.talleres(id) on delete cascade,
  codigo        text,
  nombre        text not null,
  descripcion   text,
  precio_venta  numeric(12,2) not null default 0,
  costo         numeric(12,2) not null default 0,
  stock_minimo  numeric(10,2) not null default 0,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  unique (taller_id, codigo)
);
create index articulos_taller_idx on mitaller.articulos (taller_id);

create table mitaller.ordenes_trabajo (
  id                   uuid primary key default gen_random_uuid(),
  taller_id            uuid not null references mitaller.talleres(id) on delete cascade,
  sucursal_id          uuid references mitaller.sucursales(id) on delete set null,
  numero               text not null,
  cliente_id           uuid not null references mitaller.clientes(id),
  vehiculo_id          uuid not null references mitaller.vehiculos(id),
  estado               mitaller.estado_orden not null default 'recepcion',
  motivo               text,
  diagnostico          text,
  notas_internas       text,
  kilometraje_entrada  int,
  nivel_combustible    int check (nivel_combustible between 0 and 100),
  inventario_entrada   jsonb not null default '{}'::jsonb,
  fotos                text[] not null default '{}',
  mecanico_id          uuid references auth.users(id),
  progreso             int not null default 0 check (progreso between 0 and 100),
  recibido_por         uuid references auth.users(id),
  fecha_entrada        timestamptz not null default now(),
  fecha_promesa        timestamptz,
  fecha_entrega        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz,
  unique (taller_id, numero)
);
create index ordenes_taller_idx on mitaller.ordenes_trabajo (taller_id);
create index ordenes_taller_estado_idx on mitaller.ordenes_trabajo (taller_id, estado);
create index ordenes_cliente_idx on mitaller.ordenes_trabajo (cliente_id);
create index ordenes_vehiculo_idx on mitaller.ordenes_trabajo (vehiculo_id);
create index ordenes_mecanico_idx on mitaller.ordenes_trabajo (mecanico_id);

create table mitaller.orden_items (
  id               uuid primary key default gen_random_uuid(),
  taller_id        uuid not null references mitaller.talleres(id) on delete cascade,
  orden_id         uuid not null references mitaller.ordenes_trabajo(id) on delete cascade,
  tipo             mitaller.tipo_item not null default 'mano_obra',
  descripcion      text not null,
  cantidad         numeric(10,2) not null default 1 check (cantidad > 0),
  precio_unitario  numeric(12,2) not null default 0 check (precio_unitario >= 0),
  aplica_itbis     boolean not null default true,
  articulo_id      uuid references mitaller.articulos(id),
  completado       boolean not null default false,
  orden            int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);
create index orden_items_taller_idx on mitaller.orden_items (taller_id);
create index orden_items_orden_idx on mitaller.orden_items (orden_id);

create table mitaller.orden_historial (
  id          uuid primary key default gen_random_uuid(),
  taller_id   uuid not null references mitaller.talleres(id) on delete cascade,
  orden_id    uuid not null references mitaller.ordenes_trabajo(id) on delete cascade,
  de_estado   mitaller.estado_orden,
  a_estado    mitaller.estado_orden not null,
  user_id     uuid references auth.users(id),
  comentario  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index orden_historial_taller_idx on mitaller.orden_historial (taller_id);
create index orden_historial_orden_idx on mitaller.orden_historial (orden_id, created_at);

create table mitaller.facturas (
  id                 uuid primary key default gen_random_uuid(),
  taller_id          uuid not null references mitaller.talleres(id) on delete cascade,
  sucursal_id        uuid references mitaller.sucursales(id) on delete set null,
  numero             text not null,
  orden_id           uuid references mitaller.ordenes_trabajo(id),
  cliente_id         uuid not null references mitaller.clientes(id),
  tipo_ncf           mitaller.tipo_ncf,
  ncf                text,
  subtotal           numeric(12,2) not null default 0,
  itbis              numeric(12,2) not null default 0,
  total              numeric(12,2) not null default 0,
  estado             mitaller.estado_factura not null default 'pendiente',
  fecha_emision      date not null default current_date,
  fecha_vencimiento  date,
  notas              text,
  anulada_motivo     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz,
  unique (taller_id, numero)
);
create index facturas_taller_idx on mitaller.facturas (taller_id);
create index facturas_taller_estado_idx on mitaller.facturas (taller_id, estado);
create index facturas_taller_vencimiento_idx on mitaller.facturas (taller_id, fecha_vencimiento);
create index facturas_cliente_idx on mitaller.facturas (cliente_id);
create unique index facturas_una_activa_por_orden_idx on mitaller.facturas (orden_id)
  where orden_id is not null and estado <> 'anulada';

create table mitaller.factura_items (
  id               uuid primary key default gen_random_uuid(),
  taller_id        uuid not null references mitaller.talleres(id) on delete cascade,
  factura_id       uuid not null references mitaller.facturas(id) on delete cascade,
  descripcion      text not null,
  tipo             mitaller.tipo_item not null,
  cantidad         numeric(10,2) not null,
  precio_unitario  numeric(12,2) not null,
  aplica_itbis     boolean not null,
  importe          numeric(12,2) not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);
create index factura_items_taller_idx on mitaller.factura_items (taller_id);
create index factura_items_factura_idx on mitaller.factura_items (factura_id);

create table mitaller.pagos (
  id              uuid primary key default gen_random_uuid(),
  taller_id       uuid not null references mitaller.talleres(id) on delete cascade,
  factura_id      uuid not null references mitaller.facturas(id),
  monto           numeric(12,2) not null check (monto > 0),
  metodo          mitaller.metodo_pago not null,
  referencia      text,
  fecha           timestamptz not null default now(),
  registrado_por  uuid references auth.users(id),
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);
create index pagos_taller_idx on mitaller.pagos (taller_id);
create index pagos_factura_idx on mitaller.pagos (factura_id);
create index pagos_taller_fecha_idx on mitaller.pagos (taller_id, fecha);

create table mitaller.movimientos_inventario (
  id               uuid primary key default gen_random_uuid(),
  taller_id        uuid not null references mitaller.talleres(id) on delete cascade,
  sucursal_id      uuid references mitaller.sucursales(id) on delete set null,
  articulo_id      uuid not null references mitaller.articulos(id),
  tipo             mitaller.tipo_movimiento not null,
  cantidad         numeric(10,2) not null,
  referencia_tipo  text check (referencia_tipo in ('orden','factura','ajuste')),
  referencia_id    uuid,
  user_id          uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);
create index movimientos_taller_idx on mitaller.movimientos_inventario (taller_id);
create index movimientos_articulo_idx on mitaller.movimientos_inventario (articulo_id);

-- Trigger updated_at en todas las tablas
do $$
declare t text;
begin
  foreach t in array array[
    'planes','talleres','suscripciones','sucursales','miembros','perfiles','clientes','vehiculos',
    'articulos','ordenes_trabajo','orden_items','orden_historial','facturas','factura_items','pagos',
    'movimientos_inventario'
  ] loop
    execute format(
      'create trigger %I before update on mitaller.%I for each row execute function mitaller.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end $$;

-- -------------------------------------------------------------------------------------
-- Seed de planes
-- -------------------------------------------------------------------------------------
insert into mitaller.planes (id, nombre, precio_mensual, limites) values
  ('gratis', 'Gratis', 0,    '{"sucursales":1,"usuarios":3,"ordenes_mes":30}'::jsonb),
  ('pro',    'Pro',    1500, null)
on conflict (id) do nothing;

-- -------------------------------------------------------------------------------------
-- Helpers de seguridad (security definer, search_path fijo)
-- -------------------------------------------------------------------------------------
create or replace function mitaller.es_miembro(p_taller uuid) returns boolean
language sql stable security definer set search_path = mitaller, public as $$
  select exists (
    select 1 from mitaller.miembros m
    where m.taller_id = p_taller and m.user_id = auth.uid() and m.activo
  );
$$;

create or replace function mitaller.rol_en_taller(p_taller uuid) returns mitaller.rol_miembro
language sql stable security definer set search_path = mitaller, public as $$
  select m.rol from mitaller.miembros m
  where m.taller_id = p_taller and m.user_id = auth.uid() and m.activo
  limit 1;
$$;

create or replace function mitaller.mis_talleres() returns setof mitaller.talleres
language sql stable security definer set search_path = mitaller, public as $$
  select t.* from mitaller.talleres t
  join mitaller.miembros m on m.taller_id = t.id
  where m.user_id = auth.uid() and m.activo
  order by t.created_at;
$$;

-- ¿comparte el usuario actual algún taller con p_user? (lectura de nombres de compañeros)
create or replace function mitaller.comparte_taller(p_user uuid) returns boolean
language sql stable security definer set search_path = mitaller, public as $$
  select exists (
    select 1
    from mitaller.miembros a
    join mitaller.miembros b on b.taller_id = a.taller_id
    where a.user_id = auth.uid() and a.activo and b.user_id = p_user and b.activo
  );
$$;

-- Para las políticas de storage: el primer segmento del path es el taller_id.
create or replace function mitaller.es_miembro_path(p_name text) returns boolean
language sql stable security definer set search_path = mitaller, public as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then mitaller.es_miembro(((storage.foldername(p_name))[1])::uuid)
    else false
  end;
$$;

-- -------------------------------------------------------------------------------------
-- Reglas de negocio en triggers
-- -------------------------------------------------------------------------------------
create or replace function mitaller.transicion_permitida(p_de mitaller.estado_orden, p_a mitaller.estado_orden)
returns boolean language sql immutable as $$
  select case p_de
    when 'recepcion'           then p_a in ('diagnostico','en_progreso','cancelado')
    when 'diagnostico'         then p_a in ('en_progreso','esperando_repuestos','cancelado')
    when 'en_progreso'         then p_a in ('esperando_repuestos','listo','cancelado')
    when 'esperando_repuestos' then p_a in ('en_progreso','cancelado')
    when 'listo'               then p_a in ('entregado','en_progreso')
    else false
  end;
$$;

create or replace function mitaller.ordenes_before_update() returns trigger
language plpgsql set search_path = mitaller, public as $$
begin
  if new.taller_id is distinct from old.taller_id then
    raise exception 'No se puede mover una orden a otro taller';
  end if;
  if new.numero is distinct from old.numero then
    raise exception 'El número de la orden no se puede modificar';
  end if;
  if new.estado is distinct from old.estado then
    if not mitaller.transicion_permitida(old.estado, new.estado) then
      raise exception 'Transición no permitida: de % a %', old.estado, new.estado;
    end if;
    if new.estado = 'entregado' then
      new.fecha_entrega := coalesce(new.fecha_entrega, now());
    end if;
  end if;
  return new;
end;
$$;
create trigger ordenes_trabajo_before_update before update on mitaller.ordenes_trabajo
  for each row execute function mitaller.ordenes_before_update();

-- Historial automático al cambiar de estado. El comentario viaja en una variable local de la transacción.
create or replace function mitaller.ordenes_historial_trg() returns trigger
language plpgsql security definer set search_path = mitaller, public as $$
begin
  if new.estado is distinct from old.estado then
    insert into mitaller.orden_historial (taller_id, orden_id, de_estado, a_estado, user_id, comentario)
    values (new.taller_id, new.id, old.estado, new.estado, auth.uid(),
            nullif(current_setting('mitaller.comentario', true), ''));
  end if;
  return new;
end;
$$;
create trigger ordenes_trabajo_historial after update of estado on mitaller.ordenes_trabajo
  for each row execute function mitaller.ordenes_historial_trg();

-- -------------------------------------------------------------------------------------
-- RPCs
-- -------------------------------------------------------------------------------------
create or replace function mitaller.crear_taller(
  p_nombre text,
  p_rnc text default null,
  p_telefono text default null,
  p_direccion text default null,
  p_nombre_usuario text default null
) returns mitaller.talleres
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_uid uuid := auth.uid();
  v_rnc text := nullif(btrim(coalesce(p_rnc, '')), '');
  v_taller mitaller.talleres;
  v_sucursal uuid;
  v_email text;
  v_nombre_usuario text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para crear un taller';
  end if;
  if nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'El nombre del taller es requerido';
  end if;
  if v_rnc is not null and v_rnc !~ '^([0-9]{9}|[0-9]{11})$' then
    raise exception 'El RNC debe tener 9 u 11 dígitos';
  end if;

  select u.email, coalesce(nullif(btrim(coalesce(p_nombre_usuario, '')), ''), u.raw_user_meta_data ->> 'nombre')
    into v_email, v_nombre_usuario
  from auth.users u where u.id = v_uid;

  insert into mitaller.talleres (nombre, rnc, telefono, direccion, email, creado_por)
  values (btrim(p_nombre), v_rnc, nullif(btrim(coalesce(p_telefono, '')), ''),
          nullif(btrim(coalesce(p_direccion, '')), ''), v_email, v_uid)
  returning * into v_taller;

  insert into mitaller.sucursales (taller_id, nombre, direccion, telefono, es_principal)
  values (v_taller.id, 'Principal', v_taller.direccion, v_taller.telefono, true)
  returning id into v_sucursal;

  insert into mitaller.miembros (taller_id, user_id, rol, sucursal_id)
  values (v_taller.id, v_uid, 'propietario', v_sucursal);

  insert into mitaller.suscripciones (taller_id, plan_id) values (v_taller.id, 'gratis');

  insert into mitaller.perfiles (user_id, nombre, email)
  values (v_uid, v_nombre_usuario, v_email)
  on conflict (user_id) do update
    set nombre = coalesce(excluded.nombre, mitaller.perfiles.nombre),
        email = coalesce(excluded.email, mitaller.perfiles.email);

  return v_taller;
end;
$$;

create or replace function mitaller.siguiente_numero(p_taller uuid, p_tipo text) returns text
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_clave text;
  v_prefijo text;
  v_n int;
begin
  if p_tipo = 'orden' then
    v_clave := 'orden'; v_prefijo := 'OT';
  elsif p_tipo = 'factura' then
    v_clave := 'factura'; v_prefijo := 'FAC';
  else
    raise exception 'Tipo de secuencia no válido: %', p_tipo;
  end if;

  if not mitaller.es_miembro(p_taller) then
    raise exception 'No tienes acceso a este taller';
  end if;

  -- el update toma el lock de la fila: dos llamadas concurrentes se serializan
  update mitaller.talleres
     set contadores = jsonb_set(
           coalesce(contadores, '{}'::jsonb),
           array[v_clave],
           to_jsonb(coalesce((contadores ->> v_clave)::int, 0) + 1))
   where id = p_taller
  returning (contadores ->> v_clave)::int into v_n;

  if v_n is null then
    raise exception 'El taller no existe';
  end if;

  return v_prefijo || '-' || lpad(v_n::text, 6, '0');
end;
$$;

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
    select id into v_sucursal from mitaller.sucursales
    where taller_id = p_taller and es_principal order by created_at limit 1;
  elsif not exists (select 1 from mitaller.sucursales where id = v_sucursal and taller_id = p_taller) then
    raise exception 'La sucursal no existe en este taller';
  end if;

  -- lock del taller: serializa el chequeo de límite y la numeración
  perform 1 from mitaller.talleres where id = p_taller for update;

  select nullif(pl.limites ->> 'ordenes_mes', '')::int into v_limite
  from mitaller.suscripciones s
  join mitaller.planes pl on pl.id = s.plan_id
  where s.taller_id = p_taller and s.estado = 'activa'
  limit 1;

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

create or replace function mitaller.cambiar_estado_orden(
  p_orden uuid,
  p_estado mitaller.estado_orden,
  p_comentario text default null
) returns mitaller.ordenes_trabajo
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_orden mitaller.ordenes_trabajo;
begin
  select * into v_orden from mitaller.ordenes_trabajo where id = p_orden for update;
  if not found then
    raise exception 'La orden no existe';
  end if;
  if not mitaller.es_miembro(v_orden.taller_id) then
    raise exception 'No tienes acceso a este taller';
  end if;
  if p_estado = 'cancelado' and nullif(btrim(coalesce(p_comentario, '')), '') is null then
    raise exception 'Debes indicar el motivo de la cancelación';
  end if;

  -- la transición se valida en el trigger ordenes_before_update (aplica también a updates directos)
  perform set_config('mitaller.comentario', coalesce(p_comentario, ''), true);
  update mitaller.ordenes_trabajo set estado = p_estado where id = p_orden returning * into v_orden;
  return v_orden;
end;
$$;

create or replace function mitaller.emitir_factura(
  p_orden uuid,
  p_tipo_ncf mitaller.tipo_ncf default null,
  p_ncf text default null,
  p_fecha_vencimiento date default null,
  p_notas text default null
) returns mitaller.facturas
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_orden mitaller.ordenes_trabajo;
  v_taller mitaller.talleres;
  v_rate numeric;
  v_dias int;
  v_subtotal numeric(12,2);
  v_base numeric(12,2);
  v_itbis numeric(12,2);
  v_ncf text := nullif(btrim(coalesce(p_ncf, '')), '');
  v_factura mitaller.facturas;
begin
  select * into v_orden from mitaller.ordenes_trabajo where id = p_orden for update;
  if not found then
    raise exception 'La orden no existe';
  end if;
  if not mitaller.es_miembro(v_orden.taller_id) then
    raise exception 'No tienes acceso a este taller';
  end if;
  if v_orden.estado not in ('listo', 'entregado') then
    raise exception 'Solo se pueden facturar órdenes en estado Listo o Entregado';
  end if;
  if exists (select 1 from mitaller.facturas where orden_id = p_orden and estado <> 'anulada') then
    raise exception 'La orden ya tiene una factura activa';
  end if;
  if v_ncf is not null and v_ncf !~ '^[BE][0-9]{10}$' then
    raise exception 'El NCF no tiene un formato válido (ej. B0100000001)';
  end if;

  select * into v_taller from mitaller.talleres where id = v_orden.taller_id;
  v_rate := coalesce((v_taller.config ->> 'itbis')::numeric, 18);
  v_dias := coalesce((v_taller.config ->> 'dias_vencimiento')::int, 30);

  select coalesce(sum(round(cantidad * precio_unitario, 2)), 0),
         coalesce(sum(case when aplica_itbis then round(cantidad * precio_unitario, 2) else 0 end), 0)
    into v_subtotal, v_base
  from mitaller.orden_items where orden_id = p_orden;

  if not exists (select 1 from mitaller.orden_items where orden_id = p_orden) then
    raise exception 'La orden no tiene ítems para facturar';
  end if;

  v_itbis := round(v_base * v_rate / 100, 2);

  insert into mitaller.facturas (
    taller_id, sucursal_id, numero, orden_id, cliente_id, tipo_ncf, ncf,
    subtotal, itbis, total, fecha_emision, fecha_vencimiento, notas
  ) values (
    v_orden.taller_id, v_orden.sucursal_id, mitaller.siguiente_numero(v_orden.taller_id, 'factura'),
    p_orden, v_orden.cliente_id, p_tipo_ncf, v_ncf,
    v_subtotal, v_itbis, v_subtotal + v_itbis, current_date,
    coalesce(p_fecha_vencimiento, current_date + v_dias), nullif(btrim(coalesce(p_notas, '')), '')
  ) returning * into v_factura;

  insert into mitaller.factura_items (taller_id, factura_id, descripcion, tipo, cantidad, precio_unitario, aplica_itbis, importe)
  select v_orden.taller_id, v_factura.id, i.descripcion, i.tipo, i.cantidad, i.precio_unitario, i.aplica_itbis,
         round(i.cantidad * i.precio_unitario, 2)
  from mitaller.orden_items i where i.orden_id = p_orden order by i.orden, i.created_at;

  return v_factura;
end;
$$;

create or replace function mitaller.registrar_pago(
  p_factura uuid,
  p_monto numeric,
  p_metodo mitaller.metodo_pago,
  p_referencia text default null,
  p_notas text default null
) returns mitaller.pagos
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_factura mitaller.facturas;
  v_pagado numeric(12,2);
  v_balance numeric(12,2);
  v_pago mitaller.pagos;
begin
  select * into v_factura from mitaller.facturas where id = p_factura for update;
  if not found then
    raise exception 'La factura no existe';
  end if;
  if not mitaller.es_miembro(v_factura.taller_id) then
    raise exception 'No tienes acceso a este taller';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'La factura está anulada';
  end if;
  if v_factura.estado = 'pagada' then
    raise exception 'La factura ya está pagada';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero';
  end if;

  select coalesce(sum(monto), 0) into v_pagado from mitaller.pagos where factura_id = p_factura;
  v_balance := v_factura.total - v_pagado;
  if p_monto > v_balance then
    raise exception 'El monto excede el balance pendiente (%)', v_balance;
  end if;

  insert into mitaller.pagos (taller_id, factura_id, monto, metodo, referencia, registrado_por, notas)
  values (v_factura.taller_id, p_factura, round(p_monto, 2), p_metodo,
          nullif(btrim(coalesce(p_referencia, '')), ''), auth.uid(), nullif(btrim(coalesce(p_notas, '')), ''))
  returning * into v_pago;

  if v_balance - v_pago.monto = 0 then
    update mitaller.facturas set estado = 'pagada' where id = p_factura;
  end if;

  return v_pago;
end;
$$;

create or replace function mitaller.anular_factura(p_factura uuid, p_motivo text) returns mitaller.facturas
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_factura mitaller.facturas;
begin
  select * into v_factura from mitaller.facturas where id = p_factura for update;
  if not found then
    raise exception 'La factura no existe';
  end if;
  if coalesce(mitaller.rol_en_taller(v_factura.taller_id) in ('propietario', 'administrador'), false) is not true then
    raise exception 'Solo el propietario o un administrador pueden anular facturas';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'La factura ya está anulada';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Debes indicar el motivo de la anulación';
  end if;
  if exists (select 1 from mitaller.pagos where factura_id = p_factura) then
    raise exception 'No se puede anular una factura que tiene pagos registrados';
  end if;

  update mitaller.facturas set estado = 'anulada', anulada_motivo = btrim(p_motivo)
  where id = p_factura returning * into v_factura;
  return v_factura;
end;
$$;

-- Resúmenes: security invoker (respetan RLS); validan membresía para dar un error claro.
create or replace function mitaller.resumen_finanzas(
  p_taller uuid,
  p_desde date default null,
  p_hasta date default null
) returns jsonb
language plpgsql stable set search_path = mitaller, public as $$
declare
  v_desde date := coalesce(p_desde, date_trunc('month', current_date)::date);
  v_hasta date := coalesce(p_hasta, current_date);
  v_mes date := date_trunc('month', current_date)::date;
  v_mes_ant date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_hoy numeric(12,2);
  v_pend numeric(12,2);
  v_venc numeric(12,2);
  v_venc_n int;
  v_ticket numeric(12,2);
  v_ing_mes numeric(12,2);
  v_ing_ant numeric(12,2);
begin
  if not mitaller.es_miembro(p_taller) then
    raise exception 'No tienes acceso a este taller';
  end if;

  select coalesce(sum(monto), 0) into v_hoy from mitaller.pagos
  where taller_id = p_taller and fecha >= current_date and fecha < current_date + 1;

  select coalesce(sum(balance), 0) into v_pend from mitaller.facturas_resumen
  where taller_id = p_taller and estado_efectivo in ('pendiente', 'vencida') and balance > 0;

  select coalesce(sum(balance), 0), count(*) into v_venc, v_venc_n from mitaller.facturas_resumen
  where taller_id = p_taller and estado_efectivo = 'vencida';

  select coalesce(round(avg(total), 2), 0) into v_ticket from mitaller.facturas
  where taller_id = p_taller and estado <> 'anulada' and fecha_emision between v_desde and v_hasta;

  select coalesce(sum(monto), 0) into v_ing_mes from mitaller.pagos
  where taller_id = p_taller and fecha >= v_mes and fecha < v_mes + interval '1 month';

  select coalesce(sum(monto), 0) into v_ing_ant from mitaller.pagos
  where taller_id = p_taller and fecha >= v_mes_ant and fecha < v_mes;

  return jsonb_build_object(
    'ingresos_hoy', v_hoy,
    'pendiente_cobro', v_pend,
    'vencido', v_venc,
    'facturas_vencidas', v_venc_n,
    'ticket_promedio', v_ticket,
    'ingresos_mes', v_ing_mes,
    'ingresos_mes_anterior', v_ing_ant
  );
end;
$$;

create or replace function mitaller.resumen_dashboard(p_taller uuid) returns jsonb
language plpgsql stable set search_path = mitaller, public as $$
declare
  v_por_estado jsonb;
  v_carga jsonb;
  v_ultimas jsonb;
  v_venc_n int;
  v_venc_monto numeric(12,2);
begin
  if not mitaller.es_miembro(p_taller) then
    raise exception 'No tienes acceso a este taller';
  end if;

  select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb) into v_por_estado
  from (select estado::text as estado, count(*) as n from mitaller.ordenes_trabajo
        where taller_id = p_taller group by estado) x;

  select coalesce(jsonb_agg(jsonb_build_object('mecanico_id', mecanico_id, 'nombre', nombre, 'ordenes', n) order by n desc), '[]'::jsonb)
    into v_carga
  from (select o.mecanico_id, coalesce(p.nombre, 'Sin nombre') as nombre, count(*) as n
        from mitaller.ordenes_trabajo o
        left join mitaller.perfiles p on p.user_id = o.mecanico_id
        where o.taller_id = p_taller and o.mecanico_id is not null
          and o.estado not in ('entregado', 'cancelado')
        group by o.mecanico_id, p.nombre) x;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.fecha_entrada desc), '[]'::jsonb) into v_ultimas
  from (select * from mitaller.ordenes_resumen where taller_id = p_taller
        order by fecha_entrada desc limit 5) r;

  select count(*), coalesce(sum(balance), 0) into v_venc_n, v_venc_monto
  from mitaller.facturas_resumen where taller_id = p_taller and estado_efectivo = 'vencida';

  return jsonb_build_object(
    'ordenes_por_estado', v_por_estado,
    'abiertas', (select count(*) from mitaller.ordenes_trabajo
                 where taller_id = p_taller and estado not in ('entregado', 'cancelado')),
    'listas', (select count(*) from mitaller.ordenes_trabajo where taller_id = p_taller and estado = 'listo'),
    'carga_mecanicos', v_carga,
    'facturas_vencidas', jsonb_build_object('cantidad', v_venc_n, 'monto', v_venc_monto),
    'ultimas_ordenes', v_ultimas
  );
end;
$$;

-- -------------------------------------------------------------------------------------
-- Vistas (security_invoker: respetan el RLS de quien consulta)
-- -------------------------------------------------------------------------------------
create or replace view mitaller.ordenes_resumen with (security_invoker = true) as
select
  o.*,
  c.nombre   as cliente_nombre,
  c.telefono as cliente_telefono,
  v.placa    as vehiculo_placa,
  v.marca    as vehiculo_marca,
  v.modelo   as vehiculo_modelo,
  v.anio     as vehiculo_anio,
  pf.nombre  as mecanico_nombre,
  s.subtotal,
  r.itbis,
  s.subtotal + r.itbis as total,
  s.items_total,
  s.items_completados
from mitaller.ordenes_trabajo o
join mitaller.talleres t on t.id = o.taller_id
left join mitaller.clientes c on c.id = o.cliente_id
left join mitaller.vehiculos v on v.id = o.vehiculo_id
left join mitaller.perfiles pf on pf.user_id = o.mecanico_id
left join lateral (
  select coalesce(sum(round(i.cantidad * i.precio_unitario, 2)), 0)::numeric(12,2) as subtotal,
         coalesce(sum(case when i.aplica_itbis then round(i.cantidad * i.precio_unitario, 2) else 0 end), 0)::numeric(12,2) as base_itbis,
         count(*)::int as items_total,
         (count(*) filter (where i.completado))::int as items_completados
  from mitaller.orden_items i where i.orden_id = o.id
) s on true
cross join lateral (
  select round(s.base_itbis * coalesce((t.config ->> 'itbis')::numeric, 18) / 100, 2)::numeric(12,2) as itbis
) r;

create or replace view mitaller.facturas_resumen with (security_invoker = true) as
select
  f.*,
  c.nombre  as cliente_nombre,
  o.numero  as orden_numero,
  v.placa   as vehiculo_placa,
  v.marca   as vehiculo_marca,
  v.modelo  as vehiculo_modelo,
  coalesce(p.pagado, 0)::numeric(12,2) as pagado,
  (f.total - coalesce(p.pagado, 0))::numeric(12,2) as balance,
  case
    when f.estado = 'pendiente' and f.fecha_vencimiento < current_date
         and (f.total - coalesce(p.pagado, 0)) > 0
      then 'vencida'::mitaller.estado_factura
    else f.estado
  end as estado_efectivo
from mitaller.facturas f
left join mitaller.clientes c on c.id = f.cliente_id
left join mitaller.ordenes_trabajo o on o.id = f.orden_id
left join mitaller.vehiculos v on v.id = o.vehiculo_id
left join lateral (select sum(pg.monto) as pagado from mitaller.pagos pg where pg.factura_id = f.id) p on true;

create or replace view mitaller.miembros_detalle with (security_invoker = true) as
select m.*, pf.nombre, pf.email, pf.telefono
from mitaller.miembros m
left join mitaller.perfiles pf on pf.user_id = m.user_id;

-- -------------------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------------------
alter table mitaller.planes enable row level security;
create policy planes_select on mitaller.planes for select to authenticated using (true);

alter table mitaller.perfiles enable row level security;
create policy perfiles_select on mitaller.perfiles for select to authenticated
  using (user_id = auth.uid() or mitaller.comparte_taller(user_id));
create policy perfiles_insert on mitaller.perfiles for insert to authenticated with check (user_id = auth.uid());
create policy perfiles_update on mitaller.perfiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table mitaller.talleres enable row level security;
create policy talleres_select on mitaller.talleres for select to authenticated using (mitaller.es_miembro(id));
create policy talleres_update on mitaller.talleres for update to authenticated
  using (mitaller.rol_en_taller(id) in ('propietario', 'administrador'))
  with check (mitaller.rol_en_taller(id) in ('propietario', 'administrador'));
-- insert: solo vía crear_taller · delete: sin política (denegado)

alter table mitaller.miembros enable row level security;
create policy miembros_select on mitaller.miembros for select to authenticated using (mitaller.es_miembro(taller_id));
create policy miembros_insert on mitaller.miembros for insert to authenticated
  with check (mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'));
create policy miembros_update on mitaller.miembros for update to authenticated
  using (mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'))
  with check (mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'));
create policy miembros_delete on mitaller.miembros for delete to authenticated
  using (mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'));

alter table mitaller.suscripciones enable row level security;
create policy suscripciones_select on mitaller.suscripciones for select to authenticated using (mitaller.es_miembro(taller_id));
-- escrituras: solo service role / futuro flujo de cobro

alter table mitaller.sucursales enable row level security;
create policy sucursales_select on mitaller.sucursales for select to authenticated using (mitaller.es_miembro(taller_id));
create policy sucursales_insert on mitaller.sucursales for insert to authenticated
  with check (mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'));
create policy sucursales_update on mitaller.sucursales for update to authenticated
  using (mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'))
  with check (mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'));
create policy sucursales_delete on mitaller.sucursales for delete to authenticated
  using (mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'));

-- Tablas de negocio con la política estándar completa
do $$
declare t text;
begin
  foreach t in array array['clientes', 'vehiculos', 'orden_items', 'articulos'] loop
    execute format('alter table mitaller.%I enable row level security', t);
    execute format('create policy %I on mitaller.%I for select to authenticated using (mitaller.es_miembro(taller_id))', t || '_select', t);
    execute format('create policy %I on mitaller.%I for insert to authenticated with check (mitaller.es_miembro(taller_id))', t || '_insert', t);
    execute format('create policy %I on mitaller.%I for update to authenticated using (mitaller.es_miembro(taller_id)) with check (mitaller.es_miembro(taller_id))', t || '_update', t);
    execute format('create policy %I on mitaller.%I for delete to authenticated using (mitaller.rol_en_taller(taller_id) in (''propietario'',''administrador''))', t || '_delete', t);
  end loop;
end $$;

-- ordenes_trabajo: insert solo vía crear_orden (límite de plan + numeración)
alter table mitaller.ordenes_trabajo enable row level security;
create policy ordenes_trabajo_select on mitaller.ordenes_trabajo for select to authenticated using (mitaller.es_miembro(taller_id));
create policy ordenes_trabajo_update on mitaller.ordenes_trabajo for update to authenticated
  using (mitaller.es_miembro(taller_id)) with check (mitaller.es_miembro(taller_id));
create policy ordenes_trabajo_delete on mitaller.ordenes_trabajo for delete to authenticated
  using (mitaller.rol_en_taller(taller_id) in ('propietario', 'administrador'));

-- historial: inmutable (lo escriben el trigger y las RPC); el cliente solo lee e inserta comentarios propios
alter table mitaller.orden_historial enable row level security;
create policy orden_historial_select on mitaller.orden_historial for select to authenticated using (mitaller.es_miembro(taller_id));
create policy orden_historial_insert on mitaller.orden_historial for insert to authenticated
  with check (mitaller.es_miembro(taller_id) and user_id = auth.uid());

-- facturas / items / pagos: lectura directa, escritura solo por RPC
alter table mitaller.facturas enable row level security;
create policy facturas_select on mitaller.facturas for select to authenticated using (mitaller.es_miembro(taller_id));
alter table mitaller.factura_items enable row level security;
create policy factura_items_select on mitaller.factura_items for select to authenticated using (mitaller.es_miembro(taller_id));
alter table mitaller.pagos enable row level security;
create policy pagos_select on mitaller.pagos for select to authenticated using (mitaller.es_miembro(taller_id));

alter table mitaller.movimientos_inventario enable row level security;
create policy movimientos_inventario_select on mitaller.movimientos_inventario for select to authenticated using (mitaller.es_miembro(taller_id));
create policy movimientos_inventario_insert on mitaller.movimientos_inventario for insert to authenticated
  with check (mitaller.es_miembro(taller_id) and user_id = auth.uid());

-- -------------------------------------------------------------------------------------
-- Grants
-- -------------------------------------------------------------------------------------
grant usage on schema mitaller to anon, authenticated;
grant select, insert, update, delete on all tables in schema mitaller to authenticated;
alter default privileges in schema mitaller grant select, insert, update, delete on tables to authenticated;

-- Las funciones solo para usuarios autenticados (por defecto Postgres da EXECUTE a PUBLIC).
-- Las migraciones futuras que creen funciones deben repetir este revoke/grant.
revoke execute on all functions in schema mitaller from public, anon;
grant execute on all functions in schema mitaller to authenticated;

-- -------------------------------------------------------------------------------------
-- Storage: bucket privado mt-ordenes (path: <taller_id>/<orden_id>/<uuid>.<ext>)
-- -------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mt-ordenes', 'mt-ordenes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy mt_ordenes_select on storage.objects for select to authenticated
  using (bucket_id = 'mt-ordenes' and mitaller.es_miembro_path(name));
create policy mt_ordenes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'mt-ordenes' and mitaller.es_miembro_path(name));
create policy mt_ordenes_update on storage.objects for update to authenticated
  using (bucket_id = 'mt-ordenes' and mitaller.es_miembro_path(name))
  with check (bucket_id = 'mt-ordenes' and mitaller.es_miembro_path(name));
create policy mt_ordenes_delete on storage.objects for delete to authenticated
  using (bucket_id = 'mt-ordenes' and mitaller.es_miembro_path(name));
