import { TipoItem } from './orden.model';

export type EstadoFactura = 'pendiente' | 'pagada' | 'vencida' | 'anulada';
export type TipoNcf = 'B01' | 'B02' | 'B14' | 'B15';
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';

export const ETIQUETA_NCF: Record<TipoNcf, string> = {
  B01: 'B01 · Crédito fiscal',
  B02: 'B02 · Consumo',
  B14: 'B14 · Regímenes especiales',
  B15: 'B15 · Gubernamental',
};

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

export interface Factura {
  id: string;
  taller_id: string;
  sucursal_id: string | null;
  numero: string;
  orden_id: string | null;
  cliente_id: string;
  tipo_ncf: TipoNcf | null;
  ncf: string | null;
  subtotal: number;
  itbis: number;
  total: number;
  estado: EstadoFactura;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  notas: string | null;
  anulada_motivo: string | null;
  created_at: string;
}

export interface FacturaItem {
  id: string;
  factura_id: string;
  descripcion: string;
  tipo: TipoItem;
  cantidad: number;
  precio_unitario: number;
  aplica_itbis: boolean;
  importe: number;
}

export interface Pago {
  id: string;
  taller_id: string;
  factura_id: string;
  monto: number;
  metodo: MetodoPago;
  referencia: string | null;
  fecha: string;
  registrado_por: string | null;
  notas: string | null;
}

/** Row of the `facturas_resumen` view. `estado_efectivo` already accounts for overdue invoices. */
export interface FacturaResumen extends Factura {
  cliente_nombre: string | null;
  orden_numero: string | null;
  vehiculo_placa: string | null;
  vehiculo_marca: string | null;
  vehiculo_modelo: string | null;
  pagado: number;
  balance: number;
  estado_efectivo: EstadoFactura;
}

/** Result of the `resumen_finanzas` RPC. */
export interface ResumenFinanzas {
  ingresos_hoy: number;
  pendiente_cobro: number;
  vencido: number;
  facturas_vencidas: number;
  ticket_promedio: number;
  ingresos_mes: number;
  ingresos_mes_anterior: number;
}

export interface NuevaFactura {
  ordenId: string;
  tipoNcf?: TipoNcf | null;
  ncf?: string | null;
  fechaVencimiento?: string | null;
  notas?: string | null;
}

export interface NuevoPago {
  facturaId: string;
  monto: number;
  metodo: MetodoPago;
  referencia?: string | null;
  notas?: string | null;
}
