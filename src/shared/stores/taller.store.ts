import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Plan } from '../models/plan.model';
import { Rol, Sucursal, Taller } from '../models/taller.model';
import { AuthService } from '../services/auth.service';
import { aError } from '../services/supabase-error';
import { SupabaseService } from '../services/supabase.service';
import { CLAVE_INVITACION_PENDIENTE } from '../storage-keys';

export const CLAVE_TALLER_ACTIVO = 'mt.tallerActivo';

function leerGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_TALLER_ACTIVO);
  } catch {
    return null;
  }
}

function guardar(id: string | null): void {
  try {
    if (id) localStorage.setItem(CLAVE_TALLER_ACTIVO, id);
    else localStorage.removeItem(CLAVE_TALLER_ACTIVO);
  } catch {
    // storage unavailable (private mode): the selection just will not persist
  }
}

@Injectable({ providedIn: 'root' })
export class TallerStore {
  private readonly client = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  readonly talleres = signal<Taller[]>([]);
  readonly tallerActivo = signal<Taller | null>(null);
  readonly sucursales = signal<Sucursal[]>([]);
  readonly sucursalActiva = signal<Sucursal | null>(null);
  readonly rol = signal<Rol | null>(null);
  readonly plan = signal<Plan | null>(null);
  readonly limites = computed(() => this.plan()?.limites ?? null);
  readonly cargando = signal(false);
  /** true after the first `cargar()` finished (successfully or not), so guards do not reload on every navigation. */
  readonly cargado = signal(false);
  /** true si el usuario figura en `admins_plataforma` (dueño del SaaS); habilita la ruta /admin. */
  readonly esAdminPlataforma = signal(false);

  /** Active taller id; every domain service scopes its queries with it. */
  readonly tallerId = computed(() => this.tallerActivo()?.id ?? null);

  constructor() {
    effect(() => {
      if (this.auth.ready() && !this.auth.isAuthenticated()) this.limpiar();
    });
  }

  /** The active taller id or an Error: domain services call this before querying. */
  requerirTallerId(): string {
    const id = this.tallerId();
    if (!id) throw new Error('No hay un taller activo');
    return id;
  }

  /** Accepts the invitation saved by /unirse/:token (the user had no session then). A bad or expired token is just dropped. */
  private async aceptarInvitacionPendiente(): Promise<void> {
    let token: string | null = null;
    try {
      token = localStorage.getItem(CLAVE_INVITACION_PENDIENTE);
    } catch {
      return;
    }
    if (!token) return;
    try {
      await this.client.rpc('aceptar_invitacion', { p_token: token });
    } finally {
      try {
        localStorage.removeItem(CLAVE_INVITACION_PENDIENTE);
      } catch {
        // nothing to clean
      }
    }
  }

  /** Reloads sucursales, rol and plan of the active taller after an admin screen changed them. */
  async refrescar(): Promise<void> {
    const id = this.tallerId();
    if (id) await this.cargarDetalle(id);
  }

  async cargar(preferirId?: string): Promise<void> {
    this.cargando.set(true);
    try {
      await this.aceptarInvitacionPendiente();
      const [talleres, admin] = await Promise.all([this.client.rpc('mis_talleres'), this.client.rpc('es_admin_plataforma')]);
      this.esAdminPlataforma.set(admin.data === true);
      const { data, error } = talleres;
      if (error) throw aError(error, 'No se pudieron cargar tus talleres');
      const lista = (data ?? []) as Taller[];
      this.talleres.set(lista);
      const guardado = leerGuardado();
      const elegido =
        lista.find((t) => t.id === preferirId) ?? lista.find((t) => t.id === guardado) ?? lista[0] ?? null;
      await this.activar(elegido);
    } finally {
      this.cargando.set(false);
      this.cargado.set(true);
    }
  }

  async seleccionar(tallerId: string): Promise<void> {
    const taller = this.talleres().find((t) => t.id === tallerId);
    if (!taller) return;
    await this.activar(taller);
  }

  limpiar(): void {
    this.talleres.set([]);
    this.tallerActivo.set(null);
    this.sucursales.set([]);
    this.sucursalActiva.set(null);
    this.rol.set(null);
    this.plan.set(null);
    this.esAdminPlataforma.set(false);
    this.cargado.set(false);
    guardar(null);
  }

  private async activar(taller: Taller | null): Promise<void> {
    this.tallerActivo.set(taller);
    guardar(taller?.id ?? null);
    if (!taller) {
      this.sucursales.set([]);
      this.sucursalActiva.set(null);
      this.rol.set(null);
      this.plan.set(null);
      return;
    }
    await this.cargarDetalle(taller.id);
  }

  /** Membership (rol), sucursales and active plan of one taller. A failure here must not break navigation. */
  private async cargarDetalle(tallerId: string): Promise<void> {
    const uid = this.auth.user()?.id;
    try {
      const [miembro, sucursales, suscripcion] = await Promise.all([
        this.client.from('miembros').select('rol, sucursal_id').eq('taller_id', tallerId).eq('user_id', uid ?? '').maybeSingle(),
        this.client.from('sucursales').select('*').eq('taller_id', tallerId).eq('activa', true).order('es_principal', { ascending: false }),
        this.client.from('suscripciones').select('plan:planes(*)').eq('taller_id', tallerId).eq('estado', 'activa').maybeSingle(),
      ]);
      if (this.tallerId() !== tallerId) return; // the user switched taller while loading

      const lista = (sucursales.data ?? []) as Sucursal[];
      const fila = miembro.data as { rol: Rol; sucursal_id: string | null } | null;
      this.rol.set(fila?.rol ?? null);
      this.sucursales.set(lista);
      this.sucursalActiva.set(lista.find((s) => s.id === fila?.sucursal_id) ?? lista[0] ?? null);
      this.plan.set((suscripcion.data as unknown as { plan: Plan | null } | null)?.plan ?? null);
    } catch (e) {
      console.error('No se pudo cargar el detalle del taller', e);
    }
  }
}
