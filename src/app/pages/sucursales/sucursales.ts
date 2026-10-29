import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Sucursal } from '../../../shared/models/taller.model';
import { SucursalesService } from '../../../shared/services/sucursales.service';
import { TallerStore } from '../../../shared/stores/taller.store';
import { MtButton, MtCell, MtEmptyState, MtInput, MtModal, MtPageHeader, MtTable, ToastService } from '../../../shared/ui';
import type { MtColumn } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-sucursales',
  imports: [ReactiveFormsModule, MtButton, MtCell, MtEmptyState, MtInput, MtModal, MtPageHeader, MtTable],
  templateUrl: './sucursales.html',
  styleUrls: ['./sucursales.scss'],
})
export class Sucursales {
  private svc = inject(SucursalesService);
  private store = inject(TallerStore);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  readonly columnas: MtColumn[] = [
    { key: 'nombre', label: 'Sucursal' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'estado', label: 'Estado' },
    { key: 'acciones', label: '', align: 'right' },
  ];

  filas = signal<Sucursal[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  modalAbierto = signal(false);
  editando = signal<Sucursal | null>(null);
  guardando = signal(false);
  errorForm = signal<string | null>(null);

  readonly esAdmin = computed(() => ['propietario', 'administrador'].includes(this.store.rol() ?? ''));
  readonly limite = computed(() => this.store.limites()?.sucursales ?? null);
  readonly activas = computed(() => this.filas().filter((s) => s.activa).length);
  readonly llegoAlLimite = computed(() => this.limite() !== null && this.activas() >= (this.limite() as number));

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    direccion: [''],
    telefono: [''],
  });

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.filas.set(await this.svc.listar());
      this.error.set(null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudieron cargar las sucursales');
    } finally {
      this.cargando.set(false);
    }
  }

  nueva(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '', direccion: '', telefono: '' });
    this.errorForm.set(null);
    this.modalAbierto.set(true);
  }

  editar(s: Sucursal): void {
    this.editando.set(s);
    this.form.reset({ nombre: s.nombre, direccion: s.direccion ?? '', telefono: s.telefono ?? '' });
    this.errorForm.set(null);
    this.modalAbierto.set(true);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      const v = this.form.getRawValue();
      const actual = this.editando();
      if (actual) await this.svc.actualizar(actual.id, v);
      else await this.svc.crear(v);
      this.toast.success(actual ? 'Sucursal actualizada' : 'Sucursal creada');
      this.modalAbierto.set(false);
      await this.refrescar();
    } catch (e) {
      this.errorForm.set(e instanceof Error ? e.message : 'No se pudo guardar la sucursal');
    } finally {
      this.guardando.set(false);
    }
  }

  async hacerPrincipal(s: Sucursal): Promise<void> {
    await this.accion(() => this.svc.definirPrincipal(s.id), `"${s.nombre}" ahora es la principal`);
  }

  async alternar(s: Sucursal): Promise<void> {
    await this.accion(() => this.svc.activar(s.id, !s.activa), s.activa ? `"${s.nombre}" desactivada` : `"${s.nombre}" activada`);
  }

  private async accion(fn: () => Promise<void>, mensaje: string): Promise<void> {
    try {
      await fn();
      this.toast.success(mensaje);
      await this.refrescar();
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo completar la acción');
    }
  }

  /** Recarga la tabla y el store: el encabezado y el selector de sucursales leen de ahí. */
  private async refrescar(): Promise<void> {
    await Promise.all([this.cargar(), this.store.refrescar()]);
  }
}
