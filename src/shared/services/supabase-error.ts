/** Minimal shape of a PostgREST / Supabase error. */
interface ErrorSupabase {
  message?: string;
  code?: string;
}

const GENERICO = 'Ocurrió un error inesperado. Intenta de nuevo.';

/**
 * Turns a Supabase error into an `Error` with a Spanish message.
 * Messages raised by our own RPCs (`raise exception`, code P0001) are already in Spanish and pass through.
 */
export function aError(e: ErrorSupabase | null | undefined, fallback = GENERICO): Error {
  if (!e) return new Error(fallback);
  if (e.code === 'P0001' && e.message) return new Error(e.message);
  if (e.code === '23505') return new Error('Ya existe un registro con esos datos');
  if (e.code === '23503') return new Error('El registro está relacionado con otros datos');
  if (e.code === '42501') return new Error('No tienes permiso para realizar esta acción');
  if (e.message && /Failed to fetch|NetworkError/i.test(e.message)) {
    return new Error('No hay conexión con el servidor. Revisa tu internet.');
  }
  return new Error(fallback);
}
