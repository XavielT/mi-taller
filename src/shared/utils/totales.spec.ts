import { calcularTotales, importeItem } from './totales';

describe('importeItem', () => {
  it('multiplies and rounds to cents', () => {
    expect(importeItem({ cantidad: 2, precio_unitario: 650 })).toBe(1300);
    expect(importeItem({ cantidad: 1.5, precio_unitario: 99.99 })).toBe(149.99); // 149.985 → half up
    expect(importeItem({ cantidad: 3, precio_unitario: 0.1 })).toBe(0.3);
  });
});

describe('calcularTotales', () => {
  it('applies ITBIS only to flagged items', () => {
    const r = calcularTotales([
      { cantidad: 1, precio_unitario: 2500, aplica_itbis: true },
      { cantidad: 1, precio_unitario: 300, aplica_itbis: false },
    ]);
    expect(r).toEqual({ subtotal: 2800, itbis: 450, total: 3250 }); // matches seed FAC-000001
  });

  it('matches the seed invoice FAC-000002', () => {
    const r = calcularTotales([
      { cantidad: 1, precio_unitario: 800, aplica_itbis: true },
      { cantidad: 1, precio_unitario: 450, aplica_itbis: true },
      { cantidad: 4, precio_unitario: 700, aplica_itbis: true },
    ]);
    expect(r).toEqual({ subtotal: 4050, itbis: 729, total: 4779 });
  });

  it('honors a custom rate and returns zeros for no items', () => {
    expect(calcularTotales([{ cantidad: 1, precio_unitario: 100, aplica_itbis: true }], 16).itbis).toBe(16);
    expect(calcularTotales([])).toEqual({ subtotal: 0, itbis: 0, total: 0 });
  });

  it('rounds ITBIS half up like the DB', () => {
    // 0.25 * 18 % = 0.045 → 0.05
    expect(calcularTotales([{ cantidad: 1, precio_unitario: 0.25, aplica_itbis: true }]).itbis).toBe(0.05);
  });
});
