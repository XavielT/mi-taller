import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FacturasService } from '../../../shared/services/facturas.service';
import { MtButton, MtInput } from '../../../shared/ui';

/** Annul-an-invoice form: the reason is required (the RPC also enforces role and "no payments"). */
@Component({
  standalone: true,
  selector: 'app-anular-form',
  imports: [ReactiveFormsModule, MtButton, MtInput],
  template: `
    <form class="mt-stack" [formGroup]="form" (ngSubmit)="anular()" novalidate>
      <p>Esta acción no se puede deshacer. La factura quedará anulada y la orden podrá facturarse de nuevo.</p>
      <mt-input label="Motivo de la anulación *" [rows]="3" formControlName="motivo" />

      @if (error(); as msg) {
        <div class="mt-error" role="alert">{{ msg }}</div>
      }

      <div class="mt-actions">
        <mt-button variant="ghost" (click)="cancelado.emit()">Volver</mt-button>
        <mt-button type="submit" variant="danger" [loading]="guardando()">Anular factura</mt-button>
      </div>
    </form>
  `,
})
export class AnularForm {
  private fb = inject(FormBuilder);
  private svc = inject(FacturasService);

  facturaId = input.required<string>();
  anulada = output<void>();
  cancelado = output<void>();

  guardando = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    motivo: ['', [Validators.required, Validators.minLength(3)]],
  });

  async anular(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.svc.anular(this.facturaId(), this.form.getRawValue().motivo);
      this.anulada.emit();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo anular la factura');
    } finally {
      this.guardando.set(false);
    }
  }
}
