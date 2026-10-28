import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Cliente } from '../../../shared/models/cliente.model';
import { ClientesService } from '../../../shared/services/clientes.service';
import { MtButton, MtInput } from '../../../shared/ui';

/** Create / edit form for a cliente; saves through the service and emits the stored row. */
@Component({
  standalone: true,
  selector: 'app-cliente-form',
  imports: [ReactiveFormsModule, MtInput, MtButton],
  template: `
    <form class="mt-stack" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <mt-input label="Nombre *" placeholder="Nombre del cliente" formControlName="nombre" />
      <div class="mt-grid-2">
        <mt-input label="Teléfono" type="tel" placeholder="809-000-0000" formControlName="telefono" />
        <mt-input label="Correo electrónico" type="email" placeholder="cliente@correo.com" formControlName="email" />
      </div>
      <div class="mt-grid-2">
        <mt-input label="Documento (cédula / RNC)" formControlName="documento" />
        <mt-input label="Dirección" formControlName="direccion" />
      </div>
      <mt-input label="Notas" [rows]="3" formControlName="notas" />

      @if (error(); as msg) {
        <div class="mt-error" role="alert">{{ msg }}</div>
      }

      <div class="mt-actions">
        <mt-button variant="ghost" (click)="cancelado.emit()">Cancelar</mt-button>
        <mt-button type="submit" [loading]="guardando()">{{ cliente() ? 'Guardar cambios' : 'Crear cliente' }}</mt-button>
      </div>
    </form>
  `,
})
export class ClienteForm {
  private fb = inject(FormBuilder);
  private svc = inject(ClientesService);

  cliente = input<Cliente | null>(null);
  guardado = output<Cliente>();
  cancelado = output<void>();

  guardando = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    telefono: [''],
    email: ['', [Validators.email]],
    documento: [''],
    direccion: [''],
    notas: [''],
  });

  constructor() {
    effect(() => {
      const c = this.cliente();
      this.form.reset({
        nombre: c?.nombre ?? '',
        telefono: c?.telefono ?? '',
        email: c?.email ?? '',
        documento: c?.documento ?? '',
        direccion: c?.direccion ?? '',
        notas: c?.notas ?? '',
      });
      this.error.set(null);
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
      const actual = this.cliente();
      const fila = actual ? await this.svc.actualizar(actual.id, v) : await this.svc.crear(v);
      this.guardado.emit(fila);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar el cliente');
    } finally {
      this.guardando.set(false);
    }
  }
}
