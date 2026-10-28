import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Rol } from '../models/taller.model';
import { TallerStore } from '../stores/taller.store';

/** Factory for admin-only routes: `canActivate: [rolGuard(['propietario', 'administrador'])]`. */
export function rolGuard(roles: Rol[]): CanActivateFn {
  return async () => {
    const store = inject(TallerStore);
    const router = inject(Router);
    if (!store.cargado()) await store.cargar();
    const rol = store.rol();
    return rol && roles.includes(rol) ? true : router.createUrlTree(['/home']);
  };
}
