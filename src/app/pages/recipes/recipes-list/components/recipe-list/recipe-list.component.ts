import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RecipeListItemDto, PaginationDetails } from '../../../../../../../shared/contracts/types';
import { RecipeCardComponent, RecipeCardData } from '../../../../../shared/components/recipe-card/recipe-card';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
    selector: 'pych-recipe-list',
    standalone: true,
    imports: [RecipeCardComponent, EmptyStateComponent, MatProgressSpinnerModule, MatPaginatorModule],
    templateUrl: './recipe-list.component.html',
    styleUrl: './recipe-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeListComponent {
    /** Lista przepisów do wyświetlenia */
    readonly recipes = input.required<RecipeListItemDto[]>();

    /** Flaga informująca o stanie ładowania */
    readonly isLoading = input<boolean>(false);

    /** Czy pokazać akcję usuwania na kartach przepisów */
    readonly showRemoveAction = input<boolean>(false);

    /** Informacje o paginacji (opcjonalne - bez tego brak paginatora) */
    readonly pagination = input<PaginationDetails | null>(null);

    /** Rozmiar strony dla paginatora */
    readonly pageSize = input<number>(12);

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

    /**
     * Mapuje RecipeListItemDto na RecipeCardData
     */
    mapToCardData(recipe: RecipeListItemDto): RecipeCardData {
        return {
            id: recipe.id,
            name: recipe.name,
            imageUrl: recipe.image_path,
            categoryName: recipe.category_name ?? null,
        };
    }
}

