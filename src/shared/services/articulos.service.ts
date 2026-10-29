import { Injectable, inject } from '@angular/core';
import { Articulo, ArticuloInput, ArticuloStock, MovimientoInventario, TipoMovimiento } from '../models/articulo.model';
import { TallerStore } from '../stores/taller.store';
import { limpiarBusqueda } from './clientes.service';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

export interface FiltroArticulos {
  busqueda?: string;
  soloBajoMinimo?: boolean;
  incluirInactivos?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ArticulosService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  async listar(filtro: FiltroArticulos = {}, pagina = 1, tamano = 25): Promise<{ filas: ArticuloStock[]; total: number }> {
    const desde = (pagina - 1) * tamano;
    let q = this.client
      .from('articulos_stock')
      .select('*', { count: 'exact' })
      .eq('taller_id', this.store.requerirTallerId())
      .order('nombre')
      .range(desde, desde + tamano - 1);
    if (!filtro.incluirInactivos) q = q.eq('activo', true);
    if (filtro.soloBajoMinimo) q = q.eq('bajo_minimo', true);
    const t = limpiarBusqueda(filtro.busqueda ?? '');
    if (t) q = q.or(`nombre.ilike.%${t}%,codigo.ilike.%${t}%`);

    const { data, error, count } = await q;
    if (error) throw aError(error, 'No se pudo cargar el inventario');
    return { filas: (data ?? []) as ArticuloStock[], total: count ?? 0 };
  }

  /** Artículos activos para el selector de la orden (con su stock disponible). */
  async paraOrden(): Promise<ArticuloStock[]> {
    const { data, error } = await this.client
      .from('articulos_stock')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('activo', true)
      .order('nombre')
      .limit(500);
    if (error) throw aError(error, 'No se pudo cargar el inventario');
    return (data ?? []) as ArticuloStock[];
  }

  async crear(d: ArticuloInput): Promise<Articulo> {
    const { data, error } = await this.client.rpc('crear_articulo', {
      p_taller: this.store.requerirTallerId(),
      p_nombre: d.nombre,
      p_codigo: d.codigo || null,
      p_descripcion: d.descripcion || null,
      p_precio_venta: d.precio_venta,
      p_costo: d.costo,
      p_stock_minimo: d.stock_minimo,
      p_stock_inicial: d.stock_inicial,
    });
    if (error) throw aError(error, 'No se pudo guardar el artículo');
    return data as Articulo;
  }

  async actualizar(id: string, d: Omit<ArticuloInput, 'stock_inicial'>): Promise<Articulo> {
    const { data, error } = await this.client
      .from('articulos')
      .update({
        nombre: d.nombre.trim(),
        codigo: d.codigo.trim() || null,
        descripcion: d.descripcion.trim() || null,
        precio_venta: d.precio_venta,
        costo: d.costo,
        stock_minimo: d.stock_minimo,
      })
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw aError(error, 'No se pudo guardar el artículo');
    return data as Articulo;
  }

  async activar(id: string, activo: boolean): Promise<void> {
    const { error } = await this.client
      .from('articulos')
      .update({ activo })
      .eq('taller_id', this.store.requerirTallerId())
      .eq('id', id);
    if (error) throw aError(error, 'No se pudo actualizar el artículo');
  }

  async movimientos(articuloId: string, limite = 20): Promise<MovimientoInventario[]> {
    const { data, error } = await this.client
      .from('movimientos_inventario')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('articulo_id', articuloId)
      .order('created_at', { ascending: false })
      .limit(limite);
    if (error) throw aError(error, 'No se pudo cargar el historial');
    return (data ?? []) as MovimientoInventario[];
  }

  async registrarMovimiento(articuloId: string, tipo: TipoMovimiento, cantidad: number, nota: string): Promise<void> {
    const { error } = await this.client.rpc('registrar_movimiento', {
      p_articulo: articuloId,
      p_tipo: tipo,
      p_cantidad: cantidad,
      p_nota: nota || null,
    });
    if (error) throw aError(error, 'No se pudo registrar el movimiento');
  }
}
