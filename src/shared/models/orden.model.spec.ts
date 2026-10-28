import { TRANSICIONES, errorTransicion, transicionPermitida } from './orden.model';

describe('transiciones de orden', () => {
  it('allows the documented forward moves', () => {
    expect(transicionPermitida('recepcion', 'diagnostico')).toBe(true);
    expect(transicionPermitida('en_progreso', 'listo')).toBe(true);
    expect(transicionPermitida('listo', 'entregado')).toBe(true);
    expect(transicionPermitida('listo', 'en_progreso')).toBe(true);
  });

  it('refuses jumps and moves out of final states', () => {
    expect(transicionPermitida('recepcion', 'listo')).toBe(false);
    expect(transicionPermitida('diagnostico', 'listo')).toBe(false);
    expect(TRANSICIONES.entregado).toEqual([]);
    expect(TRANSICIONES.cancelado).toEqual([]);
  });

  it('only cancels from non-final, non-ready states', () => {
    expect(transicionPermitida('listo', 'cancelado')).toBe(false);
    expect(transicionPermitida('esperando_repuestos', 'cancelado')).toBe(true);
  });

  it('explains a refused move in Spanish', () => {
    expect(errorTransicion('recepcion', 'listo')).toBe('No se puede pasar una orden de "Recepción" a "Listo"');
  });
});
