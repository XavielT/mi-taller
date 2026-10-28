-- =====================================================================================
-- Mi Taller · datos de prueba SOLO PARA DESARROLLO · 2026-10-28
-- Requiere haber aplicado 2026-10-28_001_mitaller_base.sql y tener un taller creado
-- (regístrate en la app y completa /onboarding).
--
-- Uso: reemplaza '<<TALLER_ID>>' por el id del taller (select id, nombre from mitaller.talleres;)
-- y ejecuta en el SQL editor. NO ejecutar en producción.
--
-- Inserta: 3 clientes, 4 vehículos, 5 órdenes (en distintos estados, con ítems),
-- 2 facturas y 1 pago. Corre como postgres, por eso asigna los números directamente
-- (siguiente_numero exige un usuario autenticado) y deja los contadores del taller al día.
-- =====================================================================================

do $$
declare
  v_taller uuid := '<<TALLER_ID>>';
  v_sucursal uuid;
  c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid(); c3 uuid := gen_random_uuid();
  v1 uuid := gen_random_uuid(); v2 uuid := gen_random_uuid(); v3 uuid := gen_random_uuid(); v4 uuid := gen_random_uuid();
  o1 uuid := gen_random_uuid(); o2 uuid := gen_random_uuid(); o3 uuid := gen_random_uuid();
  o4 uuid := gen_random_uuid(); o5 uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid();
