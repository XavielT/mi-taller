import { Injectable, inject } from '@angular/core';
import { NuevoPago, Pago } from '../models/factura.model';
import { TallerStore } from '../stores/taller.store';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  async porFactura(facturaId: string): Promise<Pago[]> {
    const { data, error } = await this.client
      .from('pagos')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('factura_id', facturaId)
      .order('fecha', { ascending: false });
    if (error) throw aError(error, 'No se pudieron cargar los pagos');
    return (data ?? []) as Pago[];
  }

  /** The RPC checks the amount against the balance and flips the invoice to pagada at zero. */
  async registrar(p: NuevoPago): Promise<Pago> {
    const { data, error } = await this.client.rpc('registrar_pago', {
      p_factura: p.facturaId,
      p_monto: p.monto,
      p_metodo: p.metodo,
      p_referencia: p.referencia?.trim() || null,
      p_notas: p.notas?.trim() || null,
    });
    if (error) throw aError(error, 'No se pudo registrar el pago');
    return data as Pago;
  }
}
