import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminResumen, AdminTaller, AdminUsuario } from '../../../shared/models/admin.model';
import { Plan } from '../../../shared/models/plan.model';
import { AdminService } from '../../../shared/services/admin.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TallerStore } from '../../../shared/stores/taller.store';
import { MtButton, MtCell, MtEmptyState, MtModal, MtPageHeader, MtTable, ToastService } from '../../../shared/ui';
import type { MtColumn } from '../../../shared/ui';

/** Panel del dueño de la plataforma: métricas agregadas, planes y suspensión de talleres. Sin acceso a los datos de cada taller. */
@Component({
  standalone: true,
  selector: 'app-admin',
  imports: [CurrencyPipe, DatePipe, RouterLink, MtButton, MtCell, MtEmptyState, MtModal, MtPageHeader, MtTable],
  templateUrl: './admin.html',
  styleUrls: ['./admin.scss'],
})
export class Admin {
  private svc = inject(AdminService);
  private toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly store = inject(TallerStore);

  readonly columnasTalleres: MtColumn[] = [
    { key: 'nombre', label: 'Taller' },
    { key: 'propietario', label: 'Propietario' },
    { key: 'plan', label: 'Plan' },
    { key: 'uso', label: 'Uso', align: 'right' },
    { key: 'estado', label: 'Estado' },
    { key: 'acciones', label: '', align: 'right' },
  ];
  readonly columnasUsuarios: MtColumn[] = [
    { key: 'nombre', label: 'Usuario' },
    { key: 'roles', label: 'Roles' },
    { key: 'talleres', label: 'Talleres', align: 'right' },
    { key: 'ultimo_acceso', label: 'Último acceso' },
  ];

  resumen = signal<AdminResumen | null>(null);
  talleres = signal<AdminTaller[]>([]);
  usuarios = signal<AdminUsuario[]>([]);
  planes = signal<Plan[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);
  /** Taller en espera de confirmar su suspensión o reactivación. */
  confirmando = signal<AdminTaller | null>(null);
  guardando = signal(false);

  readonly porPlan = computed(() => Object.entries(this.resumen()?.por_plan ?? {}));

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [resumen, talleres, usuarios, planes] = await Promise.all([
        this.svc.resumen(),
        this.svc.talleres(),
        this.svc.usuarios(),
        this.svc.planes(),
      ]);
      this.resumen.set(resumen);
      this.talleres.set(talleres);
      this.usuarios.set(usuarios);
      this.planes.set(planes);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar el panel');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarPlan(t: AdminTaller, planId: string): Promise<void> {
    if (planId === t.plan_id) return;
    try {
      await this.svc.cambiarPlan(t.id, planId);
      this.toast.success(`Plan de "${t.nombre}" actualizado`);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el plan');
    }
    await this.cargar();
  }

  pedirConfirmacion(t: AdminTaller): void {
    this.confirmando.set(t);
  }

  async confirmar(): Promise<void> {
    const t = this.confirmando();
    if (!t) return;
    this.guardando.set(true);
    try {
      await this.svc.activarTaller(t.id, !t.activo);
      this.toast.success(t.activo ? `"${t.nombre}" fue suspendido` : `"${t.nombre}" fue reactivado`);
      this.confirmando.set(null);
      await this.cargar();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el taller');
    } finally {
      this.guardando.set(false);
    }
  }
}
