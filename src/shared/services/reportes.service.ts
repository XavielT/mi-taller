import { Injectable, inject } from '@angular/core';
import { TallerStore } from '../stores/taller.store';
import { aCsv } from '../utils/csv';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

/** Fila de la RPC `reporte_607`. */
export interface Fila607 {
  numero: string;
  rnc_cedula: string | null;
  tipo_id: number | null;
  cliente: string | null;
  ncf: string | null;
  tipo_ingreso: string;
  fecha_comprobante: string;
  monto_facturado: number;
  itbis_facturado: number;
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  otro: number;
  credito: number;
}

export interface Exportacion {
  csv: string;
  /** Filas incluidas en el archivo. */
  incluidas: number;
  /** Facturas del período que no se incluyeron (607: las que no tienen NCF). */
  omitidas: number;
}

const ENCABEZADOS_607 = [
  'RNC/Cédula',
  'Tipo de identificación',
  'NCF',
  'Tipo de ingreso',
  'Fecha del comprobante',
  'Monto facturado',
  'ITBIS facturado',
  'Efectivo',
  'Cheque/Transferencia/Depósito',
  'Tarjeta',
  'Otras formas de venta',
  'Venta a crédito',
  'Factura interna',
  'Cliente',
];

/** yyyy-mm-dd → yyyymmdd, the date shape of the DGII 607. */
export function fechaDgii(iso: string): string {
  return iso.replaceAll('-', '').slice(0, 8);
}

/** Builds the 607 CSV. Rows without NCF are left out because the DGII only takes fiscal receipts. */
export function csv607(filas: Fila607[]): Exportacion {
  const fiscales = filas.filter((f) => !!f.ncf);
  const csv = aCsv(
    ENCABEZADOS_607,
    fiscales.map((f) => [
      f.rnc_cedula,
      f.tipo_id,
      f.ncf,
      f.tipo_ingreso,
      fechaDgii(f.fecha_comprobante),
      f.monto_facturado,
      f.itbis_facturado,
      f.efectivo,
      f.transferencia,
      f.tarjeta,
      f.otro,
      f.credito,
      f.numero,
      f.cliente,
    ]),
  );
  return { csv, incluidas: fiscales.length, omitidas: filas.length - fiscales.length };
}

/** Last day of the month of `yyyy-mm` as yyyy-mm-dd. */
export function rangoDelMes(mes: string): { desde: string; hasta: string } {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { desde: `${a}-${pad(m)}-01`, hasta: `${a}-${pad(m)}-${pad(ultimo)}` };
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  async exportar607(mes: string): Promise<Exportacion> {
    const { desde, hasta } = rangoDelMes(mes);
    const { data, error } = await this.client.rpc('reporte_607', {
      p_taller: this.store.requerirTallerId(),
      p_desde: desde,
      p_hasta: hasta,
    });
    if (error) throw aError(error, 'No se pudo generar el reporte 607');
    return csv607((data ?? []) as Fila607[]);
  }

  async exportarFacturas(mes: string): Promise<Exportacion> {
    const { desde, hasta } = rangoDelMes(mes);
    const { data, error } = await this.client
      .from('facturas_resumen')
      .select('numero, fecha_emision, cliente_nombre, ncf, subtotal, itbis, total, pagado, balance, estado_efectivo')
      .eq('taller_id', this.store.requerirTallerId())
      .gte('fecha_emision', desde)
      .lte('fecha_emision', hasta)
      .order('fecha_emision')
      .limit(5000);
    if (error) throw aError(error, 'No se pudieron exportar las facturas');
    const filas = (data ?? []) as Record<string, string | number | null>[];
    const csv = aCsv(
      ['Factura', 'Fecha', 'Cliente', 'NCF', 'Subtotal', 'ITBIS', 'Total', 'Pagado', 'Balance', 'Estado'],
      filas.map((f) => [f['numero'], f['fecha_emision'], f['cliente_nombre'], f['ncf'], f['subtotal'], f['itbis'], f['total'], f['pagado'], f['balance'], f['estado_efectivo']]),
    );
    return { csv, incluidas: filas.length, omitidas: 0 };
  }

  async exportarClientes(): Promise<Exportacion> {
    const tallerId = this.store.requerirTallerId();
    const filas: Record<string, string | null>[] = [];
    const bloque = 1000;
    for (let desde = 0; ; desde += bloque) {
      const { data, error } = await this.client
        .from('clientes')
        .select('nombre, telefono, email, documento, direccion, notas')
        .eq('taller_id', tallerId)
        .order('nombre')
        .range(desde, desde + bloque - 1);
      if (error) throw aError(error, 'No se pudieron exportar los clientes');
      const parte = (data ?? []) as Record<string, string | null>[];
      filas.push(...parte);
      if (parte.length < bloque) break;
    }
    const csv = aCsv(
      ['Nombre', 'Teléfono', 'Correo', 'Documento', 'Dirección', 'Notas'],
      filas.map((c) => [c['nombre'], c['telefono'], c['email'], c['documento'], c['direccion'], c['notas']]),
    );
    return { csv, incluidas: filas.length, omitidas: 0 };
  }
}
