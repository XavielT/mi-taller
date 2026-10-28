import { Injectable, inject } from '@angular/core';
import { Cliente, ClienteInput } from '../models/cliente.model';
import { TallerStore } from '../stores/taller.store';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

export interface PaginaClientes {
  filas: Cliente[];
  total: number;
}

/** Removes characters that have meaning inside a PostgREST `or(...)` filter or an ILIKE pattern. */
export function limpiarBusqueda(texto: string): string {
  return texto.replace(/[%_*,()\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  async listar(busqueda = '', pagina = 1, tamano = 25): Promise<PaginaClientes> {
    const tallerId = this.store.requerirTallerId();
    const desde = (pagina - 1) * tamano;
    let q = this.client
      .from('clientes')
      .select('*', { count: 'exact' })
      .eq('taller_id', tallerId)
      .order('nombre')
      .range(desde, desde + tamano - 1);

    const t = limpiarBusqueda(busqueda);
    if (t) q = q.or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%,documento.ilike.%${t}%`);

    const { data, error, count } = await q;
    if (error) throw aError(error, 'No se pudieron cargar los clientes');
    return { filas: (data ?? []) as Cliente[], total: count ?? 0 };
  }

  /** Quick lookup for the reception wizard (first matches only). */
  async buscar(busqueda: string, limite = 8): Promise<Cliente[]> {
    const { filas } = await this.listar(busqueda, 1, limite);
    return filas;
  }

  async obtener(id: string): Promise<Cliente> {
    const { data, error } = await this.client
      .from('clientes')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id)
      .maybeSingle();
    if (error) throw aError(error, 'No se pudo cargar el cliente');
    if (!data) throw new Error('El cliente no existe');
    return data as Cliente;
  }

  async obtenerVarios(ids: string[]): Promise<Cliente[]> {
    if (!ids.length) return [];
    const { data, error } = await this.client
      .from('clientes')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .in('id', ids);
    if (error) throw aError(error, 'No se pudieron cargar los clientes');
    return (data ?? []) as Cliente[];
  }

  async crear(datos: ClienteInput): Promise<Cliente> {
    const { data, error } = await this.client
      .from('clientes')
      .insert({ ...limpiarCliente(datos), taller_id: this.store.requerirTallerId() })
      .select('*')
      .single();
    if (error) throw aError(error, 'No se pudo guardar el cliente');
    return data as Cliente;
  }

  async actualizar(id: string, datos: ClienteInput): Promise<Cliente> {
    const { data, error } = await this.client
      .from('clientes')
      .update(limpiarCliente(datos))
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw aError(error, 'No se pudo guardar el cliente');
    return data as Cliente;
  }
}

/** Empty strings become null so optional columns stay clean. */
function limpiarCliente(d: ClienteInput): ClienteInput {
  const n = (v: string | null) => (v?.trim() ? v.trim() : null);
  return {
    nombre: d.nombre.trim(),
    telefono: n(d.telefono),
    email: n(d.email),
    documento: n(d.documento),
    direccion: n(d.direccion),
    notas: n(d.notas),
  };
}
