import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Vehiculo } from '../../../shared/models/vehiculo.model';
import { VehiculosService } from '../../../shared/services/vehiculos.service';
import { MtButton, MtInput } from '../../../shared/ui';

const ANIO_MIN = 1950;
const aNumero = (v: string): number | null => (v.trim() === '' ? null : Number(v));

/** Create / edit form for a vehículo of one cliente. */
@Component({
  standalone: true,
  selector: 'app-vehiculo-form',
  imports: [ReactiveFormsModule, MtInput, MtButton],
  template: `
    <form class="mt-stack" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <mt-input label="Placa *" placeholder="A123456" formControlName="placa" />
      <div class="mt-grid-2">
        <mt-input label="Marca" placeholder="Toyota" formControlName="marca" />
        <mt-input label="Modelo" placeholder="Corolla" formControlName="modelo" />
      </div>
      <div class="mt-grid-2">
        <mt-input label="Año" type="number" [min]="anioMin" [max]="anioMax" formControlName="anio" />
        <mt-input label="Color" formControlName="color" />
      </div>
      <div class="mt-grid-2">
        <mt-input label="VIN (opcional)" hint="17 caracteres" formControlName="vin" />
        <mt-input label="Kilometraje" type="number" [min]="0" formControlName="kilometraje" />
      </div>

      @if (error(); as msg) {
        <div class="mt-error" role="alert">{{ msg }}</div>
      }

      <div class="mt-actions">
        <mt-button variant="ghost" (click)="cancelado.emit()">Cancelar</mt-button>
        <mt-button type="submit" [loading]="guardando()">{{ vehiculo() ? 'Guardar cambios' : 'Agregar vehículo' }}</mt-button>
      </div>
    </form>
  `,
})
export class VehiculoForm {
  private fb = inject(FormBuilder);
  private svc = inject(VehiculosService);

  clienteId = input.required<string>();
  vehiculo = input<Vehiculo | null>(null);
  guardado = output<Vehiculo>();
  cancelado = output<void>();

  guardando = signal(false);
  error = signal<string | null>(null);

  readonly anioMin = ANIO_MIN;
  readonly anioMax = new Date().getFullYear() + 1;

  form = this.fb.nonNullable.group({
    placa: ['', [Validators.required, Validators.maxLength(12)]],
    marca: [''],
    modelo: [''],
    anio: ['', [Validators.min(ANIO_MIN), Validators.max(this.anioMax)]],
    color: [''],
    vin: ['', [Validators.pattern(/^[A-Za-z0-9]{17}$/)]],
    kilometraje: ['', [Validators.min(0)]],
  });

  constructor() {
    effect(() => {
      const v = this.vehiculo();
      this.form.reset({
        placa: v?.placa ?? '',
        marca: v?.marca ?? '',
        modelo: v?.modelo ?? '',
        anio: v?.anio?.toString() ?? '',
        color: v?.color ?? '',
        vin: v?.vin ?? '',
        kilometraje: v?.kilometraje?.toString() ?? '',
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
      const f = this.form.getRawValue();
      const datos = {
        placa: f.placa,
        marca: f.marca,
        modelo: f.modelo,
        anio: aNumero(f.anio),
        color: f.color,
        vin: f.vin,
        kilometraje: aNumero(f.kilometraje),
      };
      const actual = this.vehiculo();
      const fila = actual ? await this.svc.actualizar(actual.id, datos) : await this.svc.crear(this.clienteId(), datos);
      this.guardado.emit(fila);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar el vehículo');
    } finally {
      this.guardando.set(false);
    }
  }
}
