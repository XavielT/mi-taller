import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TallerStore } from '../stores/taller.store';

/** Loads the taller store when empty; users with no taller are sent to /onboarding. */
export const tallerGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const store = inject(TallerStore);
  const router = inject(Router);

  await auth.whenReady();
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);

  if (!store.cargado()) {
    try {
      await store.cargar();
    } catch (e) {
      console.error(e);
    }
  }
  return store.tallerActivo() ? true : router.createUrlTree(['/onboarding']);
};
