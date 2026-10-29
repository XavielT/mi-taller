-- =====================================================================================
-- Mi Taller · 2026-10-29 · 005 · administrador de la plataforma (dueño del SaaS)
-- Nivel por encima de los roles de cada taller. Un admin de plataforma NO ve los datos de los talleres
-- (clientes, órdenes, facturas): solo métricas agregadas y acciones de administración vía RPC.
-- `admins_plataforma` no lleva taller_id a propósito: no es una tabla de negocio de un taller (regla 4 de CLAUDE.md).
-- =====================================================================================

-- Suspender un taller: bloquea el acceso a sus datos (ver es_miembro / rol_en_taller más abajo).
alter table mitaller.talleres add column if not exists activo boolean not null default true;

create table mitaller.admins_plataforma (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  nota        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create trigger admins_plataforma_set_updated_at before update on mitaller.admins_plataforma
  for each row execute function mitaller.set_updated_at();

alter table mitaller.admins_plataforma enable row level security;
create policy admins_plataforma_select on mitaller.admins_plataforma for select to authenticated
  using (user_id = auth.uid());
-- Sin políticas de escritura: solo se agregan admins con SQL (service role / editor SQL).
revoke insert, update, delete on mitaller.admins_plataforma from authenticated;

create or replace function mitaller.es_admin_plataforma() returns boolean
language sql stable security definer set search_path = mitaller, public as $$
  select exists (select 1 from mitaller.admins_plataforma where user_id = auth.uid());
$$;

create or replace function mitaller.exigir_admin_plataforma() returns void
language plpgsql stable security definer set search_path = mitaller, public as $$
begin
  if not mitaller.es_admin_plataforma() then
    raise exception 'No tienes permiso de administrador de la plataforma';
  end if;
end;
$$;

-- Un taller suspendido deja de ser accesible para sus miembros (select, insert, update y delete por RLS).
create or replace function mitaller.es_miembro(p_taller uuid) returns boolean
language sql stable security definer set search_path = mitaller, public as $$
  select exists (
    select 1
    from mitaller.miembros m
    join mitaller.talleres t on t.id = m.taller_id
    where m.taller_id = p_taller and m.user_id = auth.uid() and m.activo and t.activo
  );
$$;

create or replace function mitaller.rol_en_taller(p_taller uuid) returns mitaller.rol_miembro
language sql stable security definer set search_path = mitaller, public as $$
  select m.rol
  from mitaller.miembros m
  join mitaller.talleres t on t.id = m.taller_id
  where m.taller_id = p_taller and m.user_id = auth.uid() and m.activo and t.activo
  limit 1;
$$;

-- mis_talleres sigue listando los talleres suspendidos (con activo = false) para poder avisarle al usuario.
create or replace function mitaller.mis_talleres() returns setof mitaller.talleres
language sql stable security definer set search_path = mitaller, public as $$
  select t.* from mitaller.talleres t
  join mitaller.miembros m on m.taller_id = t.id
  where m.user_id = auth.uid() and m.activo
  order by t.created_at;
$$;

-- -------------------------------------------------------------------------------------
-- RPCs de administración (todas exigen es_admin_plataforma)
-- -------------------------------------------------------------------------------------
create or replace function mitaller.admin_resumen() returns jsonb
language plpgsql stable security definer set search_path = mitaller, public as $$
begin
  perform mitaller.exigir_admin_plataforma();
  return jsonb_build_object(
    'talleres',        (select count(*) from mitaller.talleres),
    'talleres_activos',(select count(*) from mitaller.talleres where activo),
    'usuarios',        (select count(distinct user_id) from mitaller.miembros where activo),
    'ordenes_mes',     (select count(*) from mitaller.ordenes_trabajo where created_at >= date_trunc('month', now())),
    'facturado_mes',   (select coalesce(sum(total), 0) from mitaller.facturas
                         where estado <> 'anulada' and fecha_emision >= date_trunc('month', current_date)),
    'por_plan',        (select coalesce(jsonb_object_agg(plan_id, n), '{}'::jsonb)
                         from (select plan_id, count(*) as n from mitaller.suscripciones
                               where estado = 'activa' group by plan_id) x)
  );
end;
$$;

create or replace function mitaller.admin_listar_talleres()
returns table (
  id uuid, nombre text, rnc text, activo boolean, plan_id text, plan_nombre text,
  miembros int, ordenes int, ordenes_mes int, facturas int, propietario text, created_at timestamptz
)
language plpgsql stable security definer set search_path = mitaller, public as $$
#variable_conflict use_column
begin
  perform mitaller.exigir_admin_plataforma();
  return query
  select t.id, t.nombre, t.rnc, t.activo, s.plan_id, pl.nombre,
         (select count(*)::int from mitaller.miembros m where m.taller_id = t.id and m.activo),
         (select count(*)::int from mitaller.ordenes_trabajo o where o.taller_id = t.id),
         (select count(*)::int from mitaller.ordenes_trabajo o where o.taller_id = t.id and o.created_at >= date_trunc('month', now())),
         (select count(*)::int from mitaller.facturas f where f.taller_id = t.id),
         (select u.email::text from mitaller.miembros m join auth.users u on u.id = m.user_id
           where m.taller_id = t.id and m.rol = 'propietario' order by m.created_at limit 1),
         t.created_at
  from mitaller.talleres t
  left join mitaller.suscripciones s on s.taller_id = t.id and s.estado = 'activa'
  left join mitaller.planes pl on pl.id = s.plan_id
  order by t.created_at desc;
end;
$$;

-- Solo usuarios que pertenecen a Mi Taller: auth.users es compartido con otras apps y no se expone completo.
create or replace function mitaller.admin_listar_usuarios()
returns table (
  user_id uuid, email text, nombre text, creado timestamptz, ultimo_acceso timestamptz, talleres int, roles text
)
language plpgsql stable security definer set search_path = mitaller, public as $$
#variable_conflict use_column
begin
  perform mitaller.exigir_admin_plataforma();
  return query
  select u.id, u.email::text, coalesce(p.nombre, u.raw_user_meta_data ->> 'nombre'), u.created_at, u.last_sign_in_at,
         (select count(*)::int from mitaller.miembros m where m.user_id = u.id and m.activo),
         (select string_agg(distinct m.rol::text, ', ') from mitaller.miembros m where m.user_id = u.id and m.activo)
  from auth.users u
  left join mitaller.perfiles p on p.user_id = u.id
  where exists (select 1 from mitaller.miembros m where m.user_id = u.id)
     or p.user_id is not null
  order by u.created_at desc;
end;
$$;

create or replace function mitaller.admin_cambiar_plan(p_taller uuid, p_plan text) returns void
language plpgsql security definer set search_path = mitaller, public as $$
begin
  perform mitaller.exigir_admin_plataforma();
  if not exists (select 1 from mitaller.planes where id = p_plan and activo) then
    raise exception 'El plan no existe o no está disponible';
  end if;
  if not exists (select 1 from mitaller.talleres where id = p_taller) then
    raise exception 'El taller no existe';
  end if;
  if exists (select 1 from mitaller.suscripciones where taller_id = p_taller and estado = 'activa' and plan_id = p_plan) then
    return;
  end if;
  update mitaller.suscripciones set estado = 'cancelada', fin = current_date
   where taller_id = p_taller and estado = 'activa';
  insert into mitaller.suscripciones (taller_id, plan_id) values (p_taller, p_plan);
end;
$$;

create or replace function mitaller.admin_activar_taller(p_taller uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = mitaller, public as $$
begin
  perform mitaller.exigir_admin_plataforma();
  update mitaller.talleres set activo = coalesce(p_activo, true) where id = p_taller;
  if not found then
    raise exception 'El taller no existe';
  end if;
end;
$$;

-- Las funciones nuevas heredan EXECUTE para PUBLIC: repetir revoke/grant (ver migración 001).
revoke execute on all functions in schema mitaller from public, anon;
grant execute on all functions in schema mitaller to authenticated;
