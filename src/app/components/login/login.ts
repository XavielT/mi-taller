import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {

  // for submit btn
  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ){}

  // Manage the submit
  async onLoginSubmit(form: NgForm): Promise<void> {
    if (form.invalid) return;

    this.isLoading = true;
    this.errorMessage = null;

    try {
      await this.authService.login({
        email: form.value.email,
        password: form.value.password
      });

      this.router.navigate(['/home']);

    } catch (error: any) {
      this.errorMessage = error.message;
    } finally {
      this.isLoading = false;
    }
  }
}
