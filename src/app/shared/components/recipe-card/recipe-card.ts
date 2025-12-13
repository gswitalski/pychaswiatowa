import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
    computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';

/**
 * Uogólniony interfejs dla karty przepisu.
 * Obsługuje zarówno prywatne jak i publiczne przepisy.
 */
export interface RecipeCardData {
    id: number;
    name: string;
    imageUrl: string | null;
    /** Opcjonalna kategoria (używana w widokach publicznych) */
    categoryName?: string | null;
    /** Opcjonalny slug dla SEO-friendly URLs (używany w widokach publicznych) */
    slug?: string;
}

/**
 * Typ routingu dla karty przepisu
 */
export type RecipeCardRouteType = 'private' | 'public';

/**
 * Uogólniony komponent karty przepisu.
 * Może być używany zarówno dla prywatnych (/recipes/:id) jak i publicznych (/explore/recipes/:id-:slug) widoków.
 */
@Component({
    selector: 'pych-recipe-card',
    standalone: true,
    imports: [
        RouterLink,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
    ],
    templateUrl: './recipe-card.html',
    styleUrl: './recipe-card.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCardComponent {
    /** Dane przepisu do wyświetlenia */
    readonly recipe = input.required<RecipeCardData>();

    /** Typ routingu: 'private' dla /recipes/:id, 'public' dla /explore/recipes/:id-:slug */
    readonly routeType = input<RecipeCardRouteType>('private');

    /** Czy pokazać kategorię (domyślnie true dla publicznych, false dla prywatnych) */
    readonly showCategory = input<boolean | undefined>(undefined);

    /** Czy pokazać przycisk akcji usuwania (tylko dla prywatnych widoków z kolekcją) */
    readonly showRemoveAction = input<boolean>(false);

    /** Czy przepis należy do aktualnie zalogowanego użytkownika (dla badge "Twój przepis") */
    readonly isOwnRecipe = input<boolean>(false);

    /** Event emitowany po kliknięciu opcji usunięcia */
    readonly remove = output<void>();

    /** Placeholder dla brakującego obrazka */
    readonly placeholderImage = '/placeholder-recipe.svg';

    /**
     * Computed: czy pokazać kategorię (bazuje na showCategory lub routeType)
     */
    readonly shouldShowCategory = computed(() => {
        const explicit = this.showCategory();
        if (explicit !== undefined) return explicit;
        // Domyślnie: true dla publicznych, false dla prywatnych
        return this.routeType() === 'public';
    });

    /**
     * Computed: link do szczegółów przepisu (zależy od routeType)
     */
    readonly recipeLink = computed(() => {
        const recipe = this.recipe();
        const type = this.routeType();

        if (type === 'public') {
            const slug = recipe.slug || this.slugify(recipe.name);
            return `/explore/recipes/${recipe.id}-${slug}`;
        }

        // private
        return `/recipes/${recipe.id}`;
    });

    /**
     * Obsługuje kliknięcie przycisku menu (zapobiega nawigacji)
     */
    onMenuClick(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
    }

    /**
     * Emituje event usunięcia przepisu z kolekcji
     */
    onRemoveClick(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.remove.emit();
    }

    /**
     * Generuje slug z nazwy przepisu (fallback gdy brak sluga)
     */
    private slugify(text: string): string {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
}
