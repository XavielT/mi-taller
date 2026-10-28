import { Injectable, inject } from '@angular/core';
import { EstadoOrden, OrdenResumen } from '../models/orden.model';
import { TallerStore } from '../stores/taller.store';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

/** Result of the `resumen_dashboard` RPC. */
export interface ResumenDashboard {
  ordenes_por_estado: Partial<Record<EstadoOrden, number>>;
  abiertas: number;
  listas: number;
  carga_mecanicos: { mecanico_id: string; nombre: string; ordenes: number }[];
  facturas_vencidas: { cantidad: number; monto: number };
  ultimas_ordenes: OrdenResumen[];
}

/** Month-over-month change in percent; `null` when there is no previous month to compare with. */
export function variacionPct(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  async resumen(): Promise<ResumenDashboard> {
    const { data, error } = await this.client.rpc('resumen_dashboard', { p_taller: this.store.requerirTallerId() });
    if (error) throw aError(error, 'No se pudo cargar el tablero');
    return data as ResumenDashboard;
  }
}
