import { hoyISO, inicioMesISO, sumarDiasISO } from './fechas';

describe('fechas', () => {
  const base = new Date(2026, 9, 28, 23, 30); // 28 Oct 2026, late evening local time

  it('formats today in local time', () => {
    expect(hoyISO(base)).toBe('2026-10-28');
  });

  it('returns the first day of the month', () => {
    expect(inicioMesISO(base)).toBe('2026-10-01');
  });

  it('adds days across month boundaries', () => {
    expect(sumarDiasISO(30, base)).toBe('2026-11-27');
    expect(sumarDiasISO(5, new Date(2026, 11, 29))).toBe('2027-01-03');
  });
});
