import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    OnInit,
    effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, take } from 'rxjs';
import { HeroComponent } from './components/hero/hero.component';
import { PublicRecipesSearchComponent } from './components/public-recipes-search/public-recipes-search';
import { PublicRecipesSectionComponent } from './components/public-recipes-section/public-recipes-section';
import { RecipeCardData } from '../../shared/components/recipe-card/recipe-card';
import {
    PublicRecipesService,
    GetPublicRecipesParams,
} from '../../core/services/public-recipes.service';
import { PublicRecipeListItemDto } from '../../../../shared/contracts/types';

/**
 * Klucze sekcji na landing page
 */
type LandingSectionKey = 'newest' | 'featured' | 'seasonal';

/**
 * Stan asynchroniczny dla sekcji
 */
interface AsyncSectionState<T> {
    data: T;
    isLoading: boolean;
    errorMessage: string | null;
}

/**
 * Konfiguracja sekcji na landing page
 */
interface LandingSectionConfig {
    key: LandingSectionKey;
    title: string;
    query: GetPublicRecipesParams;
}

/**
 * Główny komponent landing page.
 * Wyświetla hero, wyszukiwarkę i sekcje z kuratorowanymi listami publicznych przepisów.
 */
@Component({
    selector: 'pych-landing-page',
    standalone: true,
    imports: [
        HeroComponent,
        PublicRecipesSearchComponent,
        PublicRecipesSectionComponent,
    ],
    templateUrl: './landing-page.component.html',
    styleUrl: './landing-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent implements OnInit {
    private readonly router = inject(Router);
    private readonly publicRecipesService = inject(PublicRecipesService);

    /**
     * Konfiguracja sekcji z różnymi sortowaniami
     * (MVP: używamy różnych kombinacji sort/page dla symulacji kuratorowanych list)
     */
    private readonly sectionsConfig: LandingSectionConfig[] = [
        {
            key: 'newest',
            title: 'Najnowsze przepisy',
            query: { page: 1, limit: 8, sort: 'created_at.desc' },
        },
        {
            key: 'featured',
            title: 'Polecane',
            query: { page: 2, limit: 8, sort: 'created_at.desc' },
        },
        {
            key: 'seasonal',
            title: 'Sezonowe',
            query: { page: 1, limit: 8, sort: 'name.asc' },
        },
    ];

    /**
     * Stan sekcji przechowywany w signal
     */
    sectionsState = signal<Record<LandingSectionKey, AsyncSectionState<RecipeCardData[]>>>({
        newest: { data: [], isLoading: true, errorMessage: null },
        featured: { data: [], isLoading: true, errorMessage: null },
        seasonal: { data: [], isLoading: true, errorMessage: null },
    });

    ngOnInit(): void {
        // Załaduj dane dla wszystkich sekcji równolegle
        this.loadAllSections();
    }

    /**
     * Obsługa submitu wyszukiwania
     */
    onSearchSubmit(query: string): void {
        // Nawigacja do /explore z parametrem q (jeśli niepuste)
        const queryParams = query ? { q: query } : {};
        this.router.navigate(['/explore'], { queryParams });
    }

    /**
     * Obsługa retry dla konkretnej sekcji
     */
    onSectionRetry(sectionKey: LandingSectionKey): void {
        this.loadSection(sectionKey);
    }

    /**
     * Pobiera tytuł sekcji na podstawie klucza
     */
    getSectionTitle(key: LandingSectionKey): string {
        return this.sectionsConfig.find((s) => s.key === key)?.title ?? '';
    }

    /**
     * Ładuje wszystkie sekcje równolegle
     */
    private loadAllSections(): void {
        this.sectionsConfig.forEach((config) => {
            this.loadSection(config.key);
        });
    }

    /**
     * Ładuje dane dla pojedynczej sekcji
     */
    private loadSection(sectionKey: LandingSectionKey): void {
        const config = this.sectionsConfig.find((s) => s.key === sectionKey);
        if (!config) return;

        // Ustaw stan loading, ale zachowaj poprzednie dane (zasada "keep previous data visible")
        this.sectionsState.update((state) => ({
            ...state,
            [sectionKey]: {
                ...state[sectionKey],
                isLoading: true,
                errorMessage: null,
            },
        }));

        // Pobierz dane z API
        this.publicRecipesService
            .getPublicRecipes(config.query)
            .pipe(
                take(1),
                catchError((error) => {
                    // Obsługa błędu
                    this.sectionsState.update((state) => ({
                        ...state,
                        [sectionKey]: {
                            data: state[sectionKey].data, // Zachowaj poprzednie dane
                            isLoading: false,
                            errorMessage:
                                error?.message || 'Nie udało się pobrać przepisów',
                        },
                    }));
                    return of(null);
                })
            )
            .subscribe((response) => {
                if (!response) return; // Błąd już obsłużony w catchError

                // Mapowanie DTO na RecipeCardData
                const recipes = response.data.map((dto) =>
                    this.mapToCardData(dto)
                );

                // Aktualizuj stan z nowymi danymi
                this.sectionsState.update((state) => ({
                    ...state,
                    [sectionKey]: {
                        data: recipes,
                        isLoading: false,
                        errorMessage: null,
                    },
                }));
            });
    }

    /**
     * Mapuje DTO na RecipeCardData
     */
    private mapToCardData(dto: PublicRecipeListItemDto): RecipeCardData {
        return {
            id: dto.id,
            name: dto.name,
            slug: this.slugify(dto.name),
            imageUrl: dto.image_path,
            categoryName: dto.category?.name ?? null,
        };
    }

    /**
     * Generuje slug z nazwy przepisu (prosty variant)
     */
    private slugify(text: string): string {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // usuń znaki specjalne
            .replace(/[\s_-]+/g, '-') // zamień spacje/podkreślenia na myślniki
            .replace(/^-+|-+$/g, ''); // usuń myślniki z początku/końca
    }
}


