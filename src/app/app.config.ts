import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { routes } from './app.routes';
import { PolishPaginatorIntl } from './core/services/polish-paginator-intl';

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideRouter(routes),
        { provide: MatPaginatorIntl, useClass: PolishPaginatorIntl },
    ],
};
