import { ApplicationConfig, DEFAULT_CURRENCY_CODE, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsDO from '@angular/common/locales/es-DO';
import { provideRouter, withNavigationErrorHandler, withRouterConfig } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { recargarSiVersionNueva } from './chunk-error';
import { routes } from './app.routes';

registerLocaleData(localeEsDO);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // A tab left open across a deploy asks for page files that no longer exist: reload once to get the new version.
      withNavigationErrorHandler((e) => {
        recargarSiVersionNueva(e.error);
      }),
      withRouterConfig({ resolveNavigationPromiseOnError: true }),
    ),
    provideAnimations(),
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'es-DO' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'DOP' },
  ],
};
