import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { TalleresService } from '../../../shared/services/talleres.service';
import { CLAVE_TALLER_PENDIENTE } from '../../../shared/storage-keys';
import { TallerStore } from '../../../shared/stores/taller.store';
import { MtButton, MtInput } from '../../../shared/ui';

/** Taller name carried from the register form: router state first, then the email-confirmation fallback. */
function nombreInicial(): string {
  const desdeRouter = (history.state as { tallerNombre?: string } | null)?.tallerNombre;
  if (desdeRouter) return desdeRouter;
  try {
    return localStorage.getItem(CLAVE_TALLER_PENDIENTE) ?? '';
  } catch {
    return '';
  }
}

@Component({
  standalone: true,
  selector: 'app-onboarding',
  imports: [ReactiveFormsModule, MtInput, MtButton],
  templateUrl: './onboarding.html',
  styleUrls: ['./onboarding.scss'],
})
export class Onboarding {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private talleres = inject(TalleresService);
  private store = inject(TallerStore);
  private router = inject(Router);

  isLoading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    nombre: [nombreInicial(), [Validators.required, Validators.minLength(2)]],
    rnc: ['', [Validators.pattern(/^(\d{9}|\d{11})$/)]],
    telefono: [''],
    direccion: [''],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const datos = this.form.getRawValue();
      const taller = await this.talleres.crearTaller({ ...datos, nombreUsuario: this.auth.nombreUsuario() });
      await this.store.cargar(taller.id);
      try {
        localStorage.removeItem(CLAVE_TALLER_PENDIENTE);
      } catch {
        // nothing to clean
      }
      await this.router.navigate(['/home']);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Algo ha salido mal');
    } finally {
      this.isLoading.set(false);
    }
  }

  cerrarSesion(): void {
    void this.auth.signOut();
  }
}
