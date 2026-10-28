import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { FacturaResumen, ResumenFinanzas } from '../../../shared/models/factura.model';
import { FacturasService, FiltroEstado } from '../../../shared/services/facturas.service';
import { FinanzasService } from '../../../shared/services/finanzas.service';
import { TallerStore } from '../../../shared/stores/taller.store';
import { hoyISO, inicioMesISO } from '../../../shared/utils/fechas';
import { MtBadgeEstado, MtButton, MtCell, MtEmptyState, MtModal, MtPageHeader, MtTable, ToastService } from '../../../shared/ui';
import type { MtColumn } from '../../../shared/ui';
import { AnularForm } from '../../components/anular-form/anular-form';
import { PagoForm } from '../../components/pago-form/pago-form';

@Component({
  standalone: true,
  selector: 'app-finanzas',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    MtBadgeEstado,
    MtButton,
    MtCell,
    MtEmptyState,
    MtModal,
    MtPageHeader,
    MtTable,
    AnularForm,
    PagoForm,
  ],
  templateUrl: './finanzas.html',
  styleUrls: ['./finanzas.scss'],
})
export class Finanzas implements OnInit {
  private facturasSvc = inject(FacturasService);
  private finanzasSvc = inject(FinanzasService);
  private store = inject(TallerStore);
  private toast = inject(ToastService);

  readonly chips: { valor: FiltroEstado; etiqueta: string }[] = [
    { valor: 'todas', etiqueta: 'Todas' },
    { valor: 'pendiente', etiqueta: 'Pendientes' },
    { valor: 'pagada', etiqueta: 'Pagadas' },
    { valor: 'vencida', etiqueta: 'Vencidas' },
    { valor: 'anulada', etiqueta: 'Anuladas' },
  ];

  readonly columnas: MtColumn[] = [
    { key: 'numero', label: 'Factura' },
    { key: 'cliente', label: 'Cliente / Vehículo' },
    { key: 'fecha_emision', label: 'Emisión' },
    { key: 'total', label: 'Total', align: 'right' },
    { key: 'pagado', label: 'Pagado', align: 'right' },
    { key: 'balance', label: 'Saldo', align: 'right' },
    { key: 'estado', label: 'Estado' },
    { key: 'acciones', label: '', align: 'right' },
  ];

  resumen = signal<ResumenFinanzas | null>(null);
  facturas = signal<FacturaResumen[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  estado = signal<FiltroEstado>('todas');
  desde = signal(inicioMesISO());
  hasta = signal(hoyISO());
  busqueda = signal('');

  pagando = signal<FacturaResumen | null>(null);
  anulando = signal<FacturaResumen | null>(null);

  readonly puedeAnular = computed(() => {
    const r = this.store.rol();
    return r === 'propietario' || r === 'administrador';
  });

  private ultimaCarga = 0;

  constructor() {
    toObservable(this.busqueda)
      .pipe(skip(1), debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => void this.cargarFacturas());
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarResumen(), this.cargarFacturas()]);
  }

  private async cargarResumen(): Promise<void> {
    try {
      this.resumen.set(await this.finanzasSvc.resumen(this.desde(), this.hasta()));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar el resumen');
    }
  }

  async cargarFacturas(): Promise<void> {
    const id = ++this.ultimaCarga;
    this.cargando.set(true);
    try {
      const filas = await this.facturasSvc.listar({
        estado: this.estado(),
        desde: this.desde(),
        hasta: this.hasta(),
        busqueda: this.busqueda(),
      });
      if (id === this.ultimaCarga) this.facturas.set(filas);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las facturas');
    } finally {
      if (id === this.ultimaCarga) this.cargando.set(false);
    }
  }

  elegirEstado(e: FiltroEstado): void {
    this.estado.set(e);
    void this.cargarFacturas();
  }

  cambiarFechas(): void {
    void this.cargarFacturas();
    void this.cargarResumen();
  }

  /** True for invoices that still owe money and can take a payment. */
  puedeCobrar(f: FacturaResumen): boolean {
    return (f.estado_efectivo === 'pendiente' || f.estado_efectivo === 'vencida') && f.balance > 0;
  }

  /** Annulling is blocked by the RPC once payments exist, so only offer it for unpaid invoices. */
  puedeAnularFactura(f: FacturaResumen): boolean {
    return this.puedeAnular() && this.puedeCobrar(f) && f.pagado === 0;
  }

  async tras(mensaje: string): Promise<void> {
    this.pagando.set(null);
    this.anulando.set(null);
    this.toast.success(mensaje);
    await Promise.all([this.cargarResumen(), this.cargarFacturas()]);
  }
}
