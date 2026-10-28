import { AbstractControl } from '@angular/forms';

/** Spanish error text for the first failing validator of a control, or null when it shows no error yet. */
export function errorTexto(control: AbstractControl | null | undefined): string | null {
  if (!control || !control.invalid || !(control.touched || control.dirty)) return null;
  const e = control.errors ?? {};
  if (e['required']) return 'Este campo es requerido';
  if (e['email']) return 'Ingresa un correo válido';
  if (e['minlength']) return `Debe tener al menos ${e['minlength'].requiredLength} caracteres`;
  if (e['maxlength']) return `Debe tener máximo ${e['maxlength'].requiredLength} caracteres`;
  if (e['min']) return `El valor mínimo es ${e['min'].min}`;
  if (e['max']) return `El valor máximo es ${e['max'].max}`;
  if (e['pattern']) return 'El formato no es válido';
  if (typeof e['message'] === 'string') return e['message'];
  return 'Valor no válido';
}
