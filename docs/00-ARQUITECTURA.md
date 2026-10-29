# 00 — Arquitectura de Mi Taller

Versión 1 · 28-oct-2026 · Autor: Xaviel Terrero (con Claude)

## 1. Qué es
SaaS multi-tenant para talleres mecánicos. Un taller se registra, crea su cuenta (tenant), invita a su gente y gestiona: recepción de vehículos, órdenes de trabajo, reparaciones (tablero), facturación con ITBIS/NCF, cobros, inventario y sucursales. Mercado inicial: República Dominicana.

## 2. Stack y topología

```
┌──────────────────────────────┐        ┌─────────────────────────────────────┐
│  Angular 21 SPA (Vercel)     │  HTTPS │  Supabase "X Core" (compartido)      │
│  signals · lazy routes       │ ─────▶ │  Postgres · schema `mitaller`        │
│  supabase-js (anon key)      │        │  Auth (email+pass, Google)           │
│  SCSS + CSS vars             │        │  Storage bucket `mt-ordenes`         │
└──────────────────────────────┘        │  Edge Functions `mt-*` (futuro)      │
                                        └─────────────────────────────────────┘
```

- **Sin SSR.** SPA pura; `/` es el login hoy (la landing pública es backlog).
- **Schema propio `mitaller`.** Mi Taller convive con otras apps en el proyecto X Core; nada se crea en `public`. Migración futura a proyecto propio = `pg_dump --schema=mitaller` + recrear usuarios de Auth.
- **Auth compartida.** `auth.users` es del proyecto X Core. Un usuario "es de Mi Taller" solo si tiene filas en `mitaller.miembros`. Sin membresías → `/onboarding`.
- **Seguridad = RLS.** El frontend usa la anon key; toda tabla tiene RLS; las operaciones que cruzan tenants o necesitan privilegios (crear taller, numeración, resumen financiero) son RPCs `security definer` dentro del schema `mitaller`.

## 3. Multi-tenant

| Concepto | Tabla | Nota |
|---|---|---|
| Tenant | `talleres` | nombre, RNC, teléfono, dirección, logo, `contadores jsonb` (secuencias OT/FAC), `config jsonb` (ITBIS %, días de vencimiento) |
| Sucursal | `sucursales` | mínimo una ("Principal") creada por `crear_taller` |
| Membresía | `miembros` | `(taller_id, user_id)` único, `rol`, `sucursal_id` opcional, `activo` |
| Plan | `planes` + `suscripciones` | `planes.limites jsonb` = `{ "sucursales": 1, "usuarios": 3, "ordenes_mes": 30 }`; Pro = `null` (ilimitado) |

Helpers SQL (todas `stable`, `security definer`, `search_path = mitaller`):
- `mitaller.es_miembro(p_taller uuid) returns boolean` — existe miembro activo para `auth.uid()`.
- `mitaller.rol_en_taller(p_taller uuid) returns mitaller.rol_miembro`.
- `mitaller.mis_talleres() returns setof talleres`.

Política estándar por tabla de negocio:
```sql
alter table mitaller.<tabla> enable row level security;
create policy "<tabla>_select" on mitaller.<tabla> for select using (mitaller.es_miembro(taller_id));
create policy "<tabla>_insert" on mitaller.<tabla> for insert with check (mitaller.es_miembro(taller_id));
create policy "<tabla>_update" on mitaller.<tabla> for update using (mitaller.es_miembro(taller_id));
create policy "<tabla>_delete" on mitaller.<tabla> for delete using (mitaller.rol_en_taller(taller_id) in ('propietario','administrador'));
```
Restricciones por rol más finas (p. ej. `mecanico` no anula facturas) se aplican en políticas específicas y se duplican en la UI (ocultar botón), nunca solo en la UI.

Cliente supabase-js: `createClient(url, anonKey, { db: { schema: 'mitaller' }, auth: { persistSession: true, autoRefreshToken: true } })`. El schema `mitaller` debe estar en "Exposed schemas" del proyecto.

## 4. Frontend

### Estado
- `AuthService` → signals `session`, `user`, `isAuthenticated`, `loading`. Escucha `onAuthStateChange`.
- `TallerStore` → `talleres`, `tallerActivo`, `sucursalActiva`, `rol`, `plan`, `limites`. Persiste `mt.tallerActivo` en `localStorage`. Se hidrata después del login; todos los servicios de dominio leen `tallerActivo().id` de aquí.
- Cada página tiene su estado local con signals; nada de NgRx.

### Rutas
```
/                      Auth shell → redirect login
/login  /register      (redirigen a /home si hay sesión)
/auth/callback         OAuth Google
/auth/recuperar  /auth/nueva-contrasena
/onboarding            authGuard · crea el taller
/home                  authGuard + tallerGuard · shell (navbar + header + footer)
  /home/dashboard
  /home/recepcion              recibir vehículo
  /home/recepcion/clientes     lista / detalle
  /home/ordenes/:id            detalle OT
  /home/reparaciones           kanban
  /home/finanzas               facturas + pagos
  /home/finanzas/facturas/:id  detalle + imprimir
  /home/inventario             (placeholder esta ronda)
  /home/sucursales             (placeholder esta ronda)
```

### Capas
`page` (ruta, orquesta) → `components` (presentación) → `services/<dominio>.service.ts` (llama a Supabase, devuelve tipos de `models/`) → `SupabaseService`.
Errores: los servicios lanzan `Error` con mensaje en español; las páginas los muestran con `mt-toast`.

### UI
Paleta y fuentes de `styles.scss` (navy `--primary #002547`, naranja `--secondary #fc9d33`, fondo `--bg #f7fafc`). Componentes `mt-*` en `shared/ui`, cada uno con su SCSS usando solo variables. Responsive desde 360 px; navbar colapsa a drawer bajo 900 px.

