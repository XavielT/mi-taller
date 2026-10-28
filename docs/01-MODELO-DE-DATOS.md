# 01 — Modelo de datos (schema `mitaller`)

Versión 1 · 28-oct-2026. Fuente de verdad para `sql/2026-10-28_001_mitaller_base.sql`. Identificadores en español sin acentos. Toda tabla: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz` (trigger `mitaller.set_updated_at`). Toda tabla de negocio: `taller_id uuid not null references mitaller.talleres(id) on delete cascade` + índice.

## Enums
```sql
create type mitaller.rol_miembro      as enum ('propietario','administrador','recepcionista','mecanico');
create type mitaller.estado_orden     as enum ('recepcion','diagnostico','en_progreso','esperando_repuestos','listo','entregado','cancelado');
create type mitaller.tipo_item        as enum ('mano_obra','repuesto');
create type mitaller.estado_factura   as enum ('pendiente','pagada','vencida','anulada');
create type mitaller.tipo_ncf         as enum ('B01','B02','B14','B15');
create type mitaller.metodo_pago      as enum ('efectivo','transferencia','tarjeta','otro');
create type mitaller.estado_suscripcion as enum ('activa','vencida','cancelada');
create type mitaller.tipo_movimiento  as enum ('entrada','salida','ajuste');
```

## Tablas

### planes
| columna | tipo | nota |
|---|---|---|
| id | text pk | `'gratis'`, `'pro'` |
| nombre | text | |
| precio_mensual | numeric(12,2) | DOP; 0 para gratis |
| limites | jsonb | `{"sucursales":1,"usuarios":3,"ordenes_mes":30}`; `null` = ilimitado |
| activo | boolean default true | |

Seed: `('gratis','Gratis',0,'{"sucursales":1,"usuarios":3,"ordenes_mes":30}')`, `('pro','Pro',1500,null)`.

### talleres (tenant)
| columna | tipo |
|---|---|
| nombre | text not null |
| rnc | text |
| telefono | text |
| email | text |
| direccion | text |
| logo_url | text |
| contadores | jsonb default `{"orden":0,"factura":0}` |
| config | jsonb default `{"itbis":18,"dias_vencimiento":30,"moneda":"DOP"}` |
| creado_por | uuid references auth.users |

### suscripciones
`taller_id`, `plan_id text references planes`, `estado estado_suscripcion default 'activa'`, `inicio date default current_date`, `fin date null`. Única activa por taller (índice parcial).

### sucursales
`taller_id`, `nombre text`, `direccion text`, `telefono text`, `es_principal boolean default false`, `activa boolean default true`.

### miembros
`taller_id`, `user_id uuid references auth.users`, `rol rol_miembro`, `sucursal_id uuid null references sucursales`, `activo boolean default true`. Unique `(taller_id, user_id)`. Índice `(user_id)`.

### perfiles
`user_id uuid pk references auth.users`, `nombre text`, `telefono text`, `avatar_url text`. Se crea en `crear_taller` / al primer login (upsert desde el cliente). RLS: cada usuario ve/edita el suyo; miembros del mismo taller pueden leer nombre (vista `miembros_detalle`).

### clientes
`taller_id`, `nombre text not null`, `telefono text`, `email text`, `documento text` (cédula/RNC), `direccion text`, `notas text`. Índice trigram opcional en `nombre`, índice `(taller_id, telefono)`.

### vehiculos
`taller_id`, `cliente_id references clientes`, `placa text not null`, `marca text`, `modelo text`, `anio int`, `color text`, `vin text`, `kilometraje int`. Unique `(taller_id, placa)`.

### ordenes_trabajo
| columna | tipo | nota |
|---|---|---|
| taller_id, sucursal_id | uuid | |
| numero | text not null | `OT-000001`, unique `(taller_id, numero)` |
| cliente_id, vehiculo_id | uuid | |
| estado | estado_orden default 'recepcion' | |
| motivo | text | queja del cliente |
| diagnostico | text | |
| notas_internas | text | |
| kilometraje_entrada | int | |
| nivel_combustible | int | 0–100 |
| inventario_entrada | jsonb | checklist `{ "gato": true, "llanta_repuesto": false, ... }` |
| fotos | text[] | paths en bucket `mt-ordenes/<taller_id>/<orden_id>/` |
| mecanico_id | uuid null references auth.users | |
| progreso | int default 0 | 0–100, manual |
| recibido_por | uuid references auth.users | |
| fecha_entrada | timestamptz default now() | |
| fecha_promesa | timestamptz | |
| fecha_entrega | timestamptz | se llena al pasar a `entregado` |

### orden_items
`taller_id`, `orden_id references ordenes_trabajo on delete cascade`, `tipo tipo_item`, `descripcion text not null`, `cantidad numeric(10,2) default 1`, `precio_unitario numeric(12,2) default 0`, `aplica_itbis boolean default true`, `articulo_id uuid null references articulos`, `completado boolean default false`, `orden int` (posición).

### orden_historial
`taller_id`, `orden_id`, `de_estado estado_orden null`, `a_estado estado_orden`, `user_id`, `comentario text`, `created_at`. Se inserta por trigger al cambiar `ordenes_trabajo.estado` (y manualmente para comentarios).

### facturas
| columna | tipo | nota |
|---|---|---|
| taller_id, sucursal_id | uuid | |
| numero | text | `FAC-000001`, unique por taller |
| orden_id | uuid null references ordenes_trabajo | unique parcial donde `estado <> 'anulada'` (una factura activa por orden) |
| cliente_id | uuid | |
| tipo_ncf | tipo_ncf null | |
| ncf | text null | manual por ahora |
| subtotal, itbis, total | numeric(12,2) | se congelan al emitir |
| estado | estado_factura default 'pendiente' | |
| fecha_emision | date default current_date | |
| fecha_vencimiento | date | emisión + `config.dias_vencimiento` |
| notas | text | |
| anulada_motivo | text | |

### factura_items
Copia de los ítems de la orden al emitir: `factura_id`, `descripcion`, `tipo`, `cantidad`, `precio_unitario`, `aplica_itbis`, `importe numeric(12,2)`.

### pagos
`taller_id`, `factura_id references facturas`, `monto numeric(12,2) check (monto > 0)`, `metodo metodo_pago`, `referencia text`, `fecha timestamptz default now()`, `registrado_por uuid`, `notas text`.

### articulos (inventario — tabla creada, UI en ronda futura)
`taller_id`, `codigo text`, `nombre text`, `descripcion text`, `precio_venta numeric(12,2)`, `costo numeric(12,2)`, `stock_minimo numeric(10,2) default 0`, `activo boolean`. Unique `(taller_id, codigo)`.

### movimientos_inventario
`taller_id`, `sucursal_id`, `articulo_id`, `tipo tipo_movimiento`, `cantidad numeric(10,2)`, `referencia_tipo text` (`orden` | `factura` | `ajuste`), `referencia_id uuid`, `user_id`.

## Vistas
- `mitaller.ordenes_resumen` — orden + cliente + vehículo + mecánico (nombre de `perfiles`) + `subtotal`, `itbis`, `total` calculados desde `orden_items` + `items_total`, `items_completados`.
- `mitaller.facturas_resumen` — factura + cliente + `pagado` (sum pagos) + `balance` (total − pagado) + `estado_efectivo` (`vencida` si `pendiente` y `fecha_vencimiento < current_date` y balance > 0).
- `mitaller.miembros_detalle` — miembro + nombre/email del perfil.
Todas con `security_invoker = true` para que respeten RLS.

## Funciones / RPC
| función | tipo | qué hace |
|---|---|---|
| `es_miembro(p_taller)` | stable, security definer | membresía activa de `auth.uid()` |
| `rol_en_taller(p_taller)` | stable, security definer | rol o null |
| `crear_taller(p_nombre, p_rnc, p_telefono, p_direccion, p_nombre_usuario)` | security definer | inserta taller, sucursal "Principal" (`es_principal`), miembro `propietario`, suscripción `gratis`, upsert perfil; devuelve el taller |
| `siguiente_numero(p_taller, p_tipo)` | security definer | lock en `talleres`, incrementa `contadores->p_tipo`, devuelve `OT-%06d` / `FAC-%06d` |
| `crear_orden(...)` | security definer | valida límite `ordenes_mes` del plan, asigna número, inserta orden + historial inicial |
| `cambiar_estado_orden(p_orden, p_estado, p_comentario)` | security definer | valida transición permitida, actualiza, llena `fecha_entrega` al entregar |
| `emitir_factura(p_orden, p_tipo_ncf, p_ncf)` | security definer | exige estado `listo`/`entregado`, sin factura activa; copia ítems, calcula totales con `config.itbis`, asigna número |
| `registrar_pago(p_factura, p_monto, p_metodo, p_referencia)` | security definer | valida monto ≤ balance, inserta pago, marca `pagada` si balance 0 |
| `anular_factura(p_factura, p_motivo)` | security definer | solo propietario/administrador, sin pagos o con pagos devueltos (default: bloquea si hay pagos) |
| `resumen_finanzas(p_taller, p_desde, p_hasta)` | stable | ingresos hoy, pendiente, vencido, ticket promedio, ingresos mes actual vs anterior |
| `resumen_dashboard(p_taller)` | stable | conteo de órdenes por estado, por mecánico, facturas vencidas, últimas 5 órdenes |

Todas las RPC comprueban `es_miembro(p_taller)` (o el `taller_id` del recurso) al inicio y lanzan `raise exception` con mensaje en español.

## Transiciones de estado permitidas (orden)
```
recepcion   → diagnostico | en_progreso | cancelado
diagnostico → en_progreso | esperando_repuestos | cancelado
en_progreso → esperando_repuestos | listo | cancelado
esperando_repuestos → en_progreso | cancelado
listo       → entregado | en_progreso
entregado   → (final)
cancelado   → (final)
```

## Storage
Bucket `mt-ordenes` (privado). Políticas: lectura/escritura si `es_miembro((storage.foldername(name))[1]::uuid)`. Fotos ≤ 5 MB, se suben con `upsert` y se guardan los paths en `ordenes_trabajo.fotos`.

## Modelos TypeScript (espejo, `src/shared/models/`)
`plan.model.ts`, `taller.model.ts` (Taller, Sucursal, Miembro, Perfil, Suscripcion), `cliente.model.ts`, `vehiculo.model.ts`, `orden.model.ts` (OrdenTrabajo, OrdenItem, OrdenHistorial, OrdenResumen, EstadoOrden), `factura.model.ts` (Factura, FacturaItem, Pago, FacturaResumen, EstadoFactura, TipoNcf, MetodoPago), `inventario.model.ts`. Se elimina `invoice.model.ts`.
