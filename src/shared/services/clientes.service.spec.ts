import { limpiarBusqueda } from './clientes.service';

describe('limpiarBusqueda', () => {
  it('strips characters that would break a PostgREST or() filter', () => {
    expect(limpiarBusqueda('juan,telefono.eq.1)')).toBe('juan telefono.eq.1');
    expect(limpiarBusqueda('50%_off')).toBe('50 off');
  });

  it('collapses whitespace and trims', () => {
    expect(limpiarBusqueda('  maria   perez ')).toBe('maria perez');
  });
});