begin
  if not exists (select 1 from mitaller.talleres where id = v_taller) then
    raise exception 'Reemplaza <<TALLER_ID>> por el id de un taller existente';
  end if;

  select id into v_sucursal from mitaller.sucursales
  where taller_id = v_taller and es_principal order by created_at limit 1;

  insert into mitaller.clientes (id, taller_id, nombre, telefono, email, documento, direccion) values
    (c1, v_taller, 'Carlos Rodríguez', '809-555-0101', 'carlos@example.com', '001-0000001-1', 'Av. Winston Churchill 12, Santo Domingo'),
    (c2, v_taller, 'Elena Martínez',   '829-555-0102', 'elena@example.com',  '001-0000002-2', 'Calle Duarte 45, Santiago'),
    (c3, v_taller, 'Logística del Caribe SRL', '809-555-0103', 'compras@logcaribe.example', '130000001', 'Zona Industrial Herrera');

  insert into mitaller.vehiculos (id, taller_id, cliente_id, placa, marca, modelo, anio, color, kilometraje) values
    (v1, v_taller, c1, 'A123456', 'Toyota', 'Corolla', 2019, 'Gris',   84500),
    (v2, v_taller, c1, 'A654321', 'Honda',  'CR-V',    2021, 'Blanco', 41200),
    (v3, v_taller, c2, 'G987654', 'Hyundai','Tucson',  2020, 'Rojo',   63000),
    (v4, v_taller, c3, 'L555111', 'Mercedes-Benz', 'Sprinter', 2018, 'Blanco', 152000);

  insert into mitaller.ordenes_trabajo
    (id, taller_id, sucursal_id, numero, cliente_id, vehiculo_id, estado, motivo, diagnostico, kilometraje_entrada,
     nivel_combustible, inventario_entrada, progreso, fecha_entrada, fecha_promesa, fecha_entrega) values
    (o1, v_taller, v_sucursal, 'OT-000001', c1, v1, 'recepcion',  'Ruido al frenar', null, 84500, 50,
       '{"gato":true,"llave_ruedas":true,"llanta_repuesto":true,"documentos":true}', 0, now() - interval '1 hour', now() + interval '2 days', null),
    (o2, v_taller, v_sucursal, 'OT-000002', c2, v3, 'diagnostico', 'Luz de motor encendida', 'Escaneo pendiente de sensor de oxígeno', 63000, 25,
       '{"radio":true,"alfombras":true}', 10, now() - interval '1 day', now() + interval '3 days', null),
    (o3, v_taller, v_sucursal, 'OT-000003', c3, v4, 'en_progreso', 'Mantenimiento de 150,000 km', 'Cambio de aceite, filtros y pastillas', 152000, 75,
       '{"gato":true,"extintor":true}', 55, now() - interval '2 days', now() + interval '1 day', null),
    (o4, v_taller, v_sucursal, 'OT-000004', c1, v2, 'listo',       'Cambio de aceite y revisión general', 'Todo en orden', 41200, 100,
       '{"documentos":true}', 100, now() - interval '3 days', now() - interval '1 day', null),
    (o5, v_taller, v_sucursal, 'OT-000005', c2, v3, 'entregado',   'Alineación y balanceo', 'Alineación fuera de rango', 62000, 50,
       '{}', 100, now() - interval '10 days', now() - interval '8 days', now() - interval '8 days');

  insert into mitaller.orden_historial (taller_id, orden_id, de_estado, a_estado, comentario) values
    (v_taller, o1, null, 'recepcion', 'Vehículo recibido'),
    (v_taller, o2, null, 'recepcion', 'Vehículo recibido'),
    (v_taller, o2, 'recepcion', 'diagnostico', null),
    (v_taller, o3, null, 'recepcion', 'Vehículo recibido'),
    (v_taller, o3, 'recepcion', 'en_progreso', 'Aprobado por el cliente'),
    (v_taller, o4, null, 'recepcion', 'Vehículo recibido'),
    (v_taller, o4, 'recepcion', 'en_progreso', null),
    (v_taller, o4, 'en_progreso', 'listo', 'Listo para entrega'),
    (v_taller, o5, null, 'recepcion', 'Vehículo recibido'),
    (v_taller, o5, 'recepcion', 'en_progreso', null),
    (v_taller, o5, 'en_progreso', 'listo', null),
    (v_taller, o5, 'listo', 'entregado', 'Entregado al cliente');

  insert into mitaller.orden_items (taller_id, orden_id, tipo, descripcion, cantidad, precio_unitario, aplica_itbis, completado, orden) values
    (v_taller, o2, 'mano_obra', 'Diagnóstico con escáner', 1, 1500, true, true, 1),
    (v_taller, o3, 'mano_obra', 'Servicio de mantenimiento mayor', 1, 4500, true, true, 1),
    (v_taller, o3, 'repuesto',  'Aceite sintético 5W-30 (litros)', 8, 650, true, true, 2),
    (v_taller, o3, 'repuesto',  'Juego de pastillas de freno', 1, 3800, true, false, 3),
    (v_taller, o4, 'mano_obra', 'Cambio de aceite', 1, 800, true, true, 1),
    (v_taller, o4, 'repuesto',  'Filtro de aceite', 1, 450, true, true, 2),
    (v_taller, o4, 'repuesto',  'Aceite 0W-20 (litros)', 4, 700, true, true, 3),
    (v_taller, o5, 'mano_obra', 'Alineación y balanceo', 1, 2500, true, true, 1),
    (v_taller, o5, 'repuesto',  'Plomos de balanceo', 1, 300, false, true, 2);

  -- Factura 1: orden OT-000005, pagada completa. Subtotal 2800; ITBIS 18 % sobre 2500 = 450; total 3250
  insert into mitaller.facturas
    (id, taller_id, sucursal_id, numero, orden_id, cliente_id, tipo_ncf, ncf, subtotal, itbis, total, estado,
     fecha_emision, fecha_vencimiento) values
    (f1, v_taller, v_sucursal, 'FAC-000001', o5, c2, 'B02', 'B0200000001', 2800.00, 450.00, 3250.00, 'pagada',
     current_date - 8, current_date + 22);

  -- Factura 2: orden OT-000004, pendiente y ya vencida. Subtotal 4050; ITBIS 729; total 4779
  insert into mitaller.facturas
    (id, taller_id, sucursal_id, numero, orden_id, cliente_id, tipo_ncf, subtotal, itbis, total, estado,
     fecha_emision, fecha_vencimiento) values
    (f2, v_taller, v_sucursal, 'FAC-000002', o4, c1, 'B01', 4050.00, 729.00, 4779.00, 'pendiente',
     current_date - 40, current_date - 10);

  insert into mitaller.factura_items (taller_id, factura_id, descripcion, tipo, cantidad, precio_unitario, aplica_itbis, importe) values
    (v_taller, f1, 'Alineación y balanceo', 'mano_obra', 1, 2500, true, 2500),
    (v_taller, f1, 'Plomos de balanceo', 'repuesto', 1, 300, false, 300),
    (v_taller, f2, 'Cambio de aceite', 'mano_obra', 1, 800, true, 800),
    (v_taller, f2, 'Filtro de aceite', 'repuesto', 1, 450, true, 450),
    (v_taller, f2, 'Aceite 0W-20 (litros)', 'repuesto', 4, 700, true, 2800);

  insert into mitaller.pagos (taller_id, factura_id, monto, metodo, referencia, fecha) values
    (v_taller, f1, 3250.00, 'transferencia', 'TRF-889900', now() - interval '8 days');

  -- contadores al día para que los próximos números sean OT-000006 / FAC-000003
  update mitaller.talleres
     set contadores = jsonb_set(jsonb_set(contadores, '{orden}', '5'), '{factura}', '2')
   where id = v_taller;
end $$;
