import { CurrencyPipe } from '@angular/common';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ETIQUETA_METODO, MetodoPago, Pago } from '../../../shared/models/factura.model';
import { PagosService } from '../../../shared/services/pagos.service';
import { MtButton, MtInput, MtSelect } from '../../../shared/ui';
import type { MtOption } from '../../../shared/ui';

/** Register-a-payment form. The amount is validated live against the invoice balance. */
@Component({
  standalone: true,
  selector: 'app-pago-form',
  imports: [CurrencyPipe, ReactiveFormsModule, MtButton, MtInput, MtSelect],
  template: `
    <form class="mt-stack" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <p class="mt-muted">Balance pendiente: <strong>{{ balance() | currency }}</strong></p>
      <mt-input label="Monto *" type="number" [min]="0.01" [max]="balance()" step="0.01" formControlName="monto" />
      <mt-select label="Método de pago *" [options]="metodos" formControlName="metodo" />
      <mt-input label="Referencia" placeholder="No. de transferencia, voucher..." formControlName="referencia" />
      <mt-input label="Notas" [rows]="2" formControlName="notas" />

      @if (error(); as msg) {
        <div class="mt-error" role="alert">{{ msg }}</div>
      }

      <div class="mt-actions">
        <mt-button variant="ghost" (click)="cancelado.emit()">Cancelar</mt-button>
        <mt-button type="submit" [loading]="guardando()">Registrar pago</mt-button>
      </div>
    </form>
  `,
})
export class PagoForm {
  private fb = inject(FormBuilder);
  private svc = inject(PagosService);

  facturaId = input.required<string>();
  balance = input.required<number>();
  registrado = output<Pago>();
  cancelado = output<void>();

  guardando = signal(false);
  error = signal<string | null>(null);

  readonly metodos: MtOption[] = (Object.keys(ETIQUETA_METODO) as MetodoPago[]).map((m) => ({ value: m, label: ETIQUETA_METODO[m] }));

  form = this.fb.nonNullable.group({
    monto: [0, [Validators.required, Validators.min(0.01)]],
    metodo: ['efectivo' as MetodoPago, [Validators.required]],
    referencia: [''],
    notas: [''],
  });

  constructor() {
    effect(() => {
      const balance = this.balance();
      // live validation: the amount can never exceed what is still owed
      this.form.controls.monto.setValidators([Validators.required, Validators.min(0.01), Validators.max(balance)]);
      this.form.controls.monto.setValue(balance);
      this.form.controls.monto.updateValueAndValidity();
    });
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      const pago = await this.svc.registrar({
        facturaId: this.facturaId(),
        monto: Number(v.monto),
        metodo: v.metodo,
        referencia: v.referencia,
        notas: v.notas,
      });
      this.registrado.emit(pago);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo registrar el pago');
    } finally {
      this.guardando.set(false);
    }
  }
}
