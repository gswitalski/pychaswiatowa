import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { RecipeCardComponent, RecipeCardData } from '../../../../shared/components/recipe-card/recipe-card';
import { SlugService } from '../../../../shared/services/slug.service';
import { PublicRecipeListItemDto } from '../../../../../../shared/contracts/types';
import {
    PublicRecipesSearchMode,
    PublicRecipesSearchContext,
} from '../../../explore/models/public-recipes-search.model';

/**
 * Komponent prezentacyjny do renderowania listy publicznych przepisów.
 * 
 * Obsługuje:
 * - Stany: loading (skeleton), error, empty, wyniki
 * - Przycisk "Więcej" dla paginacji cursor-based
 */
@Component({
    selector: 'pych-public-recipe-results',
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        RecipeCardComponent,
    ],
    templateUrl: './public-recipe-results.html',
    styleUrl: './public-recipe-results.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicRecipeResultsComponent {
    private readonly slugService = inject(SlugService);

    // ==================== Inputs ====================

    /** Lista przepisów do wyświetlenia */
    readonly items = input.required<PublicRecipeListItemDto[]>();

    /** Tryb wyszukiwania (feed/search) */
    readonly mode = input.required<PublicRecipesSearchMode>();

    /** Kontekst wyszukiwania (landing/explore) */
    readonly context = input.required<PublicRecipesSearchContext>();

    /** Czy trwa ładowanie początkowe */
    readonly loadingInitial = input<boolean>(false);

    /** Czy trwa doładowywanie */
    readonly loadingMore = input<boolean>(false);

    /** Czy są kolejne wyniki do załadowania */
    readonly hasMore = input<boolean>(false);

    /** Komunikat błędu */
    readonly errorMessage = input<string | null>(null);

    // ==================== Outputs ====================

    /** Emitowane przy kliknięciu "Więcej" */
    readonly loadMore = output<void>();

    /** Emitowane przy kliknięciu "Spróbuj ponownie" */
    readonly retry = output<void>();

    // ==================== Computed ====================

    /** Liczba elementów skeletonów do pokazania */
    readonly skeletonCount = computed(() => 12);

    /** Czy pokazać empty state */
    readonly showEmptyState = computed(() => {
        return !this.loadingInitial() && 
               !this.errorMessage() && 
               this.items().length === 0;
    });

    /** Tekst empty state zależny od trybu i kontekstu */
    readonly emptyStateText = computed(() => {
        if (this.mode() === 'search') {
            return 'Brak wyników. Spróbuj innej frazy.';
        }
        // Dla feed na landing - nie powinno się zdarzyć (sekcje kuratorowane)
        // Dla feed na explore - brak przepisów
        return this.context() === 'landing' 
            ? '' 
            : 'Brak publicznych przepisów do wyświetlenia.';
    });

    /** Czy pokazać przycisk "Więcej" */
    readonly showLoadMoreButton = computed(() => {
        return !this.loadingInitial() && 
               !this.errorMessage() && 
               this.hasMore() &&
               this.items().length > 0;
    });

    /** Tekst przycisku "Więcej" */
    readonly loadMoreButtonText = computed(() => {
        return this.loadingMore() ? 'Ładowanie...' : 'Więcej';
    });

    // ==================== Methods ====================

    /**
     * Mapuje DTO na dane karty przepisu.
     */
    mapToCardData(dto: PublicRecipeListItemDto): RecipeCardData {
        return {
            id: dto.id,
            name: dto.name,
            imageUrl: dto.image_path,
            categoryName: dto.category?.name ?? null,
            slug: this.slugService.slugify(dto.name),
            isTermorobot: dto.is_termorobot ?? false,
            isGrill: dto.is_grill ?? false,
        };
    }

    /**
     * Obsługa kliknięcia "Więcej".
     */
    onLoadMore(): void {
        this.loadMore.emit();
    }

    /**
     * Obsługa kliknięcia "Spróbuj ponownie".
     */
    onRetry(): void {
        this.retry.emit();
    }

    /**
     * TrackBy function dla listy przepisów.
     */
    trackById(index: number, item: PublicRecipeListItemDto): number {
        return item.id;
    }
}

