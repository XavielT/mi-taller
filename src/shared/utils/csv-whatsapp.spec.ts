import { aCsv, campoCsv } from './csv';
import { compartirWhatsApp, enlaceWhatsApp, telefonoWhatsApp } from './whatsapp';

describe('campoCsv / aCsv', () => {
  it('leaves plain values untouched and empties null', () => {
    expect(campoCsv('Juan')).toBe('Juan');
    expect(campoCsv(12.5)).toBe('12.5');
    expect(campoCsv(null)).toBe('');
    expect(campoCsv(undefined)).toBe('');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(campoCsv('Pérez, Juan')).toBe('"Pérez, Juan"');
    expect(campoCsv('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(campoCsv('a\nb')).toBe('"a\nb"');
  });

  it('neutralizes spreadsheet formulas in text but keeps negative numbers', () => {
    expect(campoCsv('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(campoCsv('@cmd')).toBe("'@cmd");
    expect(campoCsv(-5)).toBe('-5');
    expect(campoCsv('-5')).toBe('-5');
  });

  it('joins rows with CRLF and a header row', () => {
    expect(aCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"');
  });
});

describe('whatsapp helpers', () => {
  it('normalizes Dominican numbers', () => {
    expect(telefonoWhatsApp('809-555-0001')).toBe('18095550001');
    expect(telefonoWhatsApp('(829) 555 0002')).toBe('18295550002');
    expect(telefonoWhatsApp('+1 849 555 0003')).toBe('18495550003');
  });

  it('rejects numbers that cannot be valid', () => {
    expect(telefonoWhatsApp('555-01')).toBeNull();
    expect(telefonoWhatsApp('')).toBeNull();
    expect(telefonoWhatsApp(null)).toBeNull();
    expect(telefonoWhatsApp('44 20 7946 0958')).toBeNull();
  });

  it('builds wa.me links with the message encoded', () => {
    expect(enlaceWhatsApp('8095550001', 'Hola & gracias')).toBe('https://wa.me/18095550001?text=Hola%20%26%20gracias');
    expect(enlaceWhatsApp('abc', 'x')).toBeNull();
    expect(compartirWhatsApp('a b')).toBe('https://wa.me/?text=a%20b');
  });
});
