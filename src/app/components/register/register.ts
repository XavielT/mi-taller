import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { CLAVE_TALLER_PENDIENTE } from '../../../shared/storage-keys';
import { MtButton, MtInput } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [ReactiveFormsModule, MtInput, MtButton],
  templateUrl: './register.html',
  styleUrls: ['./register.scss'],
})
export class Register {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(4)]],
    company: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.success.set(false);

    const { name, company, email, password } = this.form.getRawValue();
    try {
      const { confirmarCorreo } = await this.authService.signUp({ email, password, nombre: name });
      if (confirmarCorreo) {
        // the taller name survives the trip to the inbox and back
        try {
          localStorage.setItem(CLAVE_TALLER_PENDIENTE, company);
        } catch {
          // storage unavailable: the user will just retype it in onboarding
        }
        this.success.set(true);
        return;
      }
      await this.router.navigate(['/onboarding'], { state: { tallerNombre: company } });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Algo ha salido mal');
    } finally {
      this.isLoading.set(false);
    }
  }

  async google(): Promise<void> {
    this.error.set(null);
    try {
      await this.authService.signInWithGoogle();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Algo ha salido mal');
    }
  }
}
