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

/** Datos editables del taller en Configuración. */
export interface DatosTaller {
  nombre: string;
  rnc: string;
  telefono: string;
  email: string;
  direccion: string;
  itbis: number;
  dias_vencimiento: number;
}

export const BUCKET_LOGOS = 'mt-logos';
export const MAX_BYTES_LOGO = 1024 * 1024;
const EXTENSION_LOGO: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Spanish message when a file cannot be used as a logo, or null when it can. */
export function errorLogo(archivo: Pick<File, 'type' | 'size'>): string | null {
  if (!EXTENSION_LOGO[archivo.type]) return 'El logo debe ser una imagen PNG, JPG o WebP';
  if (archivo.size > MAX_BYTES_LOGO) return 'El logo no puede pesar más de 1 MB';
  return null;
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

  async actualizar(id: string, d: DatosTaller): Promise<Taller> {
    const { data, error } = await this.client.rpc('actualizar_taller', {
      p_taller: id,
      p_nombre: d.nombre,
      p_rnc: d.rnc || null,
      p_telefono: d.telefono || null,
      p_email: d.email || null,
      p_direccion: d.direccion || null,
      p_itbis: d.itbis,
      p_dias_vencimiento: d.dias_vencimiento,
    });
    if (error) throw aError(error, 'No se pudo guardar la configuración');
    return data as Taller;
  }

  /** Sube el logo al bucket público, lo asigna al taller y borra el anterior (si falla el borrado no pasa nada). */
  async subirLogo(tallerId: string, archivo: File, logoAnterior: string | null): Promise<Taller> {
    const problema = errorLogo(archivo);
    if (problema) throw new Error(problema);
    const ruta = `${tallerId}/logo-${Date.now()}.${EXTENSION_LOGO[archivo.type]}`;
    const subida = await this.client.storage.from(BUCKET_LOGOS).upload(ruta, archivo, { contentType: archivo.type });
    if (subida.error) throw new Error('No se pudo subir el logo. Intenta de nuevo.');
    const { data: publica } = this.client.storage.from(BUCKET_LOGOS).getPublicUrl(ruta);
    const taller = await this.definirLogo(tallerId, publica.publicUrl);
    await this.borrarArchivoLogo(logoAnterior);
    return taller;
  }

  async quitarLogo(tallerId: string, logoActual: string | null): Promise<Taller> {
    const taller = await this.definirLogo(tallerId, null);
    await this.borrarArchivoLogo(logoActual);
    return taller;
  }

  private async definirLogo(tallerId: string, url: string | null): Promise<Taller> {
    const { data, error } = await this.client.rpc('definir_logo', { p_taller: tallerId, p_url: url });
    if (error) throw aError(error, 'No se pudo guardar el logo');
    return data as Taller;
  }

  private async borrarArchivoLogo(url: string | null): Promise<void> {
    const marca = `/object/public/${BUCKET_LOGOS}/`;
    const i = url?.indexOf(marca) ?? -1;
    if (!url || i < 0) return;
    try {
      await this.client.storage.from(BUCKET_LOGOS).remove([decodeURIComponent(url.slice(i + marca.length))]);
    } catch {
      // an orphaned old logo is harmless
    }
  }
}
