import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';
import { MtButton, MtInput } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MtInput, MtButton],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
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

    try {
      await this.authService.signIn(this.form.getRawValue());
      await this.router.navigate(['/home']);
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
