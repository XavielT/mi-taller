export interface ItemCalculable {
  cantidad: number;
  precio_unitario: number;
  aplica_itbis: boolean;
}

export interface Totales {
  subtotal: number;
  itbis: number;
  total: number;
}

/** Line amount rounded to cents (half up), computed with integers to avoid float drift. */
export function importeItem(i: Pick<ItemCalculable, 'cantidad' | 'precio_unitario'>): number {
  const centavos = Math.round(i.cantidad * 100) * Math.round(i.precio_unitario * 100); // 1/10000 of a unit
  return Math.floor((centavos + 50) / 100) / 100;
}

/**
 * Display-side mirror of the DB calculation (`ordenes_resumen` / `emitir_factura`):
 * subtotal = sum of rounded line amounts, ITBIS = round(base * rate / 100), total = subtotal + ITBIS.
 * The database stays the source of truth; this is only for live feedback while editing.
 */
export function calcularTotales(items: ItemCalculable[], itbisPct = 18): Totales {
  let subtotalC = 0;
  let baseC = 0;
  for (const i of items) {
    const c = Math.round(importeItem(i) * 100);
    subtotalC += c;
    if (i.aplica_itbis) baseC += c;
  }
  const itbisC = Math.floor((baseC * Math.round(itbisPct * 100) + 5000) / 10000);
  return { subtotal: subtotalC / 100, itbis: itbisC / 100, total: (subtotalC + itbisC) / 100 };
}
