# Mi Taller — CLAUDE.md

Multi-tenant SaaS for auto repair shops (talleres) in the Dominican Republic. One codebase, one database, every taller isolated by `taller_id` + Postgres RLS.

## Stack (fixed decisions — do not propose alternatives)
- **Frontend:** Angular 21 standalone components, signals, new control flow (`@if/@for/@switch`), lazy routes (`loadComponent`), Reactive Forms, SCSS with CSS variables from `src/styles.scss`. **No Tailwind, no UI library.** Shared UI primitives live in `src/shared/ui/` (prefix `mt-`).
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions). During development Mi Taller lives inside the shared Supabase project **"X Core"**, so **everything belongs to the Postgres schema `mitaller`** — never create objects in `public`. Edge functions and storage buckets are prefixed `mt-`. One day the schema is moved to its own project with `pg_dump --schema=mitaller`; keep that migration trivial.
- **Client:** `@supabase/supabase-js` v2 via `SupabaseService` (single client, `db: { schema: 'mitaller' }`). `HttpClient` only for third-party APIs.
- **Hosting:** Vercel (SPA rewrite to `index.html`).
- **Locale:** UI text in Spanish (with correct accents), locale `es-DO`, currency `DOP`, ITBIS 18 %.

## House rules
1. **Never commit, push or deploy without telling Xaviel first.** Leave changes in the working tree and report.
2. **SQL migrations** are additive and backward compatible, dated and numbered in `sql/` (`YYYY-MM-DD_NNN_descripcion.sql`). Never edit an applied migration; add a new one.
3. **Service role key never reaches the frontend.** Only the anon key goes in `src/environments/`. Privileged operations are `security definer` RPCs or edge functions.
4. **Every business table** has `taller_id uuid not null`, `created_at`, `updated_at` and RLS policies using `mitaller.es_miembro(taller_id)`.
5. **Money** is `numeric(12,2)` in the DB and `number` in TypeScript — never strings. Format only in templates (`CurrencyPipe`, `'DOP'`).
6. **Don't block on pending decisions.** If something is undecided, apply the documented default (see `docs/00-ARQUITECTURA.md`) and report it in the closing summary.
7. Prompts to you are in English; UI strings, DB identifiers (tables, columns, enums) and round docs are in Spanish without accents in identifiers (`ordenes_trabajo`, `mecanico`).
8. Prefer small components + a service per domain (`shared/services/<dominio>.service.ts`) + a signal store per cross-cutting state (`shared/stores/`).

## Commands
```bash
npm install
npm start            # ng serve → http://localhost:4200
npm run build        # production build; must pass with no budget warnings
npm test             # vitest via ng test; must be green before reporting
```

## Folder map
```
src/
  app/
    app.config.ts / app.routes.ts      # providers, lazy routes
    pages/                             # routed pages (auth, onboarding, home shell, dashboard, recepcion, ordenes, reparaciones, finanzas, inventario, sucursales)
    components/                        # page-specific components (login, register, ...)
  shared/
    components/   # navbar, header, footer
    ui/           # mt-button, mt-input, mt-select, mt-modal, mt-toast, mt-table, mt-badge-estado, mt-empty-state, mt-page-header
    services/     # supabase, auth, clientes, vehiculos, ordenes, facturas, pagos, finanzas, talleres
    stores/       # taller.store.ts (active taller / sucursal / rol / plan)
    guards/       # auth.guard, taller.guard, rol.guard
    models/       # TS interfaces mirroring the DB (one file per domain)
  environments/   # environment.ts, environment.development.ts (placeholders <<X_CORE_URL>> / <<X_CORE_ANON_KEY>>)
  styles.scss     # palette + fonts + global rules
  styles/         # partials (_auth-form.scss, _mixins.scss)
sql/              # dated migrations for schema mitaller
docs/             # 00-ARQUITECTURA.md, 01-MODELO-DE-DATOS.md
```

## Domain vocabulary
taller (tenant) · sucursal (branch) · miembro (user↔taller with rol) · cliente · vehículo · orden de trabajo (OT) · ítem (mano_obra | repuesto) · factura (NCF, ITBIS) · pago · artículo (inventory item) · plan / suscripción.

Order states: `recepcion → diagnostico → en_progreso → esperando_repuestos → listo → entregado`, plus `cancelado`.
Invoice states: `pendiente | pagada | vencida | anulada`.
Roles per taller: `propietario | administrador | recepcionista | mecanico`.
