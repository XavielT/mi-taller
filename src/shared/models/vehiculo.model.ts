export interface Vehiculo {
  id: string;
  taller_id: string;
  cliente_id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  color: string | null;
  vin: string | null;
  kilometraje: number | null;
  created_at: string;
  updated_at: string | null;
}

/** Editable fields of a vehículo (the form payload). */
export type VehiculoInput = Pick<Vehiculo, 'placa' | 'marca' | 'modelo' | 'anio' | 'color' | 'vin' | 'kilometraje'>;
