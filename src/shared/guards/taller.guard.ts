import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TallerStore } from '../stores/taller.store';

/** Loads the taller store when empty; users with no taller go to /onboarding (platform admins to /admin), suspended tallers to /suspendido. */
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
  const taller = store.tallerActivo();
  if (!taller) return router.createUrlTree([store.esAdminPlataforma() ? '/admin' : '/onboarding']);
  return taller.activo === false ? router.createUrlTree(['/suspendido']) : true;
};
