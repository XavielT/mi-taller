import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ETIQUETA_ESTADO, EstadoOrden } from '../../../shared/models/orden.model';
import { ResumenFinanzas } from '../../../shared/models/factura.model';
import { DashboardService, ResumenDashboard, variacionPct } from '../../../shared/services/dashboard.service';
import { FinanzasService } from '../../../shared/services/finanzas.service';
import { MtBadgeEstado, MtEmptyState, MtPageHeader } from '../../../shared/ui';

const ORDEN_ESTADOS: EstadoOrden[] = ['recepcion', 'diagnostico', 'en_progreso', 'esperando_repuestos', 'listo', 'entregado', 'cancelado'];

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, MtBadgeEstado, MtEmptyState, MtPageHeader],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class Dashboard implements OnInit {
  private dashboardSvc = inject(DashboardService);
  private finanzasSvc = inject(FinanzasService);

  readonly etiqueta = ETIQUETA_ESTADO;

  resumen = signal<ResumenDashboard | null>(null);
  finanzas = signal<ResumenFinanzas | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  /** Brand-new taller: nothing received yet. */
  readonly vacio = computed(() => {
    const r = this.resumen();
    if (!r) return false;
    return Object.values(r.ordenes_por_estado).every((n) => !n) && r.ultimas_ordenes.length === 0;
  });

  readonly estados = computed(() => {
    const por = this.resumen()?.ordenes_por_estado ?? {};
    const filas = ORDEN_ESTADOS.map((estado) => ({ estado, n: por[estado] ?? 0 }));
    const max = Math.max(1, ...filas.map((f) => f.n));
    return filas.map((f) => ({ ...f, pct: (f.n / max) * 100 }));
  });

  readonly maxCarga = computed(() => Math.max(1, ...(this.resumen()?.carga_mecanicos ?? []).map((m) => m.ordenes)));

  readonly variacion = computed(() => {
    const f = this.finanzas();
    return f ? variacionPct(f.ingresos_mes, f.ingresos_mes_anterior) : null;
  });

  async ngOnInit(): Promise<void> {
    try {
      const [resumen, finanzas] = await Promise.all([this.dashboardSvc.resumen(), this.finanzasSvc.resumen()]);
      this.resumen.set(resumen);
      this.finanzas.set(finanzas);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar el tablero');
    } finally {
      this.cargando.set(false);
    }
  }
}
