import { Fila607, csv607, fechaDgii, rangoDelMes } from './reportes.service';
import { errorLogo } from './talleres.service';

const fila = (extra: Partial<Fila607> = {}): Fila607 => ({
  numero: 'FAC-000001',
  rnc_cedula: '131234567',
  tipo_id: 1,
  cliente: 'Cliente, S.R.L.',
  ncf: 'B0100000001',
  tipo_ingreso: '01',
  fecha_comprobante: '2026-10-29',
  monto_facturado: 1000,
  itbis_facturado: 180,
  efectivo: 500,
  transferencia: 0,
  tarjeta: 0,
  otro: 0,
  credito: 680,
  ...extra,
});

describe('reporte 607', () => {
  it('formats dates the DGII way', () => expect(fechaDgii('2026-10-29')).toBe('20261029'));

  it('computes the month range, including leap years', () => {
    expect(rangoDelMes('2026-10')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoDelMes('2028-02')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(rangoDelMes('2026-04').hasta).toBe('2026-04-30');
  });

  it('includes only fiscal receipts and counts the rest as omitted', () => {
    const r = csv607([fila(), fila({ numero: 'FAC-000002', ncf: null })]);
    expect(r.incluidas).toBe(1);
    expect(r.omitidas).toBe(1);
    const lineas = r.csv.split('\r\n');
    expect(lineas).toHaveLength(2);
    expect(lineas[1]).toContain('B0100000001');
    expect(lineas[1]).toContain('20261029');
    expect(lineas[1]).toContain('"Cliente, S.R.L."');
  });

  it('returns only the header when there is nothing fiscal', () => {
    const r = csv607([fila({ ncf: null })]);
    expect(r.incluidas).toBe(0);
    expect(r.csv.split('\r\n')).toHaveLength(1);
  });
});

describe('errorLogo', () => {
  it('accepts a small PNG', () => expect(errorLogo({ type: 'image/png', size: 5000 })).toBeNull());
  it('rejects other formats', () => expect(errorLogo({ type: 'image/svg+xml', size: 100 })).toContain('PNG, JPG o WebP'));
  it('rejects files over 1 MB', () => expect(errorLogo({ type: 'image/jpeg', size: 2 * 1024 * 1024 })).toContain('1 MB'));
});
