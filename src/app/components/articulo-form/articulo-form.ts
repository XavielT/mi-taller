import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Articulo } from '../../../shared/models/articulo.model';
import { ArticulosService } from '../../../shared/services/articulos.service';
import { MtButton, MtInput } from '../../../shared/ui';

/** Crea o edita un artículo. El stock inicial solo se pide al crear; después se mueve con entradas y ajustes. */
@Component({
  standalone: true,
  selector: 'app-articulo-form',
  imports: [ReactiveFormsModule, MtInput, MtButton],
  template: `
    <form class="mt-stack" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <div class="mt-grid-2">
        <mt-input label="Nombre *" placeholder="Ej: Filtro de aceite" formControlName="nombre" />
        <mt-input label="Código" placeholder="SKU o código de barras" formControlName="codigo" />
      </div>
      <mt-input label="Descripción" [rows]="2" formControlName="descripcion" />
      <div class="mt-grid-2">
        <mt-input label="Precio de venta" type="number" formControlName="precio_venta" />
        <mt-input label="Costo" type="number" formControlName="costo" />
      </div>
      <div class="mt-grid-2">
        <mt-input label="Stock mínimo" type="number" hint="Avisa cuando el stock llegue a esta cantidad" formControlName="stock_minimo" />
        @if (!articulo()) {
          <mt-input label="Stock inicial" type="number" formControlName="stock_inicial" />
        }
      </div>

      @if (error(); as msg) {
        <div class="mt-error" role="alert">{{ msg }}</div>
      }

      <div class="mt-actions">
        <mt-button variant="ghost" (click)="cancelado.emit()">Cancelar</mt-button>
        <mt-button type="submit" [loading]="guardando()">{{ articulo() ? 'Guardar cambios' : 'Crear artículo' }}</mt-button>
      </div>
    </form>
  `,
})
export class ArticuloForm {
  private fb = inject(FormBuilder);
  private svc = inject(ArticulosService);

  articulo = input<Articulo | null>(null);
  guardado = output<Articulo>();
  cancelado = output<void>();

  guardando = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    codigo: [''],
    descripcion: [''],
    precio_venta: ['0', [Validators.required, Validators.min(0)]],
    costo: ['0', [Validators.required, Validators.min(0)]],
    stock_minimo: ['0', [Validators.required, Validators.min(0)]],
    stock_inicial: ['0', [Validators.min(0)]],
  });

  constructor() {
    effect(() => {
      const a = this.articulo();
      this.form.reset({
        nombre: a?.nombre ?? '',
        codigo: a?.codigo ?? '',
        descripcion: a?.descripcion ?? '',
        precio_venta: String(a?.precio_venta ?? 0),
        costo: String(a?.costo ?? 0),
        stock_minimo: String(a?.stock_minimo ?? 0),
        stock_inicial: '0',
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
      const datos = {
        nombre: v.nombre.trim(),
        codigo: v.codigo.trim(),
        descripcion: v.descripcion.trim(),
        precio_venta: Number(v.precio_venta) || 0,
        costo: Number(v.costo) || 0,
        stock_minimo: Number(v.stock_minimo) || 0,
      };
      const actual = this.articulo();
      const fila = actual
        ? await this.svc.actualizar(actual.id, datos)
        : await this.svc.crear({ ...datos, stock_inicial: Number(v.stock_inicial) || 0 });
      this.guardado.emit(fila);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar el artículo');
    } finally {
      this.guardando.set(false);
    }
  }
}
