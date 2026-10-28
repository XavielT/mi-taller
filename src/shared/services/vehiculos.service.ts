import { Injectable, inject } from '@angular/core';
import { Vehiculo, VehiculoInput } from '../models/vehiculo.model';
import { TallerStore } from '../stores/taller.store';
import { limpiarBusqueda } from './clientes.service';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

export const ERROR_PLACA_DUPLICADA = 'Ya existe un vehículo con esa placa';

@Injectable({ providedIn: 'root' })
export class VehiculosService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  async porCliente(clienteId: string): Promise<Vehiculo[]> {
    const { data, error } = await this.client
      .from('vehiculos')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('cliente_id', clienteId)
      .order('placa');
    if (error) throw aError(error, 'No se pudieron cargar los vehículos');
    return (data ?? []) as Vehiculo[];
  }

  /** Exact lookup by plate (plates are unique per taller). */
  async buscarPorPlaca(placa: string): Promise<Vehiculo | null> {
    const { data, error } = await this.client
      .from('vehiculos')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('placa', placa.trim().toUpperCase())
      .maybeSingle();
    if (error) throw aError(error, 'No se pudo buscar el vehículo');
    return (data as Vehiculo | null) ?? null;
  }

  /** Partial match by plate, used by the reception wizard search. */
  async buscarParcial(texto: string, limite = 8): Promise<Vehiculo[]> {
    const t = limpiarBusqueda(texto);
    if (!t) return [];
    const { data, error } = await this.client
      .from('vehiculos')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .ilike('placa', `%${t}%`)
      .limit(limite);
    if (error) throw aError(error, 'No se pudo buscar el vehículo');
    return (data ?? []) as Vehiculo[];
  }

  async crear(clienteId: string, datos: VehiculoInput): Promise<Vehiculo> {
    const { data, error } = await this.client
      .from('vehiculos')
      .insert({ ...limpiarVehiculo(datos), cliente_id: clienteId, taller_id: this.store.requerirTallerId() })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') throw new Error(ERROR_PLACA_DUPLICADA);
      throw aError(error, 'No se pudo guardar el vehículo');
    }
    return data as Vehiculo;
  }

  async actualizar(id: string, datos: VehiculoInput): Promise<Vehiculo> {
    const { data, error } = await this.client
      .from('vehiculos')
      .update(limpiarVehiculo(datos))
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') throw new Error(ERROR_PLACA_DUPLICADA);
      throw aError(error, 'No se pudo guardar el vehículo');
    }
    return data as Vehiculo;
  }
}

function limpiarVehiculo(d: VehiculoInput): VehiculoInput {
  const t = (v: string | null) => (v?.trim() ? v.trim() : null);
  return {
    placa: d.placa.trim().toUpperCase(),
    marca: t(d.marca),
    modelo: t(d.modelo),
    anio: d.anio ?? null,
    color: t(d.color),
    vin: t(d.vin)?.toUpperCase() ?? null,
    kilometraje: d.kilometraje ?? null,
  };
}
