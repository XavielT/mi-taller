import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  ETIQUETA_ESTADO,
  EstadoOrden,
  OrdenResumen,
  errorTransicion,
  transicionPermitida,
} from '../../../shared/models/orden.model';
import { OrdenesService } from '../../../shared/services/ordenes.service';
import { iniciales } from '../../../shared/components/header/header';
import { MtBadgeEstado, MtButton, MtCell, MtEmptyState, MtPageHeader, MtSelect, MtTable, ToastService } from '../../../shared/ui';
import type { MtColumn, MtOption } from '../../../shared/ui';

/** Board columns, left to right. */
export const COLUMNAS_TABLERO: EstadoOrden[] = ['recepcion', 'diagnostico', 'en_progreso', 'esperando_repuestos', 'listo'];

export function diasEnTaller(fechaEntrada: string, ahora = Date.now()): number {
  return Math.max(0, Math.floor((ahora - new Date(fechaEntrada).getTime()) / 86_400_000));
}

@Component({
  standalone: true,
  selector: 'app-reparaciones',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, MtBadgeEstado, MtButton, MtCell, MtEmptyState, MtPageHeader, MtSelect, MtTable],
  templateUrl: './reparaciones.html',
  styleUrls: ['./reparaciones.scss'],
})
export class Reparaciones implements OnInit {
  private svc = inject(OrdenesService);
  private toast = inject(ToastService);

  readonly columnas = COLUMNAS_TABLERO;
  readonly etiqueta = ETIQUETA_ESTADO;
  readonly columnasCerradas: MtColumn[] = [
    { key: 'numero', label: 'Orden' },
    { key: 'estado', label: 'Estado' },
    { key: 'vehiculo', label: 'Vehículo' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'fecha_entrada', label: 'Entrada' },
    { key: 'total', label: 'Total', align: 'right' },
  ];

  ordenes = signal<OrdenResumen[]>([]);
  cerradas = signal<OrdenResumen[]>([]);
  cargando = signal(true);
  verCerradas = signal(false);
  cargandoCerradas = signal(false);

  mecanicos = signal<MtOption[]>([]);
  filtroMecanico = signal<string | null>(null);
  busqueda = signal('');
  private busquedaAplicada = signal('');

  /** Card being dragged and column currently hovered (for the drop highlight). */
  arrastrando = signal<string | null>(null);
  columnaSobre = signal<EstadoOrden | null>(null);

  private filtradas = computed(() => {
    const mec = this.filtroMecanico();
    const q = this.busquedaAplicada().trim().toLowerCase();
    return this.ordenes().filter(
      (o) =>
        (!mec || o.mecanico_id === mec) &&
        (!q || o.numero.toLowerCase().includes(q) || (o.vehiculo_placa ?? '').toLowerCase().includes(q)),
    );
  });

  porColumna = computed(() => {
    const mapa = Object.fromEntries(this.columnas.map((c) => [c, [] as OrdenResumen[]])) as Record<EstadoOrden, OrdenResumen[]>;
    for (const o of this.filtradas()) mapa[o.estado]?.push(o);
    return mapa;
  });

  constructor() {
    toObservable(this.busqueda)
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.busquedaAplicada.set(q));
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargar(), this.cargarMecanicos()]);
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.ordenes.set(await this.svc.abiertas());
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo cargar el tablero');
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarMecanicos(): Promise<void> {
    try {
      const m = await this.svc.mecanicos();
      this.mecanicos.set(m.map((x) => ({ value: x.user_id, label: x.nombre || x.email || 'Mecánico' })));
    } catch {
      // the filter just stays empty
    }
  }

  async alternarCerradas(): Promise<void> {
    const ver = !this.verCerradas();
    this.verCerradas.set(ver);
    if (!ver) return;
    this.cargandoCerradas.set(true);
    try {
      this.cerradas.set(await this.svc.cerradas(30));
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las órdenes cerradas');
    } finally {
      this.cargandoCerradas.set(false);
    }
  }

  // ---- movimiento entre columnas ----

  vecino(o: OrdenResumen, sentido: -1 | 1): EstadoOrden | null {
    const i = this.columnas.indexOf(o.estado) + sentido;
    return this.columnas[i] ?? null;
  }

  puedeMover(o: OrdenResumen, sentido: -1 | 1): boolean {
    const destino = this.vecino(o, sentido);
    return destino !== null && transicionPermitida(o.estado, destino);
  }

  async mover(o: OrdenResumen, destino: EstadoOrden): Promise<void> {
    if (o.estado === destino) return;
    if (!transicionPermitida(o.estado, destino)) {
      this.toast.error(errorTransicion(o.estado, destino));
      return; // the card never left its column: it "snaps back"
    }
    const anterior = o.estado;
    this.cambiarLocal(o.id, destino); // optimistic
    try {
      await this.svc.cambiarEstado(o.id, destino);
    } catch (e) {
      this.cambiarLocal(o.id, anterior);
      this.toast.error(e instanceof Error ? e.message : 'No se pudo mover la orden');
    }
  }

  private cambiarLocal(id: string, estado: EstadoOrden): void {
    this.ordenes.update((lista) => lista.map((x) => (x.id === id ? { ...x, estado } : x)));
  }

  // ---- drag & drop nativo ----

  iniciarArrastre(e: DragEvent, o: OrdenResumen): void {
    e.dataTransfer?.setData('text/plain', o.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    this.arrastrando.set(o.id);
  }

  terminarArrastre(): void {
    this.arrastrando.set(null);
    this.columnaSobre.set(null);
  }

  sobreColumna(e: DragEvent, col: EstadoOrden): void {
    e.preventDefault(); // required to allow dropping
    this.columnaSobre.set(col);
  }

  async soltar(e: DragEvent, col: EstadoOrden): Promise<void> {
    e.preventDefault();
    const id = e.dataTransfer?.getData('text/plain') || this.arrastrando();
    this.terminarArrastre();
    const orden = this.ordenes().find((o) => o.id === id);
    if (orden) await this.mover(orden, col);
  }

  // ---- presentación ----

  dias(o: OrdenResumen): number {
    return diasEnTaller(o.fecha_entrada);
  }

  iniciales(nombre: string | null): string {
    return iniciales(nombre, null);
  }
}
