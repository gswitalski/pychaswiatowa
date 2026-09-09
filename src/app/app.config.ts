import {
    ApplicationConfig,
    inject,
    LOCALE_ID,
    provideAppInitializer,
    provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { provideRouter } from '@angular/router';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideMarkdown } from 'ngx-markdown';

import { routes } from './app.routes';
import { PolishPaginatorIntl } from './core/services/polish-paginator-intl';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AuthService } from './core/services/auth.service';

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        // add animations
        provideAnimations(),
        provideHttpClient(),
        provideMarkdown(),
        provideRouter(routes),
        { provide: LOCALE_ID, useValue: 'pl' },
        { provide: MatPaginatorIntl, useClass: PolishPaginatorIntl },
        // Initialize auth state at app startup
        provideAppInitializer(() => {
            const authService = inject(AuthService);
            return authService.initAuthState();
        }),
    ],
};
