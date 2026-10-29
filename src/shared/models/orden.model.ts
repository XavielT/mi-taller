export type EstadoOrden =
  | 'recepcion'
  | 'diagnostico'
  | 'en_progreso'
  | 'esperando_repuestos'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export type TipoItem = 'mano_obra' | 'repuesto';

/** Checklist of what the customer leaves in the car (booleans keyed by item). */
export type InventarioEntrada = Record<string, boolean>;

export const CHECKLIST_ENTRADA: { key: string; label: string }[] = [
  { key: 'gato', label: 'Gato' },
  { key: 'llave_ruedas', label: 'Llave de ruedas' },
  { key: 'llanta_repuesto', label: 'Llanta de repuesto' },
  { key: 'radio', label: 'Radio' },
  { key: 'alfombras', label: 'Alfombras' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'extintor', label: 'Extintor' },
];

export interface OrdenTrabajo {
  id: string;
  taller_id: string;
  sucursal_id: string | null;
  numero: string;
  cliente_id: string;
  vehiculo_id: string;
  estado: EstadoOrden;
  motivo: string | null;
  diagnostico: string | null;
  notas_internas: string | null;
  kilometraje_entrada: number | null;
  nivel_combustible: number | null;
  inventario_entrada: InventarioEntrada;
  fotos: string[];
  mecanico_id: string | null;
  progreso: number;
  recibido_por: string | null;
  fecha_entrada: string;
  fecha_promesa: string | null;
  fecha_entrega: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface OrdenItem {
  id: string;
  taller_id: string;
  orden_id: string;
  tipo: TipoItem;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  aplica_itbis: boolean;
  articulo_id: string | null;
  completado: boolean;
  orden: number;
}

export interface OrdenHistorial {
  id: string;
  taller_id: string;
  orden_id: string;
  de_estado: EstadoOrden | null;
  a_estado: EstadoOrden;
  user_id: string | null;
  comentario: string | null;
  created_at: string;
}

/** Row of the `ordenes_resumen` view: the order plus cliente, vehículo, mecánico and DB-computed totals. */
export interface OrdenResumen extends OrdenTrabajo {
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  vehiculo_placa: string | null;
  vehiculo_marca: string | null;
  vehiculo_modelo: string | null;
  vehiculo_anio: number | null;
  mecanico_nombre: string | null;
  subtotal: number;
  itbis: number;
  total: number;
  items_total: number;
  items_completados: number;
}

/** Arguments of the `crear_orden` RPC, in friendly form. */
export interface NuevaOrden {
  clienteId: string;
  vehiculoId: string;
  motivo: string;
  kilometraje?: number | null;
  combustible?: number | null;
  inventario?: InventarioEntrada;
  fechaPromesa?: string | null;
  mecanicoId?: string | null;
}

/** Allowed order state transitions (mirror of `mitaller.transicion_permitida` in the DB). */
export const TRANSICIONES: Record<EstadoOrden, EstadoOrden[]> = {
  recepcion: ['diagnostico', 'en_progreso', 'cancelado'],
  diagnostico: ['en_progreso', 'esperando_repuestos', 'cancelado'],
  en_progreso: ['esperando_repuestos', 'listo', 'cancelado'],
  esperando_repuestos: ['en_progreso', 'cancelado'],
  listo: ['entregado', 'en_progreso'],
  entregado: [],
  cancelado: [],
};

export const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  recepcion: 'Recepción',
  diagnostico: 'Diagnóstico',
  en_progreso: 'En progreso',
  esperando_repuestos: 'Esperando repuestos',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export function transicionPermitida(de: EstadoOrden, a: EstadoOrden): boolean {
  return TRANSICIONES[de].includes(a);
}

/** Spanish message for a refused transition. */
export function errorTransicion(de: EstadoOrden, a: EstadoOrden): string {
  return `No se puede pasar una orden de "${ETIQUETA_ESTADO[de]}" a "${ETIQUETA_ESTADO[a]}"`;
}

/** Editable fields of an order item (the add/edit payload). */
export interface ItemInput {
  tipo: TipoItem;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  aplica_itbis: boolean;
  /** Artículo del inventario: al guardarse, la base de datos descuenta la cantidad del stock. */
  articulo_id?: string | null;
}
