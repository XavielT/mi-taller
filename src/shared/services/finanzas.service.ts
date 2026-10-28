import { Injectable, inject } from '@angular/core';
import { ResumenFinanzas } from '../models/factura.model';
import { TallerStore } from '../stores/taller.store';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class FinanzasService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  /** Cards of the finance page and the monthly revenue of the dashboard. Dates are optional (default: this month). */
  async resumen(desde?: string | null, hasta?: string | null): Promise<ResumenFinanzas> {
    const { data, error } = await this.client.rpc('resumen_finanzas', {
      p_taller: this.store.requerirTallerId(),
      p_desde: desde || null,
      p_hasta: hasta || null,
    });
    if (error) throw aError(error, 'No se pudo cargar el resumen financiero');
    return data as ResumenFinanzas;
  }
}
