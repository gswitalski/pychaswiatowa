import { Routes } from '@angular/router';

export const collectionsRoutes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import(
                './collections-list/collections-list-page.component'
            ).then((m) => m.CollectionsListPageComponent),
    },
    {
        path: ':id',
        loadComponent: () =>
            import(
                './collection-details/collection-details-page.component'
            ).then((m) => m.CollectionDetailsPageComponent),
    },
];
