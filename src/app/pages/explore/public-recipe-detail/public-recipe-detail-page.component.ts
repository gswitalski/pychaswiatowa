import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
    computed,
    DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PublicRecipesService } from '../../../core/services/public-recipes.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
    PublicRecipeDetailDto,
    ApiError,
} from '../../../../../shared/contracts/types';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { RecipeHeaderComponent } from '../../recipes/recipe-detail/components/recipe-header/recipe-header.component';
import { RecipeImageComponent } from '../../recipes/recipe-detail/components/recipe-image/recipe-image.component';
import { RecipeContentListComponent } from '../../recipes/recipe-detail/components/recipe-content-list/recipe-content-list.component';

/**
 * Stan lokalny dla widoku szczegółów publicznego przepisu
 */
interface PublicRecipeDetailState {
    recipe: PublicRecipeDetailDto | null;
    isLoading: boolean;
    error: ApiError | null;
}

/**
 * Komponent strony z publicznymi szczegółami przepisu.
 * Prezentuje pełną treść publicznego przepisu dla użytkowników niezalogowanych.
 * URL: /explore/recipes/:id-:slug
 */
@Component({
    selector: 'pych-public-recipe-detail-page',
    standalone: true,
    imports: [
        DatePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        PageHeaderComponent,
        RecipeHeaderComponent,
        RecipeImageComponent,
        RecipeContentListComponent,
    ],
    templateUrl: './public-recipe-detail-page.component.html',
    styleUrl: './public-recipe-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicRecipeDetailPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly publicRecipesService = inject(PublicRecipesService);
    private readonly supabase = inject(SupabaseService);
    private readonly destroyRef = inject(DestroyRef);

    readonly state = signal<PublicRecipeDetailState>({
        recipe: null,
        isLoading: true,
        error: null,
    });

    /**
     * Signal określający czy użytkownik jest zalogowany
     */
    readonly isAuthenticated = signal<boolean>(false);

    readonly recipe = computed(() => this.state().recipe);
    readonly isLoading = computed(() => this.state().isLoading);
    readonly error = computed(() => this.state().error);
    readonly hasRecipe = computed(() => this.state().recipe !== null);

    /** Tytuł strony - nazwa przepisu lub fallback */
    readonly pageTitle = computed(
        () => this.state().recipe?.name ?? 'Szczegóły przepisu'
    );

    async ngOnInit(): Promise<void> {
        // Sprawdź stan uwierzytelnienia
        await this.checkAuthStatus();

        // Subskrybuj się na zmiany parametru ':idslug' w URL (format: id-slug)
        this.route.paramMap
            .pipe(
                map((params) => {
                    // Parametr ma format 'id-slug', pobieramy pełną wartość
                    const fullParam = params.get('idslug');
                    if (!fullParam) return { id: null, slug: null };

                    // Rozdzielamy na id i slug po pierwszym myślniku
                    const separatorIndex = fullParam.indexOf('-');
                    if (separatorIndex === -1) {
                        // Tylko id bez sluga
                        return { id: fullParam, slug: null };
                    }

                    const id = fullParam.substring(0, separatorIndex);
                    const slug = fullParam.substring(separatorIndex + 1);
                    return { id, slug };
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(({ id, slug }) => {
                if (!id) {
                    this.handleInvalidId();
                    return;
                }

                const numericId = parseInt(id, 10);

                if (isNaN(numericId) || numericId <= 0) {
                    this.handleInvalidId();
                    return;
                }

                this.loadRecipe(numericId, slug);
            });
    }

    /**
     * Sprawdza stan uwierzytelnienia użytkownika
     */
    private async checkAuthStatus(): Promise<void> {
        try {
            const {
                data: { session },
            } = await this.supabase.auth.getSession();
            this.isAuthenticated.set(session !== null);
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.isAuthenticated.set(false);
        }
    }

    /**
     * Ładuje szczegóły publicznego przepisu z API
     * @param id ID przepisu
     * @param slug Slug z URL (używany do kanonikalizacji)
     */
    private loadRecipe(id: number, slug: string | null): void {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        this.publicRecipesService.getPublicRecipeById(id).subscribe({
            next: (recipe) => {
                this.state.update((s) => ({
                    ...s,
                    recipe,
                    isLoading: false,
                }));

                // Kanonikalizacja URL: sprawdź, czy slug jest prawidłowy
                // Jeśli nie ma sluga w URL lub jest nieprawidłowy, zaktualizuj URL
                const canonicalSlug = this.generateSlug(recipe.name);
                if (slug !== canonicalSlug) {
                    this.router.navigate(
                        ['/explore', 'recipes', `${id}-${canonicalSlug}`],
                        { replaceUrl: true }
                    );
                }
            },
            error: (err) => {
                const apiError: ApiError = {
                    message:
                        err.message ||
                        'Wystąpił błąd podczas pobierania przepisu',
                    status: err.status || 500,
                };
                this.state.update((s) => ({
                    ...s,
                    error: apiError,
                    isLoading: false,
                }));
            },
        });
    }

    /**
     * Obsługuje nieprawidłowy ID w URL
     */
    private handleInvalidId(): void {
        this.state.update((s) => ({
            ...s,
            isLoading: false,
            error: {
                message: 'Nieprawidłowy identyfikator przepisu',
                status: 400,
            },
        }));
    }

    /**
     * Generuje slug z nazwy przepisu (dla kanonikalizacji URL)
     */
    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    /**
     * Obsługuje kliknięcie "Wróć" - nawiguje do /explore
     */
    onBackToExplore(): void {
        this.router.navigate(['/explore']);
    }

    /**
     * Obsługuje ponowne próby załadowania przepisu w przypadku błędu
     */
    onRetry(): void {
        const currentParams = this.route.snapshot.paramMap;
        const fullParam = currentParams.get('idslug');

        if (!fullParam) {
            this.handleInvalidId();
            return;
        }

        const separatorIndex = fullParam.indexOf('-');
        const id =
            separatorIndex === -1
                ? fullParam
                : fullParam.substring(0, separatorIndex);
        const slug =
            separatorIndex === -1
                ? null
                : fullParam.substring(separatorIndex + 1);

        const numericId = parseInt(id, 10);

        if (isNaN(numericId) || numericId <= 0) {
            this.handleInvalidId();
            return;
        }

        this.loadRecipe(numericId, slug);
    }

    /**
     * Nawigacja do strony logowania z returnUrl
     */
    onLogin(): void {
        const currentUrl = this.router.url;
        this.router.navigate(['/login'], {
            queryParams: { returnUrl: currentUrl },
        });
    }

    /**
     * Nawigacja do strony rejestracji z returnUrl
     */
    onRegister(): void {
        const currentUrl = this.router.url;
        this.router.navigate(['/register'], {
            queryParams: { returnUrl: currentUrl },
        });
    }
}
