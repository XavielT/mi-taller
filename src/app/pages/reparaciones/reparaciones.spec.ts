import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OrdenResumen } from '../../../shared/models/orden.model';
import { OrdenesService } from '../../../shared/services/ordenes.service';
import { ToastService } from '../../../shared/ui';
import { COLUMNAS_TABLERO, Reparaciones, diasEnTaller } from './reparaciones';

const orden = (id: string, estado: OrdenResumen['estado']): OrdenResumen =>
  ({ id, numero: `OT-${id}`, estado, fecha_entrada: new Date().toISOString(), progreso: 0, total: 0 }) as OrdenResumen;

describe('diasEnTaller', () => {
  it('counts whole days', () => {
    const ahora = Date.parse('2026-10-28T12:00:00Z');
    expect(diasEnTaller('2026-10-25T12:00:00Z', ahora)).toBe(3);
    expect(diasEnTaller('2026-10-28T08:00:00Z', ahora)).toBe(0);
    expect(diasEnTaller('2026-11-01T00:00:00Z', ahora)).toBe(0);
  });
});

describe('Reparaciones board', () => {
  const cambiarEstado = vi.fn();
  let page: Reparaciones;
  let toast: ToastService;

  beforeEach(async () => {
    cambiarEstado.mockReset().mockResolvedValue({});
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: OrdenesService,
          useValue: { abiertas: () => Promise.resolve([orden('1', 'recepcion'), orden('2', 'en_progreso')]), mecanicos: () => Promise.resolve([]), cambiarEstado },
        },
      ],
    });
    toast = TestBed.inject(ToastService);
    const fixture = TestBed.createComponent(Reparaciones);
    page = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('groups open orders by column', () => {
    expect(COLUMNAS_TABLERO.length).toBe(5);
    expect(page.porColumna()['recepcion'].map((o) => o.id)).toEqual(['1']);
    expect(page.porColumna()['en_progreso'].map((o) => o.id)).toEqual(['2']);
  });

  it('moves a card on an allowed transition and calls the RPC', async () => {
    await page.mover(page.ordenes()[0], 'diagnostico');
    expect(cambiarEstado).toHaveBeenCalledWith('1', 'diagnostico');
    expect(page.ordenes().find((o) => o.id === '1')?.estado).toBe('diagnostico');
  });

  it('refuses an invalid drop with a toast and leaves the card where it was', async () => {
    await page.mover(page.ordenes()[0], 'listo');
    expect(cambiarEstado).not.toHaveBeenCalled();
    expect(page.ordenes().find((o) => o.id === '1')?.estado).toBe('recepcion');
    expect(toast.toasts()[0].message).toContain('No se puede pasar');
  });

  it('rolls the card back when the RPC fails', async () => {
    cambiarEstado.mockRejectedValue(new Error('boom'));
    await page.mover(page.ordenes()[0], 'diagnostico');
    expect(page.ordenes().find((o) => o.id === '1')?.estado).toBe('recepcion');
  });

  it('arrows are disabled when the neighbouring move is not allowed', () => {
    const o = page.ordenes()[0]; // recepcion → diagnostico is allowed, no column to the left
    expect(page.puedeMover(o, 1)).toBe(true);
    expect(page.puedeMover(o, -1)).toBe(false);
    const enProgreso = page.ordenes()[1];
    expect(page.puedeMover(enProgreso, 1)).toBe(true); // → esperando_repuestos
    expect(page.puedeMover(enProgreso, -1)).toBe(false); // → diagnostico is not allowed
  });
});
