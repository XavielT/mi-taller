import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { ArticuloStock } from '../../../shared/models/articulo.model';
import { ArticulosService } from '../../../shared/services/articulos.service';
import { MtButton, MtCell, MtEmptyState, MtModal, MtPageHeader, MtTable, ToastService } from '../../../shared/ui';
import type { MtColumn } from '../../../shared/ui';
import { ArticuloForm } from '../../components/articulo-form/articulo-form';
import { MovimientoForm } from '../../components/movimiento-form/movimiento-form';

@Component({
  standalone: true,
  selector: 'app-inventario',
  imports: [CurrencyPipe, MtButton, MtCell, MtEmptyState, MtModal, MtPageHeader, MtTable, ArticuloForm, MovimientoForm],
  templateUrl: './inventario.html',
  styleUrls: ['./inventario.scss'],
})
export class Inventario {
  private svc = inject(ArticulosService);
  private toast = inject(ToastService);

  readonly tamano = 25;
  readonly columnas: MtColumn[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'nombre', label: 'Artículo' },
    { key: 'precio_venta', label: 'Precio', align: 'right' },
    { key: 'costo', label: 'Costo', align: 'right' },
    { key: 'stock', label: 'Stock', align: 'right' },
    { key: 'acciones', label: '', align: 'right' },
  ];

  busqueda = signal('');
  soloBajoMinimo = signal(false);
  incluirInactivos = signal(false);
  pagina = signal(1);
  filas = signal<ArticuloStock[]>([]);
  total = signal(0);
  cargando = signal(false);

  formAbierto = signal(false);
  editando = signal<ArticuloStock | null>(null);
  moviendo = signal<ArticuloStock | null>(null);

  paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamano)));
  private ultimaCarga = 0;

  constructor() {
    void this.cargar();
    toObservable(this.busqueda)
      .pipe(skip(1), debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.pagina.set(1);
        void this.cargar();
      });
  }

  async cargar(): Promise<void> {
    const id = ++this.ultimaCarga;
    this.cargando.set(true);
    try {
      const r = await this.svc.listar(
        { busqueda: this.busqueda(), soloBajoMinimo: this.soloBajoMinimo(), incluirInactivos: this.incluirInactivos() },
        this.pagina(),
        this.tamano,
      );
      if (id !== this.ultimaCarga) return;
      this.filas.set(r.filas);
      this.total.set(r.total);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo cargar el inventario');
    } finally {
      if (id === this.ultimaCarga) this.cargando.set(false);
    }
  }

  alternarFiltro(campo: 'bajo' | 'inactivos'): void {
    if (campo === 'bajo') this.soloBajoMinimo.update((v) => !v);
    else this.incluirInactivos.update((v) => !v);
    this.pagina.set(1);
    void this.cargar();
  }

  irAPagina(p: number): void {
    this.pagina.set(Math.min(Math.max(1, p), this.paginas()));
    void this.cargar();
  }

  nuevo(): void {
    this.editando.set(null);
    this.formAbierto.set(true);
  }

  editar(a: ArticuloStock): void {
    this.editando.set(a);
    this.formAbierto.set(true);
  }

  guardado(): void {
    this.toast.success(this.editando() ? 'Artículo actualizado' : 'Artículo creado');
    this.formAbierto.set(false);
    void this.cargar();
  }

  async alternarActivo(a: ArticuloStock): Promise<void> {
    try {
      await this.svc.activar(a.id, !a.activo);
      this.toast.success(a.activo ? `"${a.nombre}" desactivado` : `"${a.nombre}" activado`);
      await this.cargar();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el artículo');
    }
  }

  /** Recarga la lista y mantiene el modal de movimientos apuntando a la fila con el stock nuevo. */
  async movimientoRegistrado(): Promise<void> {
    const id = this.moviendo()?.id;
    await this.cargar();
    if (id) this.moviendo.set(this.filas().find((f) => f.id === id) ?? this.moviendo());
    this.toast.success('Movimiento registrado');
  }
}
