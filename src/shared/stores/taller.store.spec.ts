import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';
import { CLAVE_TALLER_ACTIVO, TallerStore } from './taller.store';
import { Taller } from '../models/taller.model';

const taller = (id: string): Taller =>
  ({ id, nombre: `Taller ${id}`, contadores: { orden: 0, factura: 0 }, config: { itbis: 18, dias_vencimiento: 30, moneda: 'DOP' } }) as Taller;

/** Chainable query stub: every builder method returns itself and awaiting it yields an empty result. */
function consulta() {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) q[m] = () => q;
  q['maybeSingle'] = () => Promise.resolve({ data: null, error: null });
  q['then'] = (res: (v: unknown) => void) => res({ data: [], error: null });
  return q;
}

describe('TallerStore', () => {
  let store: TallerStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { ready: signal(true), isAuthenticated: signal(true), user: signal({ id: 'u1' }) } },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              rpc: () => Promise.resolve({ data: [taller('a'), taller('b')], error: null }),
              from: () => consulta(),
            },
          },
        },
      ],
    });
    store = TestBed.inject(TallerStore);
  });

  it('persists the selected taller in localStorage', async () => {
    await store.cargar();
    await store.seleccionar('b');
    expect(localStorage.getItem(CLAVE_TALLER_ACTIVO)).toBe('b');
    expect(store.tallerId()).toBe('b');
  });

  it('restores the persisted taller on the next load', async () => {
    localStorage.setItem(CLAVE_TALLER_ACTIVO, 'b');
    await store.cargar();
    expect(store.tallerId()).toBe('b');
  });

  it('falls back to the first taller when the saved one is gone', async () => {
    localStorage.setItem(CLAVE_TALLER_ACTIVO, 'zzz');
    await store.cargar();
    expect(store.tallerId()).toBe('a');
  });

  it('ignores an unknown taller id', async () => {
    await store.cargar();
    await store.seleccionar('nope');
    expect(store.tallerId()).toBe('a');
  });

  it('limpiar() clears the state and the saved selection', async () => {
    await store.cargar();
    store.limpiar();
    expect(store.tallerId()).toBeNull();
    expect(localStorage.getItem(CLAVE_TALLER_ACTIVO)).toBeNull();
  });

  it('requerirTallerId throws without an active taller', () => {
    expect(() => store.requerirTallerId()).toThrow('No hay un taller activo');
  });
});
