-- =====================================================================================
-- Mi Taller · 2026-10-29 · 007 · inventario
-- Stock = suma de movimientos_inventario (entrada +, salida −, ajuste con signo). Un solo stock por taller.
-- Regla de negocio (decidida con Xaviel): la pieza sale del stock al agregarla a una orden; cambiar la cantidad,
-- quitar el ítem o cancelar la orden la devuelve. Todo ocurre en triggers: vale aunque falle la pantalla.
-- =====================================================================================

alter table mitaller.movimientos_inventario add column if not exists nota text;

-- Los movimientos solo los escriben las RPC y los triggers (validan stock); se cierra el insert directo.
drop policy if exists movimientos_inventario_insert on mitaller.movimientos_inventario;

create or replace function mitaller.stock_articulo(p_articulo uuid) returns numeric
language sql stable security definer set search_path = mitaller, public as $$
  select coalesce(sum(case tipo when 'entrada' then cantidad when 'salida' then -cantidad else cantidad end), 0)
  from mitaller.movimientos_inventario where articulo_id = p_articulo;
$$;

create or replace view mitaller.articulos_stock with (security_invoker = true) as
select a.*,
       s.stock::numeric(12,2) as stock,
       (a.stock_minimo > 0 and s.stock <= a.stock_minimo) as bajo_minimo
from mitaller.articulos a
cross join lateral (
  select coalesce(sum(case mv.tipo when 'entrada' then mv.cantidad when 'salida' then -mv.cantidad else mv.cantidad end), 0) as stock
  from mitaller.movimientos_inventario mv where mv.articulo_id = a.id
) s;

-- Único punto que escribe movimientos: bloquea la fila del artículo (serializa) y valida que no quede stock negativo.
create or replace function mitaller._mover_stock(
  p_taller uuid, p_articulo uuid, p_tipo mitaller.tipo_movimiento, p_cantidad numeric,
  p_ref_tipo text, p_ref_id uuid, p_nota text
) returns mitaller.movimientos_inventario
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_nombre text;
  v_stock numeric;
  v_mov mitaller.movimientos_inventario;
begin
  select nombre into v_nombre from mitaller.articulos
   where id = p_articulo and taller_id = p_taller for update;
  if not found then
    raise exception 'El artículo no existe en este taller';
  end if;

  v_stock := mitaller.stock_articulo(p_articulo);
  if p_tipo = 'salida' and v_stock < p_cantidad then
    raise exception 'Stock insuficiente de "%": disponible %, solicitado %', v_nombre, v_stock, p_cantidad;
  end if;
  if p_tipo = 'ajuste' and v_stock + p_cantidad < 0 then
    raise exception 'El ajuste dejaría el stock de "%" en negativo (disponible %)', v_nombre, v_stock;
  end if;

  insert into mitaller.movimientos_inventario (taller_id, articulo_id, tipo, cantidad, referencia_tipo, referencia_id, user_id, nota)
  values (p_taller, p_articulo, p_tipo, p_cantidad, p_ref_tipo, p_ref_id, auth.uid(), p_nota)
  returning * into v_mov;
  return v_mov;
end;
$$;

create or replace function mitaller.crear_articulo(
  p_taller uuid,
  p_nombre text,
  p_codigo text default null,
  p_descripcion text default null,
  p_precio_venta numeric default 0,
  p_costo numeric default 0,
  p_stock_minimo numeric default 0,
  p_stock_inicial numeric default 0
) returns mitaller.articulos
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_art mitaller.articulos;
begin
  if not mitaller.es_miembro(p_taller) then
    raise exception 'No tienes acceso a este taller';
  end if;
  if nullif(btrim(coalesce(p_nombre, '')), '') is null then
    raise exception 'El nombre del artículo es requerido';
  end if;
  if coalesce(p_precio_venta, 0) < 0 or coalesce(p_costo, 0) < 0 or coalesce(p_stock_minimo, 0) < 0 or coalesce(p_stock_inicial, 0) < 0 then
    raise exception 'Precio, costo y stock no pueden ser negativos';
  end if;
  if nullif(btrim(coalesce(p_codigo, '')), '') is not null
     and exists (select 1 from mitaller.articulos where taller_id = p_taller and codigo = btrim(p_codigo)) then
    raise exception 'Ya existe un artículo con el código %', btrim(p_codigo);
  end if;

  insert into mitaller.articulos (taller_id, codigo, nombre, descripcion, precio_venta, costo, stock_minimo)
  values (p_taller, nullif(btrim(coalesce(p_codigo, '')), ''), btrim(p_nombre),
          nullif(btrim(coalesce(p_descripcion, '')), ''), coalesce(p_precio_venta, 0), coalesce(p_costo, 0), coalesce(p_stock_minimo, 0))
  returning * into v_art;

  if coalesce(p_stock_inicial, 0) > 0 then
    perform mitaller._mover_stock(p_taller, v_art.id, 'entrada', p_stock_inicial, 'ajuste', v_art.id, 'Stock inicial');
  end if;
  return v_art;
end;
$$;

