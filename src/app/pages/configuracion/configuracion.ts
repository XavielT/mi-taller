import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TalleresService, errorLogo } from '../../../shared/services/talleres.service';
import { TallerStore } from '../../../shared/stores/taller.store';
import { MtButton, MtInput, MtPageHeader, ToastService } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-configuracion',
  imports: [ReactiveFormsModule, MtButton, MtInput, MtPageHeader],
  templateUrl: './configuracion.html',
  styleUrls: ['./configuracion.scss'],
})
export class Configuracion {
  private fb = inject(FormBuilder);
  private svc = inject(TalleresService);
  private store = inject(TallerStore);
  private toast = inject(ToastService);

  readonly taller = this.store.tallerActivo;
  readonly esAdmin = computed(() => ['propietario', 'administrador'].includes(this.store.rol() ?? ''));

  guardando = signal(false);
  subiendoLogo = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    rnc: ['', [Validators.pattern(/^(\d{9}|\d{11})$/)]],
    telefono: [''],
    email: ['', [Validators.email]],
    direccion: [''],
    itbis: ['18', [Validators.required, Validators.min(0), Validators.max(100)]],
    dias_vencimiento: ['30', [Validators.required, Validators.min(0), Validators.max(365)]],
  });

  constructor() {
    effect(() => {
      const t = this.taller();
      if (!t) return;
      this.form.reset({
        nombre: t.nombre,
        rnc: t.rnc ?? '',
        telefono: t.telefono ?? '',
        email: t.email ?? '',
        direccion: t.direccion ?? '',
        itbis: String(t.config?.itbis ?? 18),
        dias_vencimiento: String(t.config?.dias_vencimiento ?? 30),
      });
    });
  }

  async guardar(): Promise<void> {
    const t = this.taller();
    if (!t) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      await this.svc.actualizar(t.id, {
        nombre: v.nombre.trim(),
        rnc: v.rnc.trim(),
        telefono: v.telefono.trim(),
        email: v.email.trim(),
        direccion: v.direccion.trim(),
        itbis: Number(v.itbis),
        dias_vencimiento: Math.round(Number(v.dias_vencimiento)),
      });
      await this.store.cargar(t.id);
      this.toast.success('Configuración guardada');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar la configuración');
    } finally {
      this.guardando.set(false);
    }
  }

  async elegirLogo(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    const t = this.taller();
    if (!archivo || !t) return;
    const problema = errorLogo(archivo);
    if (problema) {
      this.toast.error(problema);
      return;
    }
    this.subiendoLogo.set(true);
    try {
      await this.svc.subirLogo(t.id, archivo, t.logo_url);
      await this.store.cargar(t.id);
      this.toast.success('Logo actualizado');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo subir el logo');
    } finally {
      this.subiendoLogo.set(false);
    }
  }

  async quitarLogo(): Promise<void> {
    const t = this.taller();
    if (!t?.logo_url) return;
    this.subiendoLogo.set(true);
    try {
      await this.svc.quitarLogo(t.id, t.logo_url);
      await this.store.cargar(t.id);
      this.toast.success('Logo eliminado');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo quitar el logo');
    } finally {
      this.subiendoLogo.set(false);
    }
  }
}
