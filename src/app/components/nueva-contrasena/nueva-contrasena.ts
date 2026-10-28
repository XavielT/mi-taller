import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { MtButton, MtInput } from '../../../shared/ui';

function coinciden(group: AbstractControl): ValidationErrors | null {
  const { password, confirmar } = group.value as { password: string; confirmar: string };
  return password === confirmar ? null : { coinciden: true };
}

@Component({
  standalone: true,
  selector: 'app-nueva-contrasena',
  imports: [ReactiveFormsModule, RouterLink, MtInput, MtButton],
  templateUrl: './nueva-contrasena.html',
  styleUrls: ['./nueva-contrasena.scss'],
})
export class NuevaContrasena {
  private fb = inject(FormBuilder);
  protected auth = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmar: ['', [Validators.required]],
    },
    { validators: coinciden },
  );

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.hasError('coinciden')) this.error.set('Las contraseñas no coinciden');
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.auth.updatePassword(this.form.getRawValue().password);
      await this.router.navigate(['/home']);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Algo ha salido mal');
    } finally {
      this.isLoading.set(false);
    }
  }
}
