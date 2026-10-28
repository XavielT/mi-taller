import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ETIQUETA_METODO, ETIQUETA_NCF, FacturaItem, FacturaResumen, Pago } from '../../../shared/models/factura.model';
import { FacturasService } from '../../../shared/services/facturas.service';
import { PagosService } from '../../../shared/services/pagos.service';
import { TallerStore } from '../../../shared/stores/taller.store';
import { MtBadgeEstado, MtButton, MtModal, ToastService } from '../../../shared/ui';
import { AnularForm } from '../../components/anular-form/anular-form';
import { PagoForm } from '../../components/pago-form/pago-form';

@Component({
  standalone: true,
  selector: 'app-factura-detalle',
  imports: [CurrencyPipe, DatePipe, RouterLink, MtBadgeEstado, MtButton, MtModal, AnularForm, PagoForm],
  templateUrl: './factura-detalle.html',
  styleUrls: ['./factura-detalle.scss'],
})
export class FacturaDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private facturasSvc = inject(FacturasService);
  private pagosSvc = inject(PagosService);
  private store = inject(TallerStore);
  private toast = inject(ToastService);

  readonly metodo = ETIQUETA_METODO;
  readonly ncfEtiqueta = ETIQUETA_NCF;

  facturaId = '';
  factura = signal<FacturaResumen | null>(null);
  items = signal<FacturaItem[]>([]);
  pagos = signal<Pago[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  modalPago = signal(false);
  modalAnular = signal(false);

  readonly taller = this.store.tallerActivo;

  readonly puedeCobrar = computed(() => {
    const f = this.factura();
    return !!f && (f.estado_efectivo === 'pendiente' || f.estado_efectivo === 'vencida') && f.balance > 0;
  });

  readonly puedeAnular = computed(() => {
    const rol = this.store.rol();
    const f = this.factura();
    return (rol === 'propietario' || rol === 'administrador') && !!f && f.estado !== 'anulada' && f.pagado === 0;
  });

  async ngOnInit(): Promise<void> {
    this.facturaId = this.route.snapshot.paramMap.get('id') ?? '';
    try {
      await this.cargar();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar la factura');
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargar(): Promise<void> {
    const [factura, items, pagos] = await Promise.all([
      this.facturasSvc.obtener(this.facturaId),
      this.facturasSvc.items(this.facturaId),
      this.pagosSvc.porFactura(this.facturaId),
    ]);
    this.factura.set(factura);
    this.items.set(items);
    this.pagos.set(pagos);
  }

  private async tras(mensaje: string): Promise<void> {
    this.modalPago.set(false);
    this.modalAnular.set(false);
    this.toast.success(mensaje);
    try {
      await this.cargar();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la factura');
    }
  }

  pagoRegistrado(): Promise<void> {
    return this.tras('Pago registrado');
  }

  facturaAnulada(): Promise<void> {
    return this.tras('Factura anulada');
  }

  imprimir(): void {
    window.print();
  }
}
