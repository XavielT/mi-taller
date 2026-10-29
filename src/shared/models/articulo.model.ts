export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste';

export interface Articulo {
  id: string;
  taller_id: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  costo: number;
  stock_minimo: number;
  activo: boolean;
}

/** Fila de la vista `articulos_stock`: el artículo más su stock calculado de los movimientos. */
export interface ArticuloStock extends Articulo {
  stock: number;
  bajo_minimo: boolean;
}

/** Datos del formulario de artículo. `stock_inicial` solo aplica al crear. */
export interface ArticuloInput {
  nombre: string;
  codigo: string;
  descripcion: string;
  precio_venta: number;
  costo: number;
  stock_minimo: number;
  stock_inicial: number;
}

export interface MovimientoInventario {
  id: string;
  articulo_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  nota: string | null;
  referencia_tipo: 'orden' | 'factura' | 'ajuste' | null;
  referencia_id: string | null;
  user_id: string | null;
  created_at: string;
}

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
};

/** Cantidad con signo tal como afecta al stock (las salidas restan). */
export function efectoEnStock(m: Pick<MovimientoInventario, 'tipo' | 'cantidad'>): number {
  return m.tipo === 'salida' ? -m.cantidad : m.cantidad;
}
