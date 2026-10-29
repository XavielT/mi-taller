import { Rol } from './taller.model';

export interface Invitacion {
  id: string;
  taller_id: string;
  etiqueta: string | null;
  rol: Rol;
  sucursal_id: string | null;
  estado: 'pendiente' | 'aceptada' | 'cancelada';
  expira_en: string;
  created_at: string;
}

/** Respuesta de `invitar_miembro`: el token solo se ve una vez, hay que compartir el enlace en ese momento. */
export interface InvitacionCreada {
  id: string;
  token: string;
  expira_en: string;
}

/** Respuesta de `ver_invitacion` (funciona sin sesión). */
export interface VistaInvitacion {
  valida: boolean;
  motivo?: string;
  taller?: string;
  rol?: Rol;
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  propietario: 'Propietario',
  administrador: 'Administrador',
  recepcionista: 'Recepcionista',
  mecanico: 'Mecánico',
};
