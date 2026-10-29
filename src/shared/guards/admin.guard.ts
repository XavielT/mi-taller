import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TallerStore } from '../stores/taller.store';

/** Solo administradores de la plataforma; el resto vuelve a /home. La base de datos valida el permiso otra vez en cada RPC. */
export const adminGuard: CanActivateFn = async () => {
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
  return store.esAdminPlataforma() ? true : router.createUrlTree(['/home']);
};
