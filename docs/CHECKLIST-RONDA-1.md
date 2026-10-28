# Checklist manual — Ronda 1 (`imp mt 28102026`)

Leyenda: `[x]` verificado sin base de datos (build, tests unitarios o revisión de código) · `[ ]` requiere correr la app contra Supabase.

## Verificaciones automáticas
- [x] `npm run build` sin errores ni advertencias de presupuesto (inicial 634 kB; presupuesto 750 kB / 1.5 MB).
- [x] `npm test` verde (66 pruebas, 23 archivos).
- [x] Sin restos: `__API_BASE__`, `test@test.com`, `footer works`, `Workshop Manager`, `Sucursal Norte`, `facebook`, `*ngIf`, `*ngFor`, `HttpClientModule`, textos de dinero `'$…'`.
- [x] SQL `001` y `002` parsean con el parser real de Postgres (`libpg-query`); 18 funciones PL/pgSQL sin errores.
- [x] Ninguna clave `service_role` en el frontend; solo la anon key en `src/environments/`.

## Antes de probar (pendiente del lado de Xaviel)
- [x] `sql/2026-10-28_001_mitaller_base.sql` y `003_mitaller_search_path.sql` aplicadas en X Core (2026-10-28). Probadas en una transacción descartada con dos usuarios y dos talleres: aislamiento RLS, transiciones, ITBIS, pagos y anulación (20 verificaciones correctas).
- [ ] Agregar `mitaller` en Project Settings → API → **Exposed schemas**.
- [ ] Activar el proveedor Google y agregar las URLs de redirección (`/auth/callback`, `/auth/nueva-contrasena`) de localhost y de Vercel.
- [ ] Revisar que las plantillas de correo de X Core no nombren otra app.
- [ ] (Opcional) `002_mitaller_seed_dev.sql` con el `taller_id` de tu taller.

## Flujo completo
- [ ] Registro con correo → (confirmar correo si aplica) → `/onboarding` con el nombre del taller ya escrito.
- [ ] Crear taller → entra a `/home/dashboard` con estado vacío y botón "Recibir mi primer vehículo".
- [ ] Recepción: cliente nuevo + vehículo nuevo + orden (con fotos) → toast "Orden OT-000001 creada" → detalle de la orden.
- [ ] Placa repetida muestra "Ya existe un vehículo con esa placa".
- [ ] Reparaciones: arrastrar la tarjeta a **En progreso** (y con las flechas ←/→); un salto no permitido muestra el error y la tarjeta vuelve.
- [ ] Detalle de la orden: agregar ítems, editar cantidad/precio, marcar completados; totales en vivo y "Total guardado en el sistema" iguales.
- [ ] Diagnóstico y notas se guardan al salir del campo; progreso se guarda al soltar el control.
- [ ] Pasar la orden a **Listo** (con comentario) → aparece en el historial con tu nombre.
- [ ] **Facturar** → `/home/finanzas/facturas/nueva?orden=…` → emitir con NCF opcional → toast y detalle de la factura.
- [ ] Registrar un pago parcial y luego el saldo → la factura pasa a **Pagada**.
- [ ] Un monto mayor al saldo se bloquea en el formulario.
- [ ] Anular una factura sin pagos (solo propietario/administrador) pide motivo.
- [ ] Imprimir / PDF: la vista de impresión oculta el menú y muestra taller, cliente, vehículo, NCF, ítems y totales.
- [ ] Finanzas: tarjetas, chips (Todas/Pendientes/Pagadas/Vencidas/Anuladas), rango de fechas y búsqueda.
- [ ] Dashboard refleja órdenes, listos, vencidas e ingresos del mes.
- [ ] Cerrar sesión → vuelve a `/login`; `/home` sin sesión redirige a `/login`.
- [ ] Iniciar sesión con Google (`/auth/callback` → `/home` o `/onboarding`).
- [ ] Recuperar contraseña: correo → enlace → `/auth/nueva-contrasena` → `/home`.

## Seguridad (probar con dos talleres)
- [ ] Un usuario del taller A no ve clientes, órdenes ni facturas del taller B.
- [ ] Un `mecanico` no puede anular facturas (el botón no aparece y la RPC lo rechaza).
- [ ] Una orden de un plan Gratis rechaza la orden 31 del mes con el mensaje del límite.
- [ ] Dos `crear_orden` simultáneas no repiten número (`OT-…` es único por taller).
