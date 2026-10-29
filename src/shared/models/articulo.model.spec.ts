import { efectoEnStock } from './articulo.model';

describe('efectoEnStock', () => {
  it('adds entries', () => expect(efectoEnStock({ tipo: 'entrada', cantidad: 5 })).toBe(5));
  it('subtracts exits', () => expect(efectoEnStock({ tipo: 'salida', cantidad: 2 })).toBe(-2));
  it('keeps the sign of adjustments', () => {
    expect(efectoEnStock({ tipo: 'ajuste', cantidad: -3 })).toBe(-3);
    expect(efectoEnStock({ tipo: 'ajuste', cantidad: 4 })).toBe(4);
  });
});
