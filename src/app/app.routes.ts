import { Routes } from '@angular/router';
import { adminGuard } from '../shared/guards/admin.guard';
import { authGuard } from '../shared/guards/auth.guard';
import { guestGuard } from '../shared/guards/guest.guard';
import { tallerGuard } from '../shared/guards/taller.guard';

export const routes: Routes = [
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth-callback/auth-callback').then((m) => m.AuthCallback),
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./pages/onboarding/onboarding').then((m) => m.Onboarding),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
    canActivate: [authGuard, adminGuard],
  },
  { path: 'unirse/:token', loadComponent: () => import('./pages/unirse/unirse').then((m) => m.Unirse) },
  {
    path: 'suspendido',
    loadComponent: () => import('./pages/suspendido/suspendido').then((m) => m.Suspendido),
    canActivate: [authGuard],
  },
  {
    path: '',
    loadComponent: () => import('./pages/auth/auth').then((m) => m.Auth),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        loadComponent: () => import('./components/login/login').then((m) => m.Login),
        canActivate: [guestGuard],
      },
      {
        path: 'register',
        loadComponent: () => import('./components/register/register').then((m) => m.Register),
        canActivate: [guestGuard],
      },
      {
        path: 'auth/recuperar',
        loadComponent: () => import('./components/recuperar/recuperar').then((m) => m.Recuperar),
      },
      {
        path: 'auth/nueva-contrasena',
        loadComponent: () => import('./components/nueva-contrasena/nueva-contrasena').then((m) => m.NuevaContrasena),
      },
    ],
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    canActivate: [authGuard, tallerGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'recepcion', loadComponent: () => import('./pages/recepcion/recepcion').then((m) => m.Recepcion) },
      { path: 'recepcion/clientes', loadComponent: () => import('./pages/clientes/clientes').then((m) => m.Clientes) },
      {
        path: 'recepcion/clientes/:id',
        loadComponent: () => import('./pages/cliente-detalle/cliente-detalle').then((m) => m.ClienteDetalle),
      },
      { path: 'ordenes/:id', loadComponent: () => import('./pages/orden-detalle/orden-detalle').then((m) => m.OrdenDetalle) },
      { path: 'reparaciones', loadComponent: () => import('./pages/reparaciones/reparaciones').then((m) => m.Reparaciones) },
      { path: 'finanzas', loadComponent: () => import('./pages/finanzas/finanzas').then((m) => m.Finanzas) },
      {
        path: 'finanzas/facturas/nueva',
        loadComponent: () => import('./pages/factura-nueva/factura-nueva').then((m) => m.FacturaNueva),
      },
      {
        path: 'finanzas/facturas/:id',
        loadComponent: () => import('./pages/factura-detalle/factura-detalle').then((m) => m.FacturaDetalle),
      },
      { path: 'inventario', loadComponent: () => import('./pages/inventario/inventario').then((m) => m.Inventario) },
      { path: 'sucursales', loadComponent: () => import('./pages/sucursales/sucursales').then((m) => m.Sucursales) },
      { path: 'equipo', loadComponent: () => import('./pages/equipo/equipo').then((m) => m.Equipo) },
      { path: 'configuracion', loadComponent: () => import('./pages/configuracion/configuracion').then((m) => m.Configuracion) },
    ],
  },
  { path: '**', loadComponent: () => import('./pages/no-encontrado/no-encontrado').then((m) => m.NoEncontrado) },
];
