import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { routes } from './app.routes';
import { PolishPaginatorIntl } from './core/services/polish-paginator-intl';
import { provideAnimations } from '@angular/platform-browser/animations';

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        // add animations
        provideAnimations(),
        provideRouter(routes),
        { provide: MatPaginatorIntl, useClass: PolishPaginatorIntl },
    ],
};
