import { Plan } from './plan.model';

export type Rol = 'propietario' | 'administrador' | 'recepcionista' | 'mecanico';

export interface TallerConfig {
  itbis: number;
  dias_vencimiento: number;
  moneda: string;
}

export interface Taller {
  id: string;
  nombre: string;
  rnc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  logo_url: string | null;
  contadores: { orden: number; factura: number };
  config: TallerConfig;
  creado_por: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Sucursal {
  id: string;
  taller_id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  es_principal: boolean;
  activa: boolean;
}

export interface Miembro {
  id: string;
  taller_id: string;
  user_id: string;
  rol: Rol;
  sucursal_id: string | null;
  activo: boolean;
}

/** Fila de la vista `miembros_detalle`. */
export interface MiembroDetalle extends Miembro {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
}

export interface Perfil {
  user_id: string;
  nombre: string | null;
  telefono: string | null;
  avatar_url: string | null;
  email: string | null;
}

export interface Suscripcion {
  id: string;
  taller_id: string;
  plan_id: string;
  estado: 'activa' | 'vencida' | 'cancelada';
  inicio: string;
  fin: string | null;
  plan?: Plan;
}
