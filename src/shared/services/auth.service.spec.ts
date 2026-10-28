import { mensajeAuth } from './auth.service';

describe('mensajeAuth', () => {
  it('translates the known Supabase errors', () => {
    expect(mensajeAuth('Invalid login credentials')).toBe('Credenciales incorrectas');
    expect(mensajeAuth('User already registered')).toBe('Este correo ya está registrado');
    expect(mensajeAuth('Email not confirmed')).toBe('Revisa tu correo para confirmar la cuenta');
  });

  it('falls back to a generic Spanish message', () => {
    expect(mensajeAuth('boom')).toBe('Ocurrió un error. Intenta de nuevo.');
    expect(mensajeAuth(undefined)).toBe('Ocurrió un error. Intenta de nuevo.');
  });
});
