import { Injectable, inject } from '@angular/core';
import { Factura, FacturaItem, FacturaResumen, NuevaFactura } from '../models/factura.model';
import { TallerStore } from '../stores/taller.store';
import { limpiarBusqueda } from './clientes.service';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

export type FiltroEstado = 'todas' | 'pendiente' | 'pagada' | 'vencida' | 'anulada';

export interface FiltrosFacturas {
  estado: FiltroEstado;
  /** yyyy-MM-dd, inclusive */
  desde?: string | null;
  hasta?: string | null;
  busqueda?: string;
}

const LIMITE_LISTA = 200;

@Injectable({ providedIn: 'root' })
export class FacturasService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  /** Invoices from `facturas_resumen`; the state filter uses `estado_efectivo` so overdue ones show up as vencidas. */
  async listar(f: FiltrosFacturas): Promise<FacturaResumen[]> {
    let q = this.client
      .from('facturas_resumen')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .order('fecha_emision', { ascending: false })
      .order('numero', { ascending: false })
      .limit(LIMITE_LISTA);

    if (f.estado !== 'todas') q = q.eq('estado_efectivo', f.estado);
    if (f.desde) q = q.gte('fecha_emision', f.desde);
    if (f.hasta) q = q.lte('fecha_emision', f.hasta);
    const t = limpiarBusqueda(f.busqueda ?? '');
    if (t) q = q.or(`numero.ilike.%${t}%,cliente_nombre.ilike.%${t}%,vehiculo_placa.ilike.%${t}%`);

    const { data, error } = await q;
    if (error) throw aError(error, 'No se pudieron cargar las facturas');
    return (data ?? []) as FacturaResumen[];
  }

  async obtener(id: string): Promise<FacturaResumen> {
    const { data, error } = await this.client
      .from('facturas_resumen')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id)
      .maybeSingle();
    if (error) throw aError(error, 'No se pudo cargar la factura');
    if (!data) throw new Error('La factura no existe');
    return data as FacturaResumen;
  }

  async items(facturaId: string): Promise<FacturaItem[]> {
    const { data, error } = await this.client
      .from('factura_items')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('factura_id', facturaId)
      .order('created_at');
    if (error) throw aError(error, 'No se pudieron cargar los ítems');
    return (data ?? []) as FacturaItem[];
  }

  /** Emits the invoice through the RPC: totals are frozen from the order items in the database. */
  async emitir(n: NuevaFactura): Promise<Factura> {
    const { data, error } = await this.client.rpc('emitir_factura', {
      p_orden: n.ordenId,
      p_tipo_ncf: n.tipoNcf || null,
      p_ncf: n.ncf?.trim() || null,
      p_fecha_vencimiento: n.fechaVencimiento || null,
      p_notas: n.notas?.trim() || null,
    });
    if (error) throw aError(error, 'No se pudo emitir la factura');
    return data as Factura;
  }

  async anular(facturaId: string, motivo: string): Promise<Factura> {
    const { data, error } = await this.client.rpc('anular_factura', { p_factura: facturaId, p_motivo: motivo });
    if (error) throw aError(error, 'No se pudo anular la factura');
    return data as Factura;
  }
}
