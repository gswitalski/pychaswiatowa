import { Component, OnInit, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SlugService } from '../../../shared/services/slug.service';
import { ExploreRecipesService } from '../../../core/services/explore-recipes.service';
import { RecipesService } from '../services/recipes.service';
import { ApiError } from '../../../../../shared/contracts/types';

/**
 * Kontekst normalizacji URL - określa czy przepis jest publiczny czy prywatny.
 */
export type RecipeUrlNormalizationContext = 'public' | 'private';

/**
 * Stan komponentu normalizacji URL.
 */
interface NormalizationState {
    isLoading: boolean;
    error: ApiError | null;
    targetUrl: string | null;
}

/**
 * Komponent techniczny odpowiedzialny za normalizację legacy URL-i przepisów
 * do formatu kanonicznego :id-:slug.
 *
 * Obsługuje przekierowania:
 * - /explore/recipes/:id → /explore/recipes/:id-:slug (publiczny kontekst)
 * - /recipes/:id → /recipes/:id-:slug (prywatny kontekst)
 *
 * Przekierowanie odbywa się z replaceUrl=true (nie pozostawia legacy URL w historii).
 */
@Component({
    selector: 'pych-recipe-url-normalization-page',
    standalone: true,
    imports: [CommonModule, MatProgressSpinnerModule],
    template: `
        <div class="normalization-container">
            @if (state().isLoading) {
                <div class="loading-state">
                    <mat-spinner diameter="48"></mat-spinner>
                    <p>Przekierowujemy...</p>
                </div>
            }
            @if (state().error) {
                <div class="error-state">
                    <h2>Wystąpił błąd</h2>
                    <p>{{ state().error?.message }}</p>
                </div>
            }
        </div>
    `,
    styles: [
        `
            .normalization-container {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 50vh;
                padding: 2rem;
            }

            .loading-state,
            .error-state {
                text-align: center;
            }

            .loading-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1rem;
            }

            .loading-state p {
                color: var(--mat-sys-on-surface-variant);
                margin: 0;
            }

            .error-state h2 {
                color: var(--mat-sys-error);
                margin-bottom: 0.5rem;
            }

            .error-state p {
                color: var(--mat-sys-on-surface-variant);
            }
        `,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeUrlNormalizationPageComponent implements OnInit {
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly slugService = inject(SlugService);
    private readonly exploreRecipesService = inject(ExploreRecipesService);
    private readonly recipesService = inject(RecipesService);

    protected readonly state = signal<NormalizationState>({
        isLoading: true,
        error: null,
        targetUrl: null,
    });

    ngOnInit(): void {
        this.normalizeUrl();
    }

    /**
     * Główna procedura normalizacji URL.
     * Pobiera dane przepisu i nawiguje do kanonicznego URL.
     */
    private async normalizeUrl(): Promise<void> {
        // Odczyt parametrów z route
        const idParam = this.route.snapshot.paramMap.get('id');
        const context = (this.route.snapshot.data['context'] as RecipeUrlNormalizationContext) ?? 'public';
        const queryParams = this.route.snapshot.queryParams;

        // Guard clauses
        if (!idParam) {
            this.setError(400, 'Nieprawidłowy identyfikator przepisu');
            return;
        }

        const id = parseInt(idParam, 10);
        if (isNaN(id) || id <= 0) {
            this.setError(400, 'Nieprawidłowy identyfikator przepisu');
            return;
        }

        try {
            // Pobranie danych przepisu w zależności od kontekstu
            const recipe = await this.fetchRecipe(id, context);

            if (!recipe) {
                this.setError(404, this.getNotFoundMessage(context));
                return;
            }

            // Wygenerowanie sluga
            const slug = this.slugService.slugify(recipe.name);

            // Zbudowanie kanonicznego URL
            const canonicalPath = context === 'public'
                ? `/explore/recipes/${id}-${slug}`
                : `/recipes/${id}-${slug}`;

            // Zachowanie query params przy nawigacji
            const urlTree = this.router.createUrlTree([canonicalPath], {
                queryParams: queryParams,
                queryParamsHandling: 'merge',
            });

            // Nawigacja z replaceUrl (nie pozostawia legacy URL w historii)
            await this.router.navigateByUrl(urlTree, {
                replaceUrl: true,
            });
        } catch (error: unknown) {
            console.error('Recipe URL normalization error:', error);

            // Rozpoznanie typu błędu z API
            const apiError = error as { status?: number };
            if (apiError?.status === 403) {
                this.setError(403, 'Nie masz dostępu do tego przepisu lub nie istnieje.');
            } else if (apiError?.status === 404) {
                this.setError(404, this.getNotFoundMessage(context));
            } else {
                this.setError(
                    500,
                    'Wystąpił błąd podczas ładowania przepisu'
                );
            }
        }
    }

    /**
     * Zwraca odpowiedni komunikat błędu 404 w zależności od kontekstu.
     */
    private getNotFoundMessage(context: RecipeUrlNormalizationContext): string {
        if (context === 'public') {
            return 'Ten przepis nie został znaleziony lub jest prywatny. Zaloguj się, aby uzyskać dostęp.';
        }
        return 'Przepis nie został znaleziony lub nie masz do niego dostępu.';
    }

    /**
     * Pobiera dane przepisu w zależności od kontekstu (publiczny/prywatny).
     */
    private async fetchRecipe(id: number, context: RecipeUrlNormalizationContext): Promise<{ name: string } | null> {
        if (context === 'public') {
            const recipe = await this.exploreRecipesService.getExploreRecipeById(id).toPromise();
            return recipe ? { name: recipe.name ?? 'przepis' } : null;
        } else {
            const recipe = await this.recipesService.getRecipeById(id).toPromise();
            return recipe ? { name: recipe.name ?? 'przepis' } : null;
        }
    }

    /**
     * Ustawia stan błędu i zatrzymuje loading.
     */
    private setError(status: number, message: string): void {
        this.state.update((current) => ({
            ...current,
            isLoading: false,
            error: { status, message },
        }));
    }
}

