/**
 * Normalizes a Dominican phone number to the international digits WhatsApp expects (1 + 10 digits).
 * Returns null when it cannot be a valid number.
 */
export function telefonoWhatsApp(telefono: string | null | undefined): string | null {
  const d = (telefono ?? '').replace(/\D/g, '');
  if (d.length === 10) return '1' + d;
  if (d.length === 11 && d.startsWith('1')) return d;
  return null;
}

/** `https://wa.me/<number>?text=<message>` or null when the phone is not usable. */
export function enlaceWhatsApp(telefono: string | null | undefined, mensaje: string): string | null {
  const n = telefonoWhatsApp(telefono);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}` : null;
}

/** Link to share a text without a recipient (used for invitation links). */
export function compartirWhatsApp(mensaje: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}
