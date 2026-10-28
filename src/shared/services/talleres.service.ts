import { Injectable, inject } from '@angular/core';
import { Taller } from '../models/taller.model';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

export interface NuevoTaller {
  nombre: string;
  rnc?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  nombreUsuario?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TalleresService {
  private readonly client = inject(SupabaseService).client;

  async crearTaller(datos: NuevoTaller): Promise<Taller> {
    const { data, error } = await this.client.rpc('crear_taller', {
      p_nombre: datos.nombre,
      p_rnc: datos.rnc || null,
      p_telefono: datos.telefono || null,
      p_direccion: datos.direccion || null,
      p_nombre_usuario: datos.nombreUsuario || null,
    });
    if (error) throw aError(error, 'No se pudo crear el taller');
    return data as Taller;
  }
}
