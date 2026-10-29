import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import {
  CHECKLIST_ENTRADA,
  ETIQUETA_ESTADO,
  EstadoOrden,
  ItemInput,
  OrdenItem,
  OrdenResumen,
  TRANSICIONES,
} from '../../../shared/models/orden.model';
import { ArticuloStock } from '../../../shared/models/articulo.model';
import { ArticulosService } from '../../../shared/services/articulos.service';
import { MAX_FOTOS, OrdenesService, errorFoto } from '../../../shared/services/ordenes.service';
import { TallerStore } from '../../../shared/stores/taller.store';
import { calcularTotales, importeItem } from '../../../shared/utils/totales';
import { enlaceWhatsApp } from '../../../shared/utils/whatsapp';
import { MtBadgeEstado, MtButton, MtEmptyState, MtModal, MtSelect, ToastService } from '../../../shared/ui';
import type { MtOption } from '../../../shared/ui';

type EntradaHistorial = Awaited<ReturnType<OrdenesService['historial']>>[number];

@Component({
  standalone: true,
  selector: 'app-orden-detalle',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MtBadgeEstado,
    MtButton,
    MtEmptyState,
    MtModal,
    MtSelect,
  ],
  templateUrl: './orden-detalle.html',
  styleUrls: ['./orden-detalle.scss'],
})
export class OrdenDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private svc = inject(OrdenesService);
  private articulosSvc = inject(ArticulosService);
  private store = inject(TallerStore);
  private toast = inject(ToastService);

  readonly etiqueta = ETIQUETA_ESTADO;
  readonly checklist = CHECKLIST_ENTRADA;
  readonly maxFotos = MAX_FOTOS;

  ordenId = '';
  orden = signal<OrdenResumen | null>(null);
  items = signal<OrdenItem[]>([]);
  historial = signal<EntradaHistorial[]>([]);
  fotos = signal<{ path: string; url: string }[]>([]);
  factura = signal<{ id: string; numero: string } | null>(null);
  mecanicos = signal<MtOption[]>([]);
  /** Artículos activos del inventario para el selector de ítems (con su stock disponible). */
  articulos = signal<ArticuloStock[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  progreso = signal(0);
  diagnostico = signal('');
  notas = signal('');
  private progresoCambios = new Subject<number>();

  // cambio de estado
  destino = signal<EstadoOrden | null>(null);
  comentario = signal('');
  cambiando = signal(false);
  errorEstado = signal<string | null>(null);

  agregando = signal(false);
  subiendoFotos = signal(false);

  itemForm = this.fb.nonNullable.group({
    articulo_id: [''],
    tipo: ['mano_obra' as 'mano_obra' | 'repuesto'],
    descripcion: ['', [Validators.required]],
    cantidad: [1, [Validators.required, Validators.min(0.01)]],
    precio_unitario: [0, [Validators.required, Validators.min(0)]],
    aplica_itbis: [true],
  });

  readonly itbisPct = computed(() => this.store.tallerActivo()?.config?.itbis ?? 18);
  readonly totales = computed(() => calcularTotales(this.items(), this.itbisPct()));
  /** Items and header are read-only once the order is closed. */
  readonly editable = computed(() => {
    const e = this.orden()?.estado;
    return e !== undefined && e !== 'entregado' && e !== 'cancelado';
  });
  readonly acciones = computed(() => {
    const e = this.orden()?.estado;
    return e ? TRANSICIONES[e] : [];
  });
  /** Enlace de WhatsApp con el aviso al cliente según el estado; null si el cliente no tiene un teléfono válido. */
  readonly whatsapp = computed(() => {
    const o = this.orden();
    if (!o) return null;
    const taller = this.store.tallerActivo()?.nombre ?? 'el taller';
    const vehiculo = [o.vehiculo_marca, o.vehiculo_modelo].filter(Boolean).join(' ') || 'vehículo';
    const placa = o.vehiculo_placa ? ` (placa ${o.vehiculo_placa})` : '';
    const nombre = o.cliente_nombre ?? 'cliente';
    const total = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(o.total);
    const mensaje =
      o.estado === 'listo'
        ? `Hola ${nombre}, su ${vehiculo}${placa} ya está listo para retirar en ${taller}. Total a pagar: ${total}. ¡Gracias por su confianza!`
        : o.estado === 'entregado'
          ? `Hola ${nombre}, gracias por confiar en ${taller}. Su ${vehiculo}${placa} fue entregado. ¡Que lo disfrute!`
          : `Hola ${nombre}, le informamos que su ${vehiculo}${placa} está en "${ETIQUETA_ESTADO[o.estado]}" (orden ${o.numero}) en ${taller}.`;
    return enlaceWhatsApp(o.cliente_telefono, mensaje);
  });

  readonly puedeFacturar = computed(() => {
    const e = this.orden()?.estado;
    return (e === 'listo' || e === 'entregado') && !this.factura();
  });

  constructor() {
    this.progresoCambios
      .pipe(debounceTime(400), takeUntilDestroyed())
      .subscribe((valor) => void this.guardarProgreso(valor));
  }

  async ngOnInit(): Promise<void> {
    this.ordenId = this.route.snapshot.paramMap.get('id') ?? '';
    try {
      const [orden, items, historial, factura] = await Promise.all([
        this.svc.obtener(this.ordenId),
        this.svc.items(this.ordenId),
        this.svc.historial(this.ordenId),
        this.svc.facturaActiva(this.ordenId),
      ]);
      this.aplicarOrden(orden);
      this.items.set(items);
      this.historial.set(historial);
      this.factura.set(factura);
      void this.cargarFotos();
      void this.cargarMecanicos();
      void this.cargarArticulos();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar la orden');
    } finally {
      this.cargando.set(false);
    }
  }

  private aplicarOrden(o: OrdenResumen): void {
    this.orden.set(o);
    this.progreso.set(o.progreso);
    this.diagnostico.set(o.diagnostico ?? '');
    this.notas.set(o.notas_internas ?? '');
  }

  private async cargarMecanicos(): Promise<void> {
    try {
      const m = await this.svc.mecanicos();
      this.mecanicos.set(m.map((x) => ({ value: x.user_id, label: x.nombre || x.email || 'Mecánico' })));
    } catch {
      // assignment select stays empty
    }
  }

  private async cargarArticulos(): Promise<void> {
    try {
      this.articulos.set(await this.articulosSvc.paraOrden());
    } catch {
      // the picker stays empty; items can still be typed by hand
    }
  }

  /** Al elegir un artículo se rellenan tipo, descripción y precio; la cantidad se valida contra el stock en la base de datos. */
  elegirArticulo(id: string): void {
    const a = this.articulos().find((x) => x.id === id);
    if (!a) return;
    this.itemForm.patchValue({ articulo_id: a.id, tipo: 'repuesto', descripcion: a.nombre, precio_unitario: a.precio_venta });
  }

  private async cargarFotos(): Promise<void> {
    try {
      this.fotos.set(await this.svc.urlsFotos(this.orden()?.fotos ?? []));
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las fotos');
    }
  }

  /** Re-reads the order from `ordenes_resumen`: the DB-computed totals are the truth after any save. */
  private async refrescarResumen(): Promise<void> {
    try {
      const o = await this.svc.obtener(this.ordenId);
      this.orden.update((actual) => (actual ? { ...o } : o));
    } catch {
      // keep what we have
    }
  }

  private async recargarHistorial(): Promise<void> {
    try {
      this.historial.set(await this.svc.historial(this.ordenId));
    } catch {
      // keep what we have
    }
  }

  // ---- cabecera ----

  async cambiarMecanico(id: string | null): Promise<void> {
    const o = this.orden();
    if (!o) return;
    try {
      await this.svc.actualizar(o.id, { mecanico_id: id });
      await this.refrescarResumen();
      this.toast.success('Mecánico actualizado');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo asignar el mecánico');
      await this.refrescarResumen();
    }
  }

  moverProgreso(valor: number): void {
    this.progreso.set(valor);
    this.progresoCambios.next(valor);
  }

  private async guardarProgreso(valor: number): Promise<void> {
    try {
      await this.svc.actualizar(this.ordenId, { progreso: valor });
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo guardar el progreso');
    }
  }

  async guardarTexto(campo: 'diagnostico' | 'notas_internas'): Promise<void> {
    const o = this.orden();
    if (!o) return;
    const valor = campo === 'diagnostico' ? this.diagnostico() : this.notas();
    if ((o[campo] ?? '') === valor) return;
    try {
      await this.svc.actualizar(o.id, { [campo]: valor.trim() || null });
      this.orden.set({ ...o, [campo]: valor.trim() || null });
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  // ---- ítems ----

  importe(i: OrdenItem): number {
    return importeItem(i);
  }

  async agregarItem(): Promise<void> {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }
    this.agregando.set(true);
    try {
      const v = this.itemForm.getRawValue();
      const item = await this.svc.agregarItem(
        this.ordenId,
        { ...v, articulo_id: v.articulo_id || null, cantidad: Number(v.cantidad), precio_unitario: Number(v.precio_unitario) },
        this.items().length + 1,
      );
      this.items.update((l) => [...l, item]);
      this.itemForm.reset({ articulo_id: '', tipo: v.tipo, descripcion: '', cantidad: 1, precio_unitario: 0, aplica_itbis: true });
      await this.refrescarResumen();
      void this.cargarArticulos();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo agregar el ítem');
    } finally {
      this.agregando.set(false);
    }
  }

  async editarItem(item: OrdenItem, cambios: Partial<ItemInput & { completado: boolean }>): Promise<void> {
    try {
      const guardado = await this.svc.actualizarItem(item.id, cambios);
      this.items.update((l) => l.map((x) => (x.id === guardado.id ? guardado : x)));
      await this.refrescarResumen();
      if (guardado.articulo_id) void this.cargarArticulos();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo guardar el ítem');
      this.items.set(await this.svc.items(this.ordenId)); // snap back to what the DB has
    }
  }

  editarNumero(item: OrdenItem, campo: 'cantidad' | 'precio_unitario', texto: string): void {
    const n = Number(texto);
    const minimo = campo === 'cantidad' ? 0.01 : 0;
    if (!Number.isFinite(n) || n < minimo) {
      this.toast.error(campo === 'cantidad' ? 'La cantidad debe ser mayor que cero' : 'El precio no puede ser negativo');
      this.items.update((l) => [...l]); // force the inputs back to the stored value
      return;
    }
    if (n !== item[campo]) void this.editarItem(item, { [campo]: n });
  }

  editarDescripcion(item: OrdenItem, texto: string): void {
    const t = texto.trim();
    if (!t) {
      this.toast.error('La descripción es requerida');
      this.items.update((l) => [...l]);
      return;
    }
    if (t !== item.descripcion) void this.editarItem(item, { descripcion: t });
  }

  async eliminarItem(item: OrdenItem): Promise<void> {
    try {
      await this.svc.eliminarItem(item.id);
      this.items.update((l) => l.filter((x) => x.id !== item.id));
      await this.refrescarResumen();
      if (item.articulo_id) void this.cargarArticulos();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el ítem');
    }
  }

  // ---- estado ----

  abrirCambio(estado: EstadoOrden): void {
    this.destino.set(estado);
    this.comentario.set('');
    this.errorEstado.set(null);
  }

  async confirmarCambio(): Promise<void> {
    const estado = this.destino();
    const o = this.orden();
    if (!estado || !o) return;
    if (estado === 'cancelado' && !this.comentario().trim()) {
      this.errorEstado.set('Indica el motivo de la cancelación');
      return;
    }
    this.cambiando.set(true);
    this.errorEstado.set(null);
    try {
      await this.svc.cambiarEstado(o.id, estado, this.comentario());
      this.destino.set(null);
      this.toast.success(`Orden ${o.numero}: ${this.etiqueta[estado]}`);
      await Promise.all([this.refrescarResumen(), this.recargarHistorial()]);
    } catch (e) {
      this.errorEstado.set(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    } finally {
      this.cambiando.set(false);
    }
  }

  // ---- fotos ----

  async subirFotos(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    const o = this.orden();
    if (!o || !archivos.length) return;
    if (o.fotos.length + archivos.length > MAX_FOTOS) {
      this.toast.error(`Máximo ${MAX_FOTOS} fotos por orden`);
      return;
    }
    const problema = archivos.map((f) => errorFoto(f)).find((m) => m);
    if (problema) {
      this.toast.error(problema);
      return;
    }
    this.subiendoFotos.set(true);
    try {
      const nuevas = await this.svc.subirFotos(o.id, archivos, o.fotos);
      this.orden.set({ ...o, fotos: [...o.fotos, ...nuevas] });
      await this.cargarFotos();
      this.toast.success(nuevas.length === 1 ? 'Foto agregada' : `${nuevas.length} fotos agregadas`);
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'No se pudieron subir las fotos');
    } finally {
      this.subiendoFotos.set(false);
    }
  }

  itemsChecklist(o: OrdenResumen): string[] {
    return this.checklist.filter((c) => o.inventario_entrada?.[c.key]).map((c) => c.label);
  }
}
