import { Component, computed, inject, output, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';

/** Up to two initials from the user's name, falling back to the first letter of the email. */
export function iniciales(name?: string | null, email?: string | null): string {
  const fromName = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
  return (fromName || (email ?? '?')[0]).toUpperCase();
}

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
})
export class Header {
  private auth = inject(AuthService);

  menuToggle = output<void>();
  menuAbierto = signal(false);

  readonly initials = computed(() => {
    return iniciales(this.auth.nombreUsuario(), this.auth.user()?.email);
  });

  logout(): void {
    this.menuAbierto.set(false);
    void this.auth.signOut();
  }
}
