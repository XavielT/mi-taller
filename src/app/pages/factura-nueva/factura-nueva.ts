import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ETIQUETA_NCF, TipoNcf } from '../../../shared/models/factura.model';
import { OrdenItem, OrdenResumen } from '../../../shared/models/orden.model';
import { FacturasService } from '../../../shared/services/facturas.service';
import { OrdenesService } from '../../../shared/services/ordenes.service';
import { TallerStore } from '../../../shared/stores/taller.store';
import { hoyISO, sumarDiasISO } from '../../../shared/utils/fechas';
import { ncfValidator } from '../../../shared/utils/ncf';
import { calcularTotales, importeItem } from '../../../shared/utils/totales';
import { MtButton, MtEmptyState, MtInput, MtPageHeader, MtSelect, ToastService } from '../../../shared/ui';
import type { MtOption } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-factura-nueva',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, MtButton, MtEmptyState, MtInput, MtPageHeader, MtSelect],
  templateUrl: './factura-nueva.html',
  styleUrls: ['./factura-nueva.scss'],
})
export class FacturaNueva implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private ordenesSvc = inject(OrdenesService);
  private facturasSvc = inject(FacturasService);
  private store = inject(TallerStore);
  private toast = inject(ToastService);

  readonly tiposNcf: MtOption[] = (Object.keys(ETIQUETA_NCF) as TipoNcf[]).map((t) => ({ value: t, label: ETIQUETA_NCF[t] }));

  orden = signal<OrdenResumen | null>(null);
  items = signal<OrdenItem[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);
  emitiendo = signal(false);
  errorEmision = signal<string | null>(null);

  readonly itbisPct = computed(() => this.store.tallerActivo()?.config?.itbis ?? 18);
  readonly totales = computed(() => calcularTotales(this.items(), this.itbisPct()));

  form = this.fb.nonNullable.group({
    tipo_ncf: [null as TipoNcf | null],
    ncf: ['', [ncfValidator]],
    fecha_vencimiento: [sumarDiasISO(this.store.tallerActivo()?.config?.dias_vencimiento ?? 30), [Validators.required]],
    notas: [''],
  });

  readonly hoy = hoyISO();

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.queryParamMap.get('orden');
    if (!id) {
      this.error.set('Falta indicar la orden a facturar');
      this.cargando.set(false);
      return;
    }
    try {
      const [orden, items, existente] = await Promise.all([
        this.ordenesSvc.obtener(id),
        this.ordenesSvc.items(id),
        this.ordenesSvc.facturaActiva(id),
      ]);
      if (existente) {
        await this.router.navigate(['/home/finanzas/facturas', existente.id], { replaceUrl: true });
        return;
      }
      this.orden.set(orden);
      this.items.set(items);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar la orden');
    } finally {
      this.cargando.set(false);
    }
  }

  readonly estadoValido = computed(() => {
    const e = this.orden()?.estado;
    return e === 'listo' || e === 'entregado';
  });

  importe(i: OrdenItem): number {
    return importeItem(i);
  }

  async emitir(): Promise<void> {
    const o = this.orden();
    if (!o) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.emitiendo.set(true);
    this.errorEmision.set(null);
    try {
      const v = this.form.getRawValue();
      const factura = await this.facturasSvc.emitir({
        ordenId: o.id,
        tipoNcf: v.tipo_ncf,
        ncf: v.ncf,
        fechaVencimiento: v.fecha_vencimiento,
        notas: v.notas,
      });
      this.toast.success(`Factura ${factura.numero} emitida`);
      await this.router.navigate(['/home/finanzas/facturas', factura.id]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo emitir la factura';
      this.errorEmision.set(msg);
      this.toast.error(msg);
    } finally {
      this.emitiendo.set(false);
    }
  }
}
