import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TallerStore } from '../../stores/taller.store';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const ITEMS_BASE: NavItem[] = [
  { path: '/home/dashboard', label: 'Tablero', icon: 'assets/icons/dashboard-icon.svg' },
  { path: '/home/recepcion', label: 'Recepción', icon: 'assets/icons/recepcion-icon.svg' },
  { path: '/home/reparaciones', label: 'Reparaciones', icon: 'assets/icons/reparaciones-icon.svg' },
  { path: '/home/finanzas', label: 'Finanzas', icon: 'assets/icons/finanzas-icon.svg' },
  { path: '/home/inventario', label: 'Inventario', icon: 'assets/icons/inventario-icon.svg' },
  { path: '/home/sucursales', label: 'Sucursales', icon: 'assets/icons/sucursales-icon.svg' },
  { path: '/home/equipo', label: 'Equipo', icon: 'assets/icons/equipo-icon.svg' },
];

const ITEM_CONFIGURACION: NavItem = { path: '/home/configuracion', label: 'Configuración', icon: 'assets/icons/configuracion-icon.svg' };
const ITEM_ADMIN: NavItem = { path: '/admin', label: 'Administración', icon: 'assets/icons/admin-icon.svg' };
const LOGO_POR_DEFECTO = '/assets/imgs/auth/mi-taller-logo.png';

@Component({
  standalone: true,
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss'],
})
export class Navbar {
  // Phase 2 wires these to the taller store
  tallerNombre = input('Mi Taller');
  sucursalNombre = input('Sucursal Principal');
  open = input(false);
  closed = output<void>();

  readonly store = inject(TallerStore);
  private auth = inject(AuthService);

  /** Configuración solo para propietario y administrador; Administración solo para el dueño de la plataforma. */
  readonly items = computed<NavItem[]>(() => {
    const items = [...ITEMS_BASE];
    if (['propietario', 'administrador'].includes(this.store.rol() ?? '')) items.push(ITEM_CONFIGURACION);
    if (this.store.esAdminPlataforma()) items.push(ITEM_ADMIN);
    return items;
  });

  readonly logo = computed(() => this.store.tallerActivo()?.logo_url || LOGO_POR_DEFECTO);

  logout(): void {
    void this.auth.signOut();
  }
}
