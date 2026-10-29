import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Taller } from '../models/taller.model';
import { AuthService } from '../services/auth.service';
import { TallerStore } from '../stores/taller.store';
import { adminGuard } from './admin.guard';
import { tallerGuard } from './taller.guard';

/** Minimal TallerStore double: the guards only read these signals and call `cargar()`. */
function tiendaFalsa(opts: { admin: boolean; taller?: Partial<Taller> | null; cargado?: boolean }) {
  const cargado = signal(opts.cargado ?? false);
  let cargas = 0;
  return {
    cargas: () => cargas,
    store: {
      cargado,
      esAdminPlataforma: signal(opts.admin),
      tallerActivo: signal((opts.taller ?? null) as Taller | null),
      cargar: () => {
        cargas++;
        cargado.set(true);
        return Promise.resolve();
      },
    },
  };
}

async function url(guard: typeof adminGuard, auth: boolean, tienda: ReturnType<typeof tiendaFalsa>): Promise<string | true> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isAuthenticated: signal(auth), whenReady: () => Promise.resolve() } },
      { provide: TallerStore, useValue: tienda.store },
    ],
  });
  const r = await TestBed.runInInjectionContext(() => guard({} as never, {} as never));
  return r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : (r as true);
}

describe('adminGuard', () => {
  it('lets platform admins in', async () => {
    expect(await url(adminGuard, true, tiendaFalsa({ admin: true }))).toBe(true);
  });

  it('sends regular users back to /home', async () => {
    expect(await url(adminGuard, true, tiendaFalsa({ admin: false }))).toBe('/home');
  });

  it('sends visitors without a session to /login', async () => {
    expect(await url(adminGuard, false, tiendaFalsa({ admin: true }))).toBe('/login');
  });

  it('loads the store once when it is empty', async () => {
    const t = tiendaFalsa({ admin: true });
    await url(adminGuard, true, t);
    expect(t.cargas()).toBe(1);
  });
});

describe('tallerGuard with platform admins and suspended tallers', () => {
  it('sends a platform admin without a taller to /admin', async () => {
    expect(await url(tallerGuard, true, tiendaFalsa({ admin: true, taller: null }))).toBe('/admin');
  });

  it('sends a regular user without a taller to /onboarding', async () => {
    expect(await url(tallerGuard, true, tiendaFalsa({ admin: false, taller: null }))).toBe('/onboarding');
  });

  it('sends members of a suspended taller to /suspendido', async () => {
    expect(await url(tallerGuard, true, tiendaFalsa({ admin: false, taller: { id: 'a', activo: false } }))).toBe('/suspendido');
  });

  it('lets members of an active taller in', async () => {
    expect(await url(tallerGuard, true, tiendaFalsa({ admin: false, taller: { id: 'a', activo: true } }))).toBe(true);
  });
});
