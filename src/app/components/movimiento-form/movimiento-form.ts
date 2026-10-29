import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ArticuloStock, ETIQUETA_MOVIMIENTO, MovimientoInventario, TipoMovimiento, efectoEnStock } from '../../../shared/models/articulo.model';
import { ArticulosService } from '../../../shared/services/articulos.service';
import { MtButton, MtInput } from '../../../shared/ui';

/** Registra entradas, salidas y ajustes de un artículo y muestra su historial reciente. */
@Component({
  standalone: true,
  selector: 'app-movimiento-form',
  imports: [ReactiveFormsModule, DatePipe, MtInput, MtButton],
  template: `
    @if (articulo(); as a) {
      <p class="resumen">
        <strong>{{ a.nombre }}</strong> · Stock actual: <strong>{{ a.stock }}</strong>
      </p>

      <form class="mt-stack" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <div class="mt-grid-2">
          <div class="campo">
            <label for="tipo-mov">Tipo</label>
            <select id="tipo-mov" formControlName="tipo">
              <option value="entrada">Entrada (compra, devolución)</option>
              <option value="salida">Salida (uso fuera de una orden)</option>
              <option value="ajuste">Ajuste (+ o −, por conteo)</option>
            </select>
          </div>
          <mt-input
            label="Cantidad"
            type="number"
            [hint]="form.controls.tipo.value === 'ajuste' ? 'Usa negativo para restar' : ''"
            formControlName="cantidad"
          />
        </div>
        <mt-input label="Nota" placeholder="Ej: Compra a proveedor, conteo del mes" formControlName="nota" />

        @if (error(); as msg) {
          <div class="mt-error" role="alert">{{ msg }}</div>
        }
        <div class="mt-actions">
          <mt-button variant="ghost" (click)="cerrado.emit()">Cerrar</mt-button>
          <mt-button type="submit" [loading]="guardando()">Registrar</mt-button>
        </div>
      </form>

      <h3 class="titulo">Últimos movimientos</h3>
      @if (movimientos().length === 0) {
        <p class="mt-muted">Sin movimientos todavía.</p>
      } @else {
        <ul class="lista">
          @for (m of movimientos(); track m.id) {
            <li>
              <span class="fecha">{{ m.created_at | date: 'dd/MM/yyyy HH:mm' }}</span>
              <span>{{ etiqueta[m.tipo] }}{{ m.nota ? ' · ' + m.nota : '' }}</span>
              <strong [class.neg]="efecto(m) < 0">{{ efecto(m) > 0 ? '+' : '' }}{{ efecto(m) }}</strong>
            </li>
          }
        </ul>
      }
    }
  `,
  styles: `
    .resumen { margin: 0 0 1rem; }
    .titulo { margin: 1.25rem 0 .5rem; font-family: var(--font-titles); font-size: 1rem; }
    .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .4rem; max-height: 14rem; overflow: auto; }
    .lista li { display: grid; grid-template-columns: 9rem 1fr auto; gap: .75rem; font-size: .9rem; }
    .fecha { color: var(--text-muted); }
    .neg { color: var(--alert); }
    select { width: 100%; padding: .65rem; border: 1px solid var(--borders); border-radius: var(--radius); background: var(--input-bg); font: inherit; }
    label { display: block; margin-bottom: .25rem; font-size: .9rem; }
  `,
})
export class MovimientoForm {
  private fb = inject(FormBuilder);
  private svc = inject(ArticulosService);

  articulo = input<ArticuloStock | null>(null);
  /** Se emite después de registrar un movimiento para que la lista recargue el stock. */
  registrado = output<void>();
  cerrado = output<void>();

  readonly etiqueta = ETIQUETA_MOVIMIENTO;
  readonly efecto = efectoEnStock;

  guardando = signal(false);
  error = signal<string | null>(null);
  movimientos = signal<MovimientoInventario[]>([]);

  form = this.fb.nonNullable.group({
    tipo: ['entrada' as TipoMovimiento, [Validators.required]],
    cantidad: ['', [Validators.required]],
    nota: [''],
  });

  constructor() {
    effect(() => {
      const a = this.articulo();
      this.form.reset({ tipo: 'entrada', cantidad: '', nota: '' });
      this.error.set(null);
      if (a) void this.cargarHistorial(a.id);
    });
  }

  private async cargarHistorial(id: string): Promise<void> {
    try {
      this.movimientos.set(await this.svc.movimientos(id));
    } catch {
      this.movimientos.set([]);
    }
  }

  async guardar(): Promise<void> {
    const a = this.articulo();
    if (!a) return;
    const v = this.form.getRawValue();
    const cantidad = Number(v.cantidad);
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      this.error.set('Escribe una cantidad distinta de cero');
      return;
    }
    if (v.tipo !== 'ajuste' && cantidad < 0) {
      this.error.set('La cantidad debe ser mayor que cero. Para restar usa un ajuste negativo o una salida.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      await this.svc.registrarMovimiento(a.id, v.tipo, cantidad, v.nota.trim());
      this.form.reset({ tipo: v.tipo, cantidad: '', nota: '' });
      await this.cargarHistorial(a.id);
      this.registrado.emit();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo registrar el movimiento');
    } finally {
      this.guardando.set(false);
    }
  }
}
