import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/** Placeholder to keep the app rendering when src/environments/*.ts is not configured yet (main.ts logs the error). */
const URL_PENDIENTE = 'http://localhost:54321';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configurado = !environment.supabaseUrl.includes('<<') && !environment.supabaseAnonKey.includes('<<');

  /** Single Supabase client for the whole app. Only the anon key lives in the frontend. */
  readonly client = createClient<any, any, any>(
    this.configurado ? environment.supabaseUrl : URL_PENDIENTE,
    this.configurado ? environment.supabaseAnonKey : 'sin-configurar',
    {
      db: { schema: environment.supabaseSchema },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    },
  );
}
