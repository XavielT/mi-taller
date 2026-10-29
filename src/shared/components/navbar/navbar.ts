import { Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TallerStore } from '../../stores/taller.store';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

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

  readonly items: NavItem[] = [
    { path: '/home/dashboard', label: 'Tablero', icon: 'assets/icons/dashboard-icon.svg' },
    { path: '/home/recepcion', label: 'Recepción', icon: 'assets/icons/recepcion-icon.svg' },
    { path: '/home/reparaciones', label: 'Reparaciones', icon: 'assets/icons/reparaciones-icon.svg' },
    { path: '/home/finanzas', label: 'Finanzas', icon: 'assets/icons/finanzas-icon.svg' },
    { path: '/home/inventario', label: 'Inventario', icon: 'assets/icons/inventario-icon.svg' },
    { path: '/home/sucursales', label: 'Sucursales', icon: 'assets/icons/sucursales-icon.svg' },
  ];

  readonly store = inject(TallerStore);

  constructor(private auth: AuthService) {}

  logout(): void {
    void this.auth.signOut();
  }
}
