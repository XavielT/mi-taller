const CLAVE_RECARGA = 'mt.recargaPorVersion';

/** True when a lazy route failed because its JS file is gone (the app was redeployed while the tab stayed open). */
export function esErrorDeChunk(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(mensaje);
}

/**
 * Reloads once so the browser downloads the new version. The flag stops a reload loop when the file is missing for
 * another reason (offline, blocked); it is cleared as soon as the app starts normally.
 */
export function recargarSiVersionNueva(error: unknown, almacen: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage, recargar: () => void = () => location.reload()): boolean {
  if (!esErrorDeChunk(error)) return false;
  try {
    if (almacen.getItem(CLAVE_RECARGA)) return false;
    almacen.setItem(CLAVE_RECARGA, '1');
  } catch {
    return false; // without storage we cannot guard against a loop
  }
  recargar();
  return true;
}

/** Called once the app navigated successfully: the next version change may reload again. */
export function marcarArranqueCorrecto(almacen: Pick<Storage, 'removeItem'> = sessionStorage): void {
  try {
    almacen.removeItem(CLAVE_RECARGA);
  } catch {
    // nothing to clear
  }
}
