import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

if (environment.supabaseUrl.includes('<<') || environment.supabaseAnonKey.includes('<<')) {
  console.error('Configura src/environments/*.ts con los datos de Supabase (supabaseUrl y supabaseAnonKey).');
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
