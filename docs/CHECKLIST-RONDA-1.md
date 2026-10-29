# Checklist manual — Ronda 1 (`imp mt 28102026`)

Leyenda: `[x]` verificado sin base de datos (build, tests unitarios o revisión de código) · `[ ]` requiere correr la app contra Supabase.

## Verificaciones automáticas
- [x] `npm run build` sin errores ni advertencias de presupuesto (inicial 634 kB; presupuesto 750 kB / 1.5 MB).
- [x] `npm test` verde (66 pruebas, 23 archivos).
- [x] Sin restos: `__API_BASE__`, `test@test.com`, `footer works`, `Workshop Manager`, `Sucursal Norte`, `facebook`, `*ngIf`, `*ngFor`, `HttpClientModule`, textos de dinero `'$…'`.
- [x] SQL `001` y `002` parsean con el parser real de Postgres (`libpg-query`); 18 funciones PL/pgSQL sin errores.
- [x] Ninguna clave `service_role` en el frontend; solo la anon key en `src/environments/`.

## Antes de probar (pendiente del lado de Xaviel)
- [x] `sql/2026-10-28_001_mitaller_base.sql` y `003_mitaller_search_path.sql` aplicadas en x-core, ref `nakgrkcqyuycadeuenuw` (2026-10-29), y schema `mitaller` agregado a Exposed schemas. Probadas en una transacción descartada con dos usuarios y dos talleres: aislamiento RLS, transiciones, ITBIS, pagos y anulación (20 verificaciones correctas).
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

## Administrador de la plataforma (2026-10-29)
- [x] Migraciones `005` (tabla `admins_plataforma`, RPCs `admin_*`, columna `talleres.activo`) y `006` (seed de `xavieldev@gmail.com`) aplicadas en x-core. Probadas en una transacción descartada: usuario normal rechazado, sin auto-promoción, el admin no ve datos de talleres, suspender bloquea escrituras y reactivar las restaura (13 verificaciones).
- [x] `sql/2026-10-29_004_xcore_registro_abierto_mitaller.sql` aplicada en x-core (2026-10-29, con autorización de Xaviel). Sin ella, `signUp` fallaba con "Sign-ups are invite-only" (trigger `enforce_invite_only`, de Music Hub).
- [ ] Iniciar sesión con `xavieldev@gmail.com` → aparece el enlace "Administración" y `/admin` carga métricas, talleres y usuarios.
- [ ] Cambiar el plan de un taller y suspenderlo/reactivarlo desde `/admin`.

## Ronda de mejoras (2026-10-29) — migraciones 007 a 010 aplicadas en x-core
Probadas en transacciones descartadas: inventario (15 verificaciones), sucursales y equipo (25), configuración y 607 (10).
- [ ] **Inventario:** crear un artículo con stock inicial → agregarlo a una orden desde el selector de ítems → el stock baja. Cambiar la cantidad, quitar el ítem o cancelar la orden lo devuelve. Pedir más de lo que hay muestra "Stock insuficiente". Filtro "Stock bajo" y modal de Movimientos (entrada, salida, ajuste).
- [ ] **Sucursales:** en plan Gratis el botón "Nueva sucursal" queda bloqueado con el aviso del límite; con plan Pro se crean, se define la principal y se desactivan (no la principal ni una con órdenes abiertas).
- [ ] **Equipo:** invitar a alguien → aparece el enlace una sola vez (copiar / WhatsApp) → abrirlo en otra ventana: sin sesión muestra el taller y el rol; al iniciar sesión o registrarse entra directo al taller. Cambiar rol y sucursal, quitar miembro (pierde el acceso). Límite de 3 usuarios en Gratis (cuentan las invitaciones pendientes).
- [ ] **Configuración:** editar datos, ITBIS y días de vencimiento; subir y quitar el logo (PNG/JPG/WebP, máx. 1 MB); el logo sale en el menú y en la factura impresa.
- [ ] **Exportes:** en Finanzas, 607 (CSV, solo facturas con NCF) y Facturas del mes; en Clientes, Exportar CSV. Abrir en Excel: acentos correctos.
- [ ] **WhatsApp:** botón "Avisar por WhatsApp" en la orden (solo si el cliente tiene un teléfono válido); el mensaje cambia con el estado.
- [ ] **404:** una dirección inexistente muestra "Página no encontrada".
- [ ] Un `mecanico` no ve "Configuración" y no puede invitar ni quitar personas.
