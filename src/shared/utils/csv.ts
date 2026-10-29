export type CeldaCsv = string | number | boolean | null | undefined;

/** One CSV field: quotes when it has a comma, quote or line break; neutralizes spreadsheet formulas (=, +, -, @). */
export function campoCsv(valor: CeldaCsv): string {
  if (valor === null || valor === undefined) return '';
  let texto = String(valor);
  // A text cell starting with a formula character would run as a formula when opened in Excel.
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto) && !/^-?\d+([.,]\d+)?$/.test(texto)) texto = `'${texto}`;
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCsv(encabezados: string[], filas: CeldaCsv[][]): string {
  return [encabezados, ...filas].map((f) => f.map(campoCsv).join(',')).join('\r\n');
}

/** Downloads text as a file. The BOM makes Excel read accents (UTF-8) correctly. */
export function descargarArchivo(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['﻿', contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
