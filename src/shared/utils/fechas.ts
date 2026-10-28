/** Local-date helpers (yyyy-MM-dd) used by filters and defaults; never go through UTC so "today" is the user's today. */
function aISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function hoyISO(ahora = new Date()): string {
  return aISO(ahora);
}

export function inicioMesISO(ahora = new Date()): string {
  return aISO(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
}

export function sumarDiasISO(dias: number, ahora = new Date()): string {
  const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + dias);
  return aISO(d);
}
