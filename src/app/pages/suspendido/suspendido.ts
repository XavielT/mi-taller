import { Component, inject } from '@angular/core';
import { AuthService } from '../../../shared/services/auth.service';
import { MtButton, MtEmptyState } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-suspendido',
  imports: [MtButton, MtEmptyState],
  template: `
    <div class="mt-page">
      <div class="mt-card">
        <mt-empty-state
          title="Tu taller está suspendido"
          text="El acceso a este taller fue pausado por el administrador de la plataforma. Tus datos están guardados. Contacta a soporte para reactivarlo."
        >
          <mt-button variant="ghost" (click)="auth.signOut()">Cerrar sesión</mt-button>
        </mt-empty-state>
      </div>
    </div>
  `,
})
export class Suspendido {
  readonly auth = inject(AuthService);
}
