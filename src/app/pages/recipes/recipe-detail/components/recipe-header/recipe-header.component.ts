import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { RecipeDetailDto, PublicRecipeDetailDto, TagDto } from '../../../../../../../shared/contracts/types';
import { DurationMinutesPipe } from '../../../../../shared/pipes/duration-minutes.pipe';
import {
    RECIPE_DIET_TYPE_LABELS,
    RECIPE_CUISINE_LABELS,
    RECIPE_DIFFICULTY_LABELS,
} from '../../../../../shared/models/recipe-classification.model';

/**
 * Type guard sprawdzający czy przepis to RecipeDetailDto
 */
function isRecipeDetailDto(recipe: RecipeDetailDto | PublicRecipeDetailDto): recipe is RecipeDetailDto {
    return 'category_id' in recipe && 'category_name' in recipe;
}

/**
 * Type guard sprawdzający czy tagi to TagDto[]
 */
function isTagDtoArray(tags: TagDto[] | string[]): tags is TagDto[] {
    return tags.length > 0 && typeof tags[0] === 'object' && 'id' in tags[0];
}

/**
 * Komponent nagłówka przepisu wyświetlający nazwę, opis, kategorię i tagi.
 * Obsługuje zarówno kontekst prywatny (dla zalogowanych użytkowników)
 * jak i publiczny (dla gości).
 */
@Component({
    selector: 'pych-recipe-header',
    standalone: true,
    imports: [RouterLink, MatChipsModule, MatIconModule, DurationMinutesPipe],
    templateUrl: './recipe-header.component.html',
    styleUrl: './recipe-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeHeaderComponent {
    /** Dane przepisu (prywatny lub publiczny) */
    readonly recipe = input.required<RecipeDetailDto | PublicRecipeDetailDto>();

    /**
     * Czy komponent jest używany w kontekście publicznym.
     * W kontekście publicznym kategoria i tagi nie są klikalne.
     */
    readonly isPublic = input<boolean>(false);

    // Mapy etykiet dla pól klasyfikacyjnych
    readonly dietTypeLabels = RECIPE_DIET_TYPE_LABELS;
    readonly cuisineLabels = RECIPE_CUISINE_LABELS;
    readonly difficultyLabels = RECIPE_DIFFICULTY_LABELS;

    /**
     * Helper method do sprawdzania typu przepisu w template
     */
    isRecipeDetailDto(recipe: RecipeDetailDto | PublicRecipeDetailDto): recipe is RecipeDetailDto {
        return isRecipeDetailDto(recipe);
    }

    /**
     * Helper method do sprawdzania typu tagów w template
     */
    isTagDtoArray(tags: TagDto[] | string[]): tags is TagDto[] {
        return isTagDtoArray(tags);
    }

    /**
     * Pobiera nazwę kategorii (obsługuje oba typy)
     */
    getCategoryName(recipe: RecipeDetailDto | PublicRecipeDetailDto): string | null {
        if (isRecipeDetailDto(recipe)) {
            return recipe.category_name;
        }
        return recipe.category?.name ?? null;
    }

    /**
     * Pobiera ID kategorii (obsługuje oba typy)
     */
    getCategoryId(recipe: RecipeDetailDto | PublicRecipeDetailDto): number | null {
        if (isRecipeDetailDto(recipe)) {
            return recipe.category_id;
        }
        return recipe.category?.id ?? null;
    }

    /**
     * Zwraca tagi w formacie do wyświetlania
     */
    getTagsForDisplay(recipe: RecipeDetailDto | PublicRecipeDetailDto): { id: number | string; name: string }[] {
        if (!recipe.tags || recipe.tags.length === 0) {
            return [];
        }

        if (isTagDtoArray(recipe.tags)) {
            // TagDto[] - już ma id i name
            return recipe.tags;
        } else {
            // string[] - generujemy prosty format
            return recipe.tags.map((tag, index) => ({ id: `tag-${index}`, name: tag }));
        }
    }

    /**
     * Computed signal dla etykiety liczby porcji.
     * Zwraca sformatowany string z odpowiednią odmianą "porcja/porcje/porcji"
     * lub null jeśli servings nie jest ustawione lub poza zakresem 1-99.
     */
    readonly servingsLabel = computed(() => {
        const servings = this.recipe().servings;

        // Guard: nie renderuj jeśli null, undefined lub poza zakresem
        if (servings === null || servings === undefined || servings < 1 || servings > 99) {
            return null;
        }

        const word = this.getServingsWord(servings);
        return `${servings} ${word}`;
    });

    /**
     * Computed signal sprawdzający czy należy pokazać metadane czasu przygotowania.
     * Renderujemy tylko jeśli wartość jest ustawiona (w tym 0).
     */
    readonly shouldShowPrepTime = computed(() => {
        const prepTime = this.recipe().prep_time_minutes;
        return prepTime !== null && prepTime !== undefined;
    });

    /**
     * Computed signal sprawdzający czy należy pokazać metadane czasu całkowitego.
     * Renderujemy tylko jeśli wartość jest ustawiona (w tym 0).
     */
    readonly shouldShowTotalTime = computed(() => {
        const totalTime = this.recipe().total_time_minutes;
        return totalTime !== null && totalTime !== undefined;
    });

    /**
     * Computed signal sprawdzający czy należy pokazać chip typu diety.
     */
    readonly shouldShowDietType = computed(() => {
        return this.recipe().diet_type !== null && this.recipe().diet_type !== undefined;
    });

    /**
     * Computed signal sprawdzający czy należy pokazać chip kuchni.
     */
    readonly shouldShowCuisine = computed(() => {
        return this.recipe().cuisine !== null && this.recipe().cuisine !== undefined;
    });

    /**
     * Computed signal sprawdzający czy należy pokazać chip trudności.
     */
    readonly shouldShowDifficulty = computed(() => {
        return this.recipe().difficulty !== null && this.recipe().difficulty !== undefined;
    });

    /**
     * Zwraca odpowiednią odmianę słowa "porcja" dla polskiego języka.
     * - 1 → porcja
     * - 2-4 → porcje (z wyjątkiem 12-14)
     * - pozostałe → porcji
     */
    private getServingsWord(n: number): string {
        if (n % 10 === 1 && n % 100 !== 11) {
            return 'porcja';
        }
        if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
            return 'porcje';
        }
        return 'porcji';
    }
}

