/**
 * app.config.ts
 * Application-wide providers.
 *
 *  provideZonelessChangeDetection() - Angular v20+ runs without zone.js.  The
 *    whole site is built on signals, so change detection is driven by those
 *    signals instead of by patching browser APIs.  This is the modern Angular
 *    v22 default and it is noticeably faster.
 *  provideHttpClient(withFetch())   - the HTTP client uses the native fetch API.
 *  provideRouter(routes)            - the standalone route table.
 *  withComponentInputBinding()      - route parameters can be read as component
 *    inputs (`id = input.required<string>()`), which is how the Event Details
 *    page receives its :id.
 *  withInMemoryScrolling()          - navigating to a new page scrolls back to
 *    the top, otherwise the user lands halfway down the next page.
 *
 */
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
  ],
};
