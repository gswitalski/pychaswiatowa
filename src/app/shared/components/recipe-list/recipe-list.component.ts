import {
    ChangeDetectionStrategy,
    Component,
    ContentChild,
    TemplateRef,
    input,
    output,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PaginationDetails } from '../../../../../shared/contracts/types';
import {
    RecipeCardComponent,
    RecipeCardData,
    RecipeCardRouteType,
} from '../recipe-card/recipe-card';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface RecipeListItemViewModel {
    card: RecipeCardData;
    isOwnRecipe?: boolean;
    inMyCollections?: boolean;
}

@Component({
    selector: 'pych-recipe-list',
    standalone: true,
    imports: [
        RecipeCardComponent,
        EmptyStateComponent,
        MatProgressSpinnerModule,
        MatPaginatorModule,
        NgTemplateOutlet,
    ],
    templateUrl: './recipe-list.component.html',
    styleUrl: './recipe-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeListComponent {
    /** Lista przepisów do wyświetlenia (w formacie karty) */
    readonly recipes = input.required<RecipeListItemViewModel[]>();

    /** Flaga informująca o stanie ładowania */
    readonly isLoading = input<boolean>(false);

    /** Czy pokazać akcję usuwania na kartach przepisów */
    readonly showRemoveAction = input<boolean>(false);

    /** Informacje o paginacji (opcjonalne - bez tego brak paginatora) */
    readonly pagination = input<PaginationDetails | null>(null);

    /** Rozmiar strony dla paginatora */
    readonly pageSize = input<number>(12);

    /** Dostępne opcje rozmiaru strony */
    readonly pageSizeOptions = input<number[]>([6, 12, 24]);

    /** Typ trasowania kart (public/private) */
    readonly routeType = input<RecipeCardRouteType>('private');

    /** Czy pokazywać kategorię na kartach */
    readonly showCategory = input<boolean>(true);

    /** Konfiguracja domyślnego empty state */
    readonly emptyStateTitle = input<string>('Brak przepisów');
    readonly emptyStateDescription = input<string>('Nie znaleziono przepisów do wyświetlenia.');
    readonly emptyStateIcon = input<string>('menu_book');

    /** Szablon niestandardowego empty state (opcjonalnie) */
    @ContentChild('emptyState', { read: TemplateRef })
    emptyStateTemplate?: TemplateRef<unknown>;

    /** Event emitowany przy zmianie strony */
    readonly pageChange = output<PageEvent>();

    /** Event emitowany przy żądaniu usunięcia przepisu z kolekcji */
    readonly removeRecipe = output<number>();

    /**
     * Obsługuje zmianę strony w paginatorze
     */
    onPageChange(event: PageEvent): void {
        this.pageChange.emit(event);
    }

    /**
     * Obsługuje żądanie usunięcia przepisu z kolekcji
     */
    onRemoveRecipe(recipeId: number): void {
        this.removeRecipe.emit(recipeId);
    }
}
