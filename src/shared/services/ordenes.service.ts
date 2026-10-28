import { Injectable, inject } from '@angular/core';
import { MiembroDetalle } from '../models/taller.model';
import {
  EstadoOrden,
  ItemInput,
  NuevaOrden,
  OrdenHistorial,
  OrdenItem,
  OrdenResumen,
  OrdenTrabajo,
} from '../models/orden.model';
import { TallerStore } from '../stores/taller.store';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

export const MAX_FOTOS = 6;
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const EXTENSIONES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Spanish validation message for a photo, or null when it can be uploaded. */
export function errorFoto(f: Pick<File, 'type' | 'size' | 'name'>): string | null {
  if (!EXTENSIONES[f.type]) return `"${f.name}": solo se permiten imágenes JPG, PNG o WebP`;
  if (f.size > MAX_FOTO_BYTES) return `"${f.name}" supera los 5 MB`;
  return null;
}

@Injectable({ providedIn: 'root' })
export class OrdenesService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  /** Creates the order through the RPC (numbering, plan limit and first history row happen in the DB). */
  async crear(n: NuevaOrden): Promise<OrdenTrabajo> {
    const { data, error } = await this.client.rpc('crear_orden', {
      p_taller: this.store.requerirTallerId(),
      p_cliente: n.clienteId,
      p_vehiculo: n.vehiculoId,
      p_motivo: n.motivo,
      p_kilometraje: n.kilometraje ?? null,
      p_combustible: n.combustible ?? null,
      p_inventario: n.inventario ?? {},
      p_fecha_promesa: n.fechaPromesa || null,
      p_mecanico: n.mecanicoId || null,
      p_sucursal: this.store.sucursalActiva()?.id ?? null,
    });
    if (error) throw aError(error, 'No se pudo crear la orden');
    return data as OrdenTrabajo;
  }

  /** Last orders of a cliente, newest first. */
  async ultimasDeCliente(clienteId: string, limite = 10): Promise<OrdenResumen[]> {
    const { data, error } = await this.client
      .from('ordenes_resumen')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('cliente_id', clienteId)
      .order('fecha_entrada', { ascending: false })
      .limit(limite);
    if (error) throw aError(error, 'No se pudieron cargar las órdenes');
    return (data ?? []) as OrdenResumen[];
  }

  /** Active mecánicos of the taller, for the assignment select. */
  async mecanicos(): Promise<MiembroDetalle[]> {
    const { data, error } = await this.client
      .from('miembros_detalle')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('rol', 'mecanico')
      .eq('activo', true)
      .order('nombre');
    if (error) throw aError(error, 'No se pudieron cargar los mecánicos');
    return (data ?? []) as MiembroDetalle[];
  }

  /**
   * Uploads photos to `mt-ordenes/<taller_id>/<orden_id>/<uuid>.<ext>` and appends their paths to the order.
   * Returns the paths that were stored.
   */
  async subirFotos(ordenId: string, archivos: File[], existentes: string[] = []): Promise<string[]> {
    const tallerId = this.store.requerirTallerId();
    const subidas: string[] = [];
    for (const f of archivos) {
      const problema = errorFoto(f);
      if (problema) throw new Error(problema);
      const path = `${tallerId}/${ordenId}/${crypto.randomUUID()}.${EXTENSIONES[f.type]}`;
      const { error } = await this.client.storage.from('mt-ordenes').upload(path, f, { upsert: true, contentType: f.type });
      if (error) throw new Error('No se pudo subir una de las fotos');
      subidas.push(path);
    }
    if (subidas.length) {
      const { error } = await this.client
        .from('ordenes_trabajo')
        .update({ fotos: [...existentes, ...subidas] })
        .eq('taller_id', tallerId)
        .eq('id', ordenId);
      if (error) throw aError(error, 'No se pudieron guardar las fotos en la orden');
    }
    return subidas;
  }

  // ---- detalle de la orden ----

  async obtener(id: string): Promise<OrdenResumen> {
    const { data, error } = await this.client
      .from('ordenes_resumen')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id)
      .maybeSingle();
    if (error) throw aError(error, 'No se pudo cargar la orden');
    if (!data) throw new Error('La orden no existe');
    return data as OrdenResumen;
  }

  async items(ordenId: string): Promise<OrdenItem[]> {
    const { data, error } = await this.client
      .from('orden_items')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('orden_id', ordenId)
      .order('orden')
      .order('created_at');
    if (error) throw aError(error, 'No se pudieron cargar los ítems');
    return (data ?? []) as OrdenItem[];
  }

  async agregarItem(ordenId: string, item: ItemInput, posicion: number): Promise<OrdenItem> {
    const { data, error } = await this.client
      .from('orden_items')
      .insert({ ...item, descripcion: item.descripcion.trim(), taller_id: this.store.requerirTallerId(), orden_id: ordenId, orden: posicion })
      .select('*')
      .single();
    if (error) throw aError(error, 'No se pudo agregar el ítem');
    return data as OrdenItem;
  }

  async actualizarItem(id: string, cambios: Partial<ItemInput & { completado: boolean }>): Promise<OrdenItem> {
    const { data, error } = await this.client
      .from('orden_items')
      .update(cambios)
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw aError(error, 'No se pudo guardar el ítem');
    return data as OrdenItem;
  }

  async eliminarItem(id: string): Promise<void> {
    const { error } = await this.client
      .from('orden_items')
      .delete()
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id);
    if (error) throw aError(error, 'No se pudo eliminar el ítem');
  }

  /** Editable header fields of the order (assignment, progress and free-text notes). */
  async actualizar(
    id: string,
    cambios: Partial<Pick<OrdenTrabajo, 'mecanico_id' | 'progreso' | 'diagnostico' | 'notas_internas'>>,
  ): Promise<void> {
    const { error } = await this.client
      .from('ordenes_trabajo')
      .update(cambios)
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id);
    if (error) throw aError(error, 'No se pudo guardar la orden');
  }

  async cambiarEstado(ordenId: string, estado: EstadoOrden, comentario?: string | null): Promise<OrdenTrabajo> {
    const { data, error } = await this.client.rpc('cambiar_estado_orden', {
      p_orden: ordenId,
      p_estado: estado,
      p_comentario: comentario?.trim() || null,
    });
    if (error) throw aError(error, 'No se pudo cambiar el estado');
    return data as OrdenTrabajo;
  }

  /** History with the author's display name resolved from `perfiles`. */
  async historial(ordenId: string): Promise<(OrdenHistorial & { usuario: string | null })[]> {
    const { data, error } = await this.client
      .from('orden_historial')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('orden_id', ordenId)
      .order('created_at', { ascending: false });
    if (error) throw aError(error, 'No se pudo cargar el historial');
    const filas = (data ?? []) as OrdenHistorial[];

    const ids = [...new Set(filas.map((f) => f.user_id).filter((x): x is string => !!x))];
    const nombres = new Map<string, string>();
    if (ids.length) {
      const { data: perfiles } = await this.client.from('perfiles').select('user_id, nombre, email').in('user_id', ids);
      (perfiles ?? []).forEach((p: { user_id: string; nombre: string | null; email: string | null }) =>
        nombres.set(p.user_id, p.nombre || p.email || 'Usuario'),
      );
    }
    return filas.map((f) => ({ ...f, usuario: f.user_id ? (nombres.get(f.user_id) ?? null) : null }));
  }

  /** Signed URLs (1 hour) for the order photos; paths that fail to sign are skipped. */
  async urlsFotos(paths: string[]): Promise<{ path: string; url: string }[]> {
    if (!paths.length) return [];
    const { data, error } = await this.client.storage.from('mt-ordenes').createSignedUrls(paths, 3600);
    if (error) throw new Error('No se pudieron cargar las fotos');
    const firmadas: { path: string; url: string }[] = [];
    for (const d of data ?? []) {
      if (d.signedUrl && d.path) firmadas.push({ path: d.path, url: d.signedUrl });
    }
    return firmadas;
  }

  /** The non-annulled invoice of an order, if any. */
  async facturaActiva(ordenId: string): Promise<{ id: string; numero: string } | null> {
    const { data, error } = await this.client
      .from('facturas')
      .select('id, numero')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('orden_id', ordenId)
      .neq('estado', 'anulada')
      .maybeSingle();
    if (error) throw aError(error, 'No se pudo consultar la factura');
    return (data as { id: string; numero: string } | null) ?? null;
  }

  // ---- tablero de reparaciones ----

  /** Open orders (everything except entregado / cancelado), oldest first. */
  async abiertas(): Promise<OrdenResumen[]> {
    const { data, error } = await this.client
      .from('ordenes_resumen')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .in('estado', ['recepcion', 'diagnostico', 'en_progreso', 'esperando_repuestos', 'listo'])
      .order('fecha_entrada');
    if (error) throw aError(error, 'No se pudo cargar el tablero');
    return (data ?? []) as OrdenResumen[];
  }

  /** Orders delivered or cancelled in the last `dias` days. */
  async cerradas(dias = 30): Promise<OrdenResumen[]> {
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
    const { data, error } = await this.client
      .from('ordenes_resumen')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .in('estado', ['entregado', 'cancelado'])
      .or(`updated_at.gte.${desde},fecha_entrega.gte.${desde}`)
      .order('fecha_entrada', { ascending: false });
    if (error) throw aError(error, 'No se pudieron cargar las órdenes cerradas');
    return (data ?? []) as OrdenResumen[];
  }
}
