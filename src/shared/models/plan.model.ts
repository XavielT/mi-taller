export interface LimitesPlan {
  sucursales: number;
  usuarios: number;
  ordenes_mes: number;
}

export interface Plan {
  id: string;
  nombre: string;
  precio_mensual: number;
  /** `null` = ilimitado */
  limites: LimitesPlan | null;
  activo: boolean;
}
