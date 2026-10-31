import { esErrorDeChunk, marcarArranqueCorrecto, recargarSiVersionNueva } from './chunk-error';

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k: string) => datos[k] ?? null,
    setItem: (k: string, v: string) => void (datos[k] = v),
    removeItem: (k: string) => void delete datos[k],
  };
}

describe('chunk error recovery', () => {
  it('recognizes the browser messages for a missing lazy chunk', () => {
    expect(esErrorDeChunk(new TypeError('Failed to fetch dynamically imported module: https://x/chunk-ABC.js'))).toBe(true);
    expect(esErrorDeChunk(new Error('error loading dynamically imported module'))).toBe(true);
    expect(esErrorDeChunk(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(esErrorDeChunk(new Error('No hay un taller activo'))).toBe(false);
    expect(esErrorDeChunk(null)).toBe(false);
  });

  it('reloads once for a chunk error and not again until the app starts well', () => {
    const almacen = almacenFalso();
    let recargas = 0;
    const error = new TypeError('Failed to fetch dynamically imported module: x');

    expect(recargarSiVersionNueva(error, almacen, () => recargas++)).toBe(true);
    expect(recargarSiVersionNueva(error, almacen, () => recargas++)).toBe(false); // loop guard
    expect(recargas).toBe(1);

    marcarArranqueCorrecto(almacen);
    expect(recargarSiVersionNueva(error, almacen, () => recargas++)).toBe(true);
    expect(recargas).toBe(2);
  });

  it('never reloads for other errors', () => {
    let recargas = 0;
    expect(recargarSiVersionNueva(new Error('otro'), almacenFalso(), () => recargas++)).toBe(false);
    expect(recargas).toBe(0);
  });
});
