export interface Cliente {
  id: string;
  taller_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  documento: string | null;
  direccion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Editable fields of a cliente (the form payload). */
export type ClienteInput = Pick<Cliente, 'nombre' | 'telefono' | 'email' | 'documento' | 'direccion' | 'notas'>;
