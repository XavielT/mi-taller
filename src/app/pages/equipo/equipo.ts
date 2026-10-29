import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Invitacion, InvitacionCreada, ETIQUETA_ROL } from '../../../shared/models/invitacion.model';
import { MiembroDetalle, Rol, Sucursal } from '../../../shared/models/taller.model';
import { AuthService } from '../../../shared/services/auth.service';
import { EquipoService } from '../../../shared/services/equipo.service';
import { SucursalesService } from '../../../shared/services/sucursales.service';
import { TallerStore } from '../../../shared/stores/taller.store';
import { compartirWhatsApp } from '../../../shared/utils/whatsapp';
import { environment } from '../../../environments/environment';
import { MtButton, MtCell, MtEmptyState, MtModal, MtPageHeader, MtTable, ToastService } from '../../../shared/ui';
import type { MtColumn } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-equipo',
  imports: [DatePipe, FormsModule, MtButton, MtCell, MtEmptyState, MtModal, MtPageHeader, MtTable],
  templateUrl: './equipo.html',
  styleUrls: ['./equipo.scss'],
})
export class Equipo {
  private svc = inject(EquipoService);
  private sucursalesSvc = inject(SucursalesService);
  private store = inject(TallerStore);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  readonly etiqueta = ETIQUETA_ROL;
  readonly columnas: MtColumn[] = [
    { key: 'miembro', label: 'Miembro' },
    { key: 'rol', label: 'Rol' },
    { key: 'sucursal', label: 'Sucursal' },
    { key: 'acciones', label: '', align: 'right' },
  ];
  readonly columnasInv: MtColumn[] = [
    { key: 'para', label: 'Invitación para' },
    { key: 'rol', label: 'Rol' },
    { key: 'vence', label: 'Vence' },
    { key: 'acciones', label: '', align: 'right' },
  ];

  miembros = signal<MiembroDetalle[]>([]);
  invitaciones = signal<Invitacion[]>([]);
  sucursales = signal<Sucursal[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  // invitar
  invitando = signal(false);
  nuevoRol = signal<Rol>('recepcionista');
  nuevaEtiqueta = signal('');
  nuevaSucursal = signal('');
  creando = signal(false);
  errorInvitar = signal<string | null>(null);
  enlace = signal<{ url: string; vence: string } | null>(null);

  quitando = signal<MiembroDetalle | null>(null);
  confirmandoQuitar = signal(false);

  readonly miRol = this.store.rol;
  readonly esAdmin = computed(() => ['propietario', 'administrador'].includes(this.miRol() ?? ''));
  readonly esPropietario = computed(() => this.miRol() === 'propietario');
  readonly miId = computed(() => this.auth.user()?.id ?? null);
  readonly limite = computed(() => this.store.limites()?.usuarios ?? null);
  readonly ocupados = computed(() => this.miembros().length + this.invitaciones().length);
  readonly llegoAlLimite = computed(() => this.limite() !== null && this.ocupados() >= (this.limite() as number));
  /** Roles que quien mira puede asignar: solo el propietario hace administradores. */
  readonly rolesAsignables = computed<Rol[]>(() => (this.esPropietario() ? ['administrador', 'recepcionista', 'mecanico'] : ['recepcionista', 'mecanico']));
  readonly sucursalesActivas = computed(() => this.sucursales().filter((s) => s.activa));

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    try {
      const [miembros, invitaciones, sucursales] = await Promise.all([
        this.svc.miembros(),
        this.esAdmin() ? this.svc.invitaciones() : Promise.resolve([] as Invitacion[]),
        this.sucursalesSvc.listar(),
      ]);
      this.miembros.set(miembros);
      this.invitaciones.set(invitaciones);
      this.sucursales.set(sucursales);
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar el equipo');
    } finally {
      this.cargando.set(false);
    }
  }

  nombreRol(rol: Rol): string {
    return ETIQUETA_ROL[rol] ?? rol;
  }

  nombreSucursal(id: string | null): string {
    return this.sucursales().find((s) => s.id === id)?.nombre ?? '—';
  }

  /** El propietario no se edita; un administrador solo lo toca el propietario; nadie se edita a sí mismo. */
  puedeEditar(m: MiembroDetalle): boolean {
    if (!this.esAdmin() || m.rol === 'propietario' || m.user_id === this.miId()) return false;
    return m.rol !== 'administrador' || this.esPropietario();
  }

  async cambiarRol(m: MiembroDetalle, rol: Rol): Promise<void> {
    if (rol === m.rol) return;
    await this.guardarMiembro(m, rol, m.sucursal_id);
  }

  async cambiarSucursal(m: MiembroDetalle, sucursalId: string): Promise<void> {
    if (!sucursalId || sucursalId === m.sucursal_id) return;
    await this.guardarMiembro(m, m.rol, sucursalId);
  }

  private async guardarMiembro(m: MiembroDetalle, rol: Rol, sucursalId: string | null): Promise<void> {
    try {
      await this.svc.cambiarMiembro(m.id, rol, sucursalId);
      this.toast.success('Miembro actualizado');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo actualizar al miembro');
    }
    await this.cargar(); // also snaps the selects back when the change was refused
  }

  pedirQuitar(m: MiembroDetalle): void {
    this.quitando.set(m);
  }

  async confirmarQuitar(): Promise<void> {
    const m = this.quitando();
    if (!m) return;
    this.confirmandoQuitar.set(true);
    try {
      await this.svc.quitarMiembro(m.id);
      this.toast.success(`${m.nombre || m.email || 'El miembro'} ya no tiene acceso`);
      this.quitando.set(null);
      await this.cargar();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo quitar al miembro');
    } finally {
      this.confirmandoQuitar.set(false);
    }
  }

  // ---- invitar ----

  abrirInvitar(): void {
    this.nuevoRol.set('recepcionista');
    this.nuevaEtiqueta.set('');
    this.nuevaSucursal.set('');
    this.errorInvitar.set(null);
    this.enlace.set(null);
    this.invitando.set(true);
  }

  async crearInvitacion(): Promise<void> {
    this.creando.set(true);
    this.errorInvitar.set(null);
    try {
      const inv: InvitacionCreada = await this.svc.invitar(this.nuevoRol(), this.nuevaEtiqueta().trim(), this.nuevaSucursal() || null);
      this.enlace.set({ url: `${environment.appUrl}/unirse/${inv.token}`, vence: inv.expira_en });
      await this.cargar();
    } catch (e) {
      this.errorInvitar.set(e instanceof Error ? e.message : 'No se pudo crear la invitación');
    } finally {
      this.creando.set(false);
    }
  }

  async copiar(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Enlace copiado');
    } catch {
      this.toast.error('No se pudo copiar. Selecciona el enlace y cópialo manualmente.');
    }
  }

  whatsapp(url: string): string {
    const taller = this.store.tallerActivo()?.nombre ?? 'mi taller';
    return compartirWhatsApp(`Te invito a unirte a ${taller} en Mi Taller. Abre este enlace para entrar: ${url}`);
  }

  async cancelar(i: Invitacion): Promise<void> {
    try {
      await this.svc.cancelarInvitacion(i.id);
      this.toast.success('Invitación cancelada');
      await this.cargar();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo cancelar la invitación');
    }
  }
}
