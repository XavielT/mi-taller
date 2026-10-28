export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  nombre: string;
}

export interface SignUpResult {
  /** `true` cuando Supabase exige confirmar el correo antes de iniciar sesión. */
  confirmarCorreo: boolean;
}
