import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { routes } from './app.routes';
import { PolishPaginatorIntl } from './core/services/polish-paginator-intl';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AuthService } from './core/services/auth.service';
import { inject } from '@angular/core';

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        // add animations
        provideAnimations(),
        provideRouter(routes),
        { provide: MatPaginatorIntl, useClass: PolishPaginatorIntl },
        // Initialize auth state at app startup
        provideAppInitializer(() => {
            const authService = inject(AuthService);
            return authService.initAuthState();
        }),
    ],
};
