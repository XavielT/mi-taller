import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { SignInRequest, SignUpRequest, SignUpResult } from '../models/auth.model';
import { SupabaseService } from './supabase.service';

const GENERICO = 'Ocurrió un error. Intenta de nuevo.';

/** Maps Supabase auth error messages to Spanish. */
export function mensajeAuth(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Credenciales incorrectas';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este correo ya está registrado';
  if (m.includes('email not confirmed')) return 'Revisa tu correo para confirmar la cuenta';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'No hay conexión con el servidor. Revisa tu internet.';
  if (m.includes('same password')) return 'La nueva contraseña debe ser distinta a la actual';
  return GENERICO;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = inject(SupabaseService).client;
  private readonly router = inject(Router);

  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  /** true once the initial `getSession()` has resolved (session restored from storage or URL). */
  readonly ready = signal(false);

  private readonly iniciada: Promise<void>;

  constructor() {
    // Do not await Supabase calls inside this callback (it can deadlock the auth lock); only update signals.
    this.client.auth.onAuthStateChange((_event, session) => this.session.set(session));

    this.iniciada = this.client.auth
      .getSession()
      .then(({ data }) => this.session.set(data.session))
      .catch(() => this.session.set(null))
      .finally(() => this.ready.set(true));
  }

  /** Resolves after the initial session check; guards use it so a refresh does not bounce to /login. */
  whenReady(): Promise<void> {
    return this.iniciada;
  }

  /** Display name from the auth metadata (set at sign-up or by Google). */
  nombreUsuario(): string | null {
    const meta = this.user()?.user_metadata as Record<string, unknown> | undefined;
    const nombre = (meta?.['nombre'] ?? meta?.['full_name'] ?? meta?.['name']) as string | undefined;
    return nombre?.trim() || null;
  }

  async signUp({ email, password, nombre }: SignUpRequest): Promise<SignUpResult> {
    const { data, error } = await this.client.auth.signUp({ email, password, options: { data: { nombre } } });
    if (error) throw new Error(mensajeAuth(error.message));
    // With email confirmation on, an already-registered address comes back as a user without identities.
    if (data.user && (data.user.identities?.length ?? 1) === 0) {
      throw new Error('Este correo ya está registrado');
    }
    return { confirmarCorreo: data.session === null };
  }

  async signIn({ email, password }: SignInRequest): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(mensajeAuth(error.message));
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: environment.appUrl + '/auth/callback' },
    });
    if (error) throw new Error(mensajeAuth(error.message));
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: environment.appUrl + '/auth/nueva-contrasena',
    });
    if (error) throw new Error(mensajeAuth(error.message));
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw new Error(mensajeAuth(error.message));
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    this.session.set(null);
    await this.router.navigate(['/login']);
  }
}
