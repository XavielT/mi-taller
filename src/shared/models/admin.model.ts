/** Respuesta de la RPC `admin_resumen`. */
export interface AdminResumen {
  talleres: number;
  talleres_activos: number;
  usuarios: number;
  ordenes_mes: number;
  facturado_mes: number;
  /** Suscripciones activas por plan, p. ej. `{ gratis: 3, pro: 1 }`. */
  por_plan: Record<string, number>;
}

/** Fila de `admin_listar_talleres`. */
export interface AdminTaller {
  id: string;
  nombre: string;
  rnc: string | null;
  activo: boolean;
  plan_id: string | null;
  plan_nombre: string | null;
  miembros: number;
  ordenes: number;
  ordenes_mes: number;
  facturas: number;
  propietario: string | null;
  created_at: string;
}

/** Fila de `admin_listar_usuarios` (solo usuarios que pertenecen a Mi Taller). */
export interface AdminUsuario {
  user_id: string;
  email: string | null;
  nombre: string | null;
  creado: string;
  ultimo_acceso: string | null;
  talleres: number;
  roles: string | null;
}
