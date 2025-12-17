import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { RecipeDetailDto, PublicRecipeDetailDto, TagDto } from '../../../../../../../shared/contracts/types';

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
    imports: [RouterLink, MatChipsModule],
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

        // Guard: nie renderuj jeśli null lub poza zakresem
        if (servings === null || servings < 1 || servings > 99) {
            return null;
        }

        const word = this.getServingsWord(servings);
        return `${servings} ${word}`;
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