## 5. Numeración y dinero
- Secuencias por taller: `mitaller.siguiente_numero(p_taller uuid, p_tipo text) returns text` — hace `update talleres set contadores = ...` con `for update`, devuelve `OT-000012` / `FAC-000007`.
- Montos `numeric(12,2)`; ITBIS por ítem (`aplica_itbis boolean`), tasa en `talleres.config->>'itbis'` (default 18). Totales de orden y factura se calculan en vistas (`ordenes_resumen`, `facturas_resumen`) para que la verdad esté en la DB.

## 6. Entornos
- `environment.development.ts` → X Core (dev). `environment.ts` → X Core (prod) hasta tener proyecto propio.
- Variables: `supabaseUrl`, `supabaseAnonKey`, `supabaseSchema`, `appName`, `appUrl`.
- Deploy: Vercel, `vercel.json` con rewrite `{"source":"/(.*)","destination":"/index.html"}`.

## 7. Defaults vigentes (aplicar sin preguntar)
- Login social: solo Google. ITBIS 18 %. Vencimiento factura 30 días. Plan Gratis: 1 sucursal / 3 usuarios / 30 OT por mes. Un usuario puede estar en varios talleres. Estados de OT y factura: ver `CLAUDE.md`. Kanban con HTML5 drag & drop nativo. PDF de factura = vista imprimible (`@media print`).

## 8. Backlog arquitectónico
Inventario con descuento automático · sucursales múltiples en UI · citas y recordatorios · cotizaciones con aprobación por link · NCF automáticos y 606/607/e-CF · cobro de planes · landing pública · portal del cliente · PWA para mecánicos · migración a proyecto Supabase propio.


## Administrador de la plataforma
Nivel por encima de los roles de cada taller: usuarios listados en `mitaller.admins_plataforma` (sin `taller_id`, no es tabla de negocio). Se agregan solo con SQL; ningún cliente puede escribir en la tabla.
- No ve los datos de los talleres (clientes, órdenes, facturas). Solo métricas agregadas y acciones por RPC `security definer` que llaman a `exigir_admin_plataforma()`: `admin_resumen`, `admin_listar_talleres`, `admin_listar_usuarios` (solo usuarios con membresía o perfil de Mi Taller, porque `auth.users` es compartido), `admin_cambiar_plan`, `admin_activar_taller`.
- Suspender un taller (`talleres.activo = false`) hace que `es_miembro` y `rol_en_taller` devuelvan falso: el RLS bloquea lectura y escritura. `mis_talleres` lo sigue listando para mostrar `/suspendido`.
- Frontend: ruta `/admin` con `adminGuard`; `TallerStore.esAdminPlataforma` se carga junto a los talleres. Un admin sin taller entra directo a `/admin` en lugar de `/onboarding`.

## Registro en el proyecto compartido x-core
El trigger `public.enforce_invite_only` (Music Hub) rechaza registros salvo correo permitido, invitación o `raw_user_meta_data.app` autorizado. Mi Taller envía `app: 'mitaller'` y requiere agregarlo a esa lista (migración `004`). Mover Mi Taller a su propio proyecto elimina esta dependencia.


## Inventario (migración 007)
Stock = suma de `movimientos_inventario` (entrada +, salida −, ajuste con signo), un stock por taller. La pieza sale al agregar el ítem a una orden con `articulo_id` y vuelve al cambiar la cantidad, quitar el ítem, cambiar de artículo, cancelar o borrar la orden: todo en triggers (`orden_items_stock_trg`, `ordenes_cancelar_stock_trg`, `ordenes_borrar_stock_trg`) sobre el único escritor `_mover_stock`, que bloquea la fila del artículo y rechaza stock negativo. Los movimientos no se insertan desde el cliente: solo `crear_articulo` y `registrar_movimiento`. Vista `articulos_stock` (stock y `bajo_minimo`).

## Sucursales y equipo (migración 008)
- Sucursales: escritura solo por RPC (`crear_sucursal`, `actualizar_sucursal`, `activar_sucursal`, `definir_sucursal_principal`); límite de `planes.limites.sucursales`; una sola principal (índice parcial único). `crear_orden` usa la sucursal del miembro y, si no tiene, la principal.
- Equipo: `invitaciones` con **token secreto** (se guarda su hash, el token en claro solo se devuelve al crear). No se liga al correo porque x-core no verifica correos al registrarse. `ver_invitacion` es el único RPC accesible sin sesión. `aceptar_invitacion` crea la membresía; si el usuario aún no tenía sesión, el token espera en `localStorage` (`mt.invitacionPendiente`) y `TallerStore.cargar()` lo acepta. Cambios de miembros solo por RPC (`cambiar_miembro`, `quitar_miembro`): solo el propietario asigna o quita administradores; el propietario no se toca. Límite `usuarios` cuenta miembros activos más invitaciones pendientes.

## Configuración, logo y reportes (migración 009)
`actualizar_taller` y `definir_logo` reemplazan el update directo de `talleres` (que permitía tocar `contadores`). Logo en el bucket público `mt-logos/<taller_id>/…`, solo propietario o administrador escriben. `reporte_607` devuelve una fila por factura no anulada del período; el CSV (solo facturas con NCF) es un borrador para el contador, no el archivo de carga de la DGII. Exportes de clientes y facturas se generan en el navegador.

## Ajustes del advisor (migración 010)
`auth.uid()` evaluado una vez por consulta en políticas RLS, índices en llaves foráneas por sucursal/artículo/plan y `search_path` fijo en `_hash_token`. Los avisos "SECURITY DEFINER ejecutable por authenticated" de las RPC de `mitaller` son por diseño: cada una valida el rol dentro.
