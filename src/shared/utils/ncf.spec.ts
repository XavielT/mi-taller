import { FormControl } from '@angular/forms';
import { ncfValidator, ncfValido } from './ncf';

describe('ncfValido', () => {
  it('accepts a letter B/E plus 10 digits', () => {
    expect(ncfValido('B0100000001')).toBe(true);
    expect(ncfValido('E3100000123')).toBe(true);
    expect(ncfValido(' B0200000009 ')).toBe(true);
  });

  it('rejects wrong length, letters or series', () => {
    expect(ncfValido('B010000001')).toBe(false);
    expect(ncfValido('B01000000011')).toBe(false);
    expect(ncfValido('A0100000001')).toBe(false);
    expect(ncfValido('B01000000AB')).toBe(false);
    expect(ncfValido('')).toBe(false);
  });
});

describe('ncfValidator', () => {
  it('treats empty as valid (optional field)', () => {
    expect(ncfValidator(new FormControl(''))).toBeNull();
    expect(ncfValidator(new FormControl(null))).toBeNull();
  });

  it('flags a filled but malformed value with the pattern error', () => {
    expect(ncfValidator(new FormControl('B12'))).toEqual({ pattern: true });
    expect(ncfValidator(new FormControl('B0100000001'))).toBeNull();
  });
});
