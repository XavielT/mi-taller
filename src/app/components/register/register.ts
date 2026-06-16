import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrls: ['./register.scss'],
})
export class Register {

  // to manage the btn
  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onRegisterSubmit(form: NgForm): Promise<void> {
    
    if (form.invalid) return;

    this.isLoading = true;
    this.errorMessage = null;

    try {
      await this.authService.register({
        name: form.value.name,
        company: form.value.company,
        email: form.value.email,
        password: form.value.password
      });

      this.errorMessage = 'success';

      setTimeout(() => {
        this.router.navigate(['/home']);
      }, 3000)

    } catch (error: any) {
      this.errorMessage = error.message;
    } finally {
      this.isLoading = false;
    }
  }
}
