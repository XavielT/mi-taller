import { Injectable, inject } from '@angular/core';
import { Sucursal } from '../models/taller.model';
import { TallerStore } from '../stores/taller.store';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

export interface SucursalInput {
  nombre: string;
  direccion: string;
  telefono: string;
}

@Injectable({ providedIn: 'root' })
export class SucursalesService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  /** Todas las sucursales del taller, activas e inactivas (la principal primero). */
  async listar(): Promise<Sucursal[]> {
    const { data, error } = await this.client
      .from('sucursales')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .order('es_principal', { ascending: false })
      .order('nombre');
    if (error) throw aError(error, 'No se pudieron cargar las sucursales');
    return (data ?? []) as Sucursal[];
  }

  async crear(d: SucursalInput): Promise<Sucursal> {
    const { data, error } = await this.client.rpc('crear_sucursal', {
      p_taller: this.store.requerirTallerId(),
      p_nombre: d.nombre,
      p_direccion: d.direccion || null,
      p_telefono: d.telefono || null,
    });
    if (error) throw aError(error, 'No se pudo crear la sucursal');
    return data as Sucursal;
  }

  async actualizar(id: string, d: SucursalInput): Promise<Sucursal> {
    const { data, error } = await this.client.rpc('actualizar_sucursal', {
      p_sucursal: id,
      p_nombre: d.nombre,
      p_direccion: d.direccion || null,
      p_telefono: d.telefono || null,
    });
    if (error) throw aError(error, 'No se pudo guardar la sucursal');
    return data as Sucursal;
  }

  async activar(id: string, activa: boolean): Promise<void> {
    const { error } = await this.client.rpc('activar_sucursal', { p_sucursal: id, p_activa: activa });
    if (error) throw aError(error, 'No se pudo actualizar la sucursal');
  }

  async definirPrincipal(id: string): Promise<void> {
    const { error } = await this.client.rpc('definir_sucursal_principal', { p_sucursal: id });
    if (error) throw aError(error, 'No se pudo cambiar la sucursal principal');
  }
}