create or replace function mitaller.registrar_movimiento(
  p_articulo uuid,
  p_tipo mitaller.tipo_movimiento,
  p_cantidad numeric,
  p_nota text default null
) returns mitaller.movimientos_inventario
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_taller uuid;
begin
  select taller_id into v_taller from mitaller.articulos where id = p_articulo;
  if v_taller is null then
    raise exception 'El artículo no existe';
  end if;
  if not mitaller.es_miembro(v_taller) then
    raise exception 'No tienes acceso a este taller';
  end if;
  if p_cantidad is null or p_cantidad = 0 then
    raise exception 'La cantidad no puede ser cero';
  end if;
  if p_tipo in ('entrada', 'salida') and p_cantidad < 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;
  return mitaller._mover_stock(v_taller, p_articulo, p_tipo, p_cantidad, 'ajuste', p_articulo, nullif(btrim(coalesce(p_nota, '')), ''));
end;
$$;

-- -------------------------------------------------------------------------------------
-- Triggers: la pieza sale al agregarla a la orden y vuelve si se quita, se cambia o se cancela la orden
-- -------------------------------------------------------------------------------------
create or replace function mitaller.orden_items_stock_trg() returns trigger
language plpgsql security definer set search_path = mitaller, public as $$
declare
  v_estado mitaller.estado_orden;
  v_delta numeric;
begin
  select estado into v_estado from mitaller.ordenes_trabajo where id = coalesce(new.orden_id, old.orden_id);
  -- orden ya borrada (cascade): su devolución la maneja ordenes_borrar_stock_trg
  if v_estado is null then
    return coalesce(new, old);
  end if;
  if v_estado = 'cancelado' then
    raise exception 'No se pueden modificar los ítems de una orden cancelada';
  end if;

  if tg_op = 'INSERT' then
    if new.articulo_id is not null then
      perform mitaller._mover_stock(new.taller_id, new.articulo_id, 'salida', new.cantidad, 'orden', new.orden_id, 'Uso en la orden');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.articulo_id is not null then
      perform mitaller._mover_stock(old.taller_id, old.articulo_id, 'entrada', old.cantidad, 'orden', old.orden_id, 'Ítem quitado de la orden');
    end if;
    return old;
  end if;

  -- UPDATE
  if old.articulo_id is not distinct from new.articulo_id then
    if new.articulo_id is not null and new.cantidad <> old.cantidad then
      v_delta := new.cantidad - old.cantidad;
      if v_delta > 0 then
        perform mitaller._mover_stock(new.taller_id, new.articulo_id, 'salida', v_delta, 'orden', new.orden_id, 'Cantidad aumentada en la orden');
      else
        perform mitaller._mover_stock(new.taller_id, new.articulo_id, 'entrada', -v_delta, 'orden', new.orden_id, 'Cantidad reducida en la orden');
      end if;
    end if;
  else
    if old.articulo_id is not null then
      perform mitaller._mover_stock(old.taller_id, old.articulo_id, 'entrada', old.cantidad, 'orden', old.orden_id, 'Artículo cambiado en la orden');
    end if;
    if new.articulo_id is not null then
      perform mitaller._mover_stock(new.taller_id, new.articulo_id, 'salida', new.cantidad, 'orden', new.orden_id, 'Uso en la orden');
    end if;
  end if;
  return new;
end;
$$;
create trigger orden_items_stock after insert or update or delete on mitaller.orden_items
  for each row execute function mitaller.orden_items_stock_trg();

create or replace function mitaller.ordenes_cancelar_stock_trg() returns trigger
language plpgsql security definer set search_path = mitaller, public as $$
declare
  r record;
begin
  if new.estado = 'cancelado' and old.estado <> 'cancelado' then
    for r in
      select articulo_id, sum(cantidad) as cant from mitaller.orden_items
      where orden_id = new.id and articulo_id is not null group by articulo_id
    loop
      perform mitaller._mover_stock(new.taller_id, r.articulo_id, 'entrada', r.cant, 'orden', new.id, 'Orden cancelada');
    end loop;
  end if;
  return new;
end;
$$;
create trigger ordenes_trabajo_cancelar_stock after update of estado on mitaller.ordenes_trabajo
  for each row execute function mitaller.ordenes_cancelar_stock_trg();

create or replace function mitaller.ordenes_borrar_stock_trg() returns trigger
language plpgsql security definer set search_path = mitaller, public as $$
declare
  r record;
begin
  if old.estado <> 'cancelado' then
    for r in
      select articulo_id, sum(cantidad) as cant from mitaller.orden_items
      where orden_id = old.id and articulo_id is not null group by articulo_id
    loop
      perform mitaller._mover_stock(old.taller_id, r.articulo_id, 'entrada', r.cant, 'orden', old.id, 'Orden eliminada');
    end loop;
  end if;
  return old;
end;
$$;
create trigger ordenes_trabajo_borrar_stock before delete on mitaller.ordenes_trabajo
  for each row execute function mitaller.ordenes_borrar_stock_trg();

-- Las funciones auxiliares (_mover_stock, stock_articulo, triggers) no deben ser llamables desde la API.
revoke execute on all functions in schema mitaller from public, anon;
grant execute on all functions in schema mitaller to authenticated;
revoke execute on function mitaller._mover_stock(uuid, uuid, mitaller.tipo_movimiento, numeric, text, uuid, text) from authenticated;
revoke execute on function mitaller.orden_items_stock_trg() from authenticated;
revoke execute on function mitaller.ordenes_cancelar_stock_trg() from authenticated;
revoke execute on function mitaller.ordenes_borrar_stock_trg() from authenticated;
