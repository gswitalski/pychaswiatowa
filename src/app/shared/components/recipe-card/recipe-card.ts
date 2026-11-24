import {
    afterEveryRender,
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SupabaseService } from '../../../core/services/supabase.service';
import { RecipeVisibility } from '../../../../../shared/contracts/types';
import { SlugService } from '../../services/slug.service';

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
    /** Czy przepis jest przeznaczony dla termorobota (Thermomix/Lidlomix) */
    isTermorobot?: boolean;
    /** Czy przepis jest przeznaczony na grilla/barbecue */
    isGrill?: boolean;
    /** Czy zalogowany użytkownik oznaczył przepis jako ulubiony */
    isFavorite?: boolean;
    variantName?: string | null;
    activeVariantCount?: number;
    matchingVariantCount?: number;
    matchingVariantNames?: string[];
    matchingVariantOverflow?: number;
    variantFilterActive?: boolean;
    savedVariantCount?: number;
}

/**
 * Typ routingu dla karty przepisu
 */
export type RecipeCardRouteType = 'private' | 'public';

/**
 * Uogólniony komponent karty przepisu.
 * Używany zarówno dla widoków prywatnych jak i publicznych.
 * Wszystkie przepisy prowadzą do zunifikowanego widoku /recipes/:id.
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
        MatChipsModule,
        MatTooltipModule,
    ],
    templateUrl: './recipe-card.html',
    styleUrl: './recipe-card.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCardComponent {
    private readonly supabase = inject(SupabaseService);
    private readonly slugService = inject(SlugService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly titleLine = viewChild<ElementRef<HTMLElement>>('titleLine');

    /** Pierwsza linia jest ucięta i tooltip ma pokazać pełną treść. */
    readonly titleOverflow = signal(false);

    constructor() {
        afterEveryRender(() => this.measureTitleOverflow());
        afterNextRender(() => {
            const node = this.titleLine()?.nativeElement;
            if (!node || typeof ResizeObserver === 'undefined') {
                return;
            }
            const observer = new ResizeObserver(() => this.measureTitleOverflow());
            observer.observe(node);
            this.destroyRef.onDestroy(() => observer.disconnect());
        });
    }

    /** Dane przepisu do wyświetlenia */
    readonly recipe = input.required<RecipeCardData>();

    /** Typ routingu: 'private' lub 'public' - wpływa na wyświetlanie kategorii */
    readonly routeType = input<RecipeCardRouteType>('private');

    /** Czy pokazać kategorię (domyślnie true dla publicznych, false dla prywatnych) */
    readonly showCategory = input<boolean | undefined>(undefined);

    /** Czy pokazać przycisk akcji usuwania (tylko dla prywatnych widoków z kolekcją) */
    readonly showRemoveAction = input<boolean>(false);

    /** Czy przepis należy do aktualnie zalogowanego użytkownika (dla badge "Twój przepis") */
    readonly isOwnRecipe = input<boolean>(false);

    /** Czy przepis jest w kolekcjach użytkownika (dla badge "W moich kolekcjach") */
    readonly inMyCollections = input<boolean>(false);

    /** Czy przepis jest przeznaczony dla termorobota (Thermomix/Lidlomix) */
    readonly isTermorobot = input<boolean>(false);

    /** Widoczność przepisu (tylko dla przepisów własnych) */
    readonly visibility = input<RecipeVisibility | null>(null);

    /** Event emitowany po kliknięciu opcji usunięcia */
    readonly remove = output<void>();

    /** Placeholder dla brakującego obrazka */
    readonly placeholderImage = '/placeholder-recipe.svg';

    readonly hasVariants = computed(() => (this.recipe().activeVariantCount ?? 1) >= 2);

    readonly variantNames = computed(() =>
        (this.recipe().matchingVariantNames ?? [])
            .map((name) => name.trim())
            .filter((name) => name.length > 0)
    );

    readonly shouldShowVariantNames = computed(
        () => this.hasVariants() && this.variantNames().length > 0
    );

    readonly fullVariantSummary = computed(() => this.variantNames().join(' · '));

    /** Pełna pierwsza linia: nazwa oraz, gdy są, wszystkie warianty. */
    readonly titleLineText = computed(() => {
        const name = this.recipe().name;
        if (!this.shouldShowVariantNames()) {
            return name;
        }
        return `${name} · ${this.fullVariantSummary()}`;
    });

    readonly variantNamesAriaLabel = computed(() => {
        const recipe = this.recipe();
        return `${recipe.name}: ${this.fullVariantSummary()}`;
    });

    readonly cardAriaLabel = computed(() => {
        const recipe = this.recipe();
        if (!this.hasVariants()) {
            return recipe.name;
        }
        return this.shouldShowVariantNames()
            ? this.variantNamesAriaLabel()
            : recipe.name;
    });

    measureTitleOverflow(): void {
        const element = this.titleLine()?.nativeElement;
        if (!element) {
            this.titleOverflow.set(false);
            return;
        }
        this.titleOverflow.set(element.scrollWidth > element.clientWidth + 1);
    }

    /**
     * Computed: full image URL
     * Converts storage path to public URL if needed
     */
    readonly fullImageUrl = computed(() => {
        const url = this.recipe().imageUrl;

        if (!url) {
            return null;
        }

        // If already a full URL, return as is
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // Otherwise, construct public URL from storage path
        const { data } = this.supabase.storage
            .from('recipe-images')
            .getPublicUrl(url);

        return data?.publicUrl || null;
    });

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
     * Computed: link do szczegółów przepisu w formacie kanonicznym :id-:slug
     * - private: /recipes/:id-:slug
     * - public: /explore/recipes/:id-:slug
     *
     * Jeśli slug nie jest dostępny w danych, generuje go z nazwy przepisu.
     * Fallback do legacy URL (:id) nie jest używany - zawsze generujemy slug.
     */
    readonly recipeLink = computed(() => {
        const recipe = this.recipe();
        const type = this.routeType();

        // Użyj dostarczonego sluga lub wygeneruj z nazwy
        const slug = recipe.slug ?? this.slugService.slugify(recipe.name);
        const recipeSegment = `${recipe.id}-${slug}`;

        if (type === 'public') {
            return `/explore/recipes/${recipeSegment}`;
        }

        return `/recipes/${recipeSegment}`;
    });

    readonly recipeQueryParams = computed(() => {
        return this.hasVariants() ? { variant: this.recipe().id } : null;
    });

    /**
     * Computed: czy pokazać wskaźnik widoczności
     * Pokazujemy tylko dla przepisów własnych z określonym visibility
     */
    readonly shouldShowVisibilityIndicator = computed(() => {
        return this.isOwnRecipe() && this.visibility() != null;
    });

    /**
     * Computed: nazwa ikony dla widoczności
     */
    readonly visibilityIconName = computed(() => {
        const visibility = this.visibility();
        switch (visibility) {
            case 'PRIVATE':
                return 'lock';
            case 'SHARED':
                return 'group';
            case 'PUBLIC':
                return 'public';
            default:
                return 'help';
        }
    });

    /**
     * Computed: tekst tooltipa dla widoczności
     */
    readonly visibilityTooltip = computed(() => {
        const visibility = this.visibility();
        switch (visibility) {
            case 'PRIVATE':
                return 'Prywatny';
            case 'SHARED':
                return 'Współdzielony';
            case 'PUBLIC':
                return 'Publiczny';
            default:
                return 'Nieznana';
        }
    });

    /**
     * Computed: aria-label dla wskaźnika widoczności
     */
    readonly visibilityAriaLabel = computed(() => {
        return `Widoczność przepisu: ${this.visibilityTooltip()}`;
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
}
