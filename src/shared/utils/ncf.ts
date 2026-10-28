import { AbstractControl, ValidationErrors } from '@angular/forms';

/** NCF: a series letter (B, or E for e-CF) followed by 10 digits, e.g. B0100000001. */
export const PATRON_NCF = /^[BE]\d{10}$/;

export function ncfValido(valor: string | null | undefined): boolean {
  return PATRON_NCF.test((valor ?? '').trim());
}

/** Reactive-forms validator: an empty NCF is fine (it is optional), a filled one must match the pattern. */
export function ncfValidator(control: AbstractControl): ValidationErrors | null {
  const v = (control.value ?? '').toString().trim();
  return v === '' || ncfValido(v) ? null : { pattern: true };
}
