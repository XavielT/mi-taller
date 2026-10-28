import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';

/** OAuth (Google) landing page: waits for the session, then routes to /home (tallerGuard handles /onboarding). */
@Component({
  standalone: true,
  selector: 'app-auth-callback',
  template: `<p class="cb">Iniciando sesión...</p>`,
  styles: `
    .cb { min-height: 100vh; display: grid; place-items: center; margin: 0; font-family: var(--font-body); color: var(--text-muted); }
  `,
})
export class AuthCallback implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.auth.whenReady();
    await this.router.navigateByUrl(this.auth.isAuthenticated() ? '/home' : '/login', { replaceUrl: true });
  }
}
