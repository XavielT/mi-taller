import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { MtButton, MtInput } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-recuperar',
  imports: [ReactiveFormsModule, RouterLink, MtInput, MtButton],
  templateUrl: './recuperar.html',
  styleUrls: ['./recuperar.scss'],
})
export class Recuperar {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  isLoading = signal(false);
  error = signal<string | null>(null);
  enviado = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.auth.resetPassword(this.form.getRawValue().email);
      // same message whether or not the address exists
      this.enviado.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Algo ha salido mal');
    } finally {
      this.isLoading.set(false);
    }
  }
}
