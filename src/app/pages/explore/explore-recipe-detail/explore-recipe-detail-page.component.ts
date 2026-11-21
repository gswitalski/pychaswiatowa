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
import { map, finalize, combineLatest } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

import { ExploreRecipesService } from '../../../core/services/explore-recipes.service';
import { RecipesService } from '../../recipes/services/recipes.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MyPlanService } from '../../../core/services/my-plan.service';
import { SlugService } from '../../../shared/services/slug.service';
import {
    RecipeDetailDto,
    ApiError,
    RecipeFlagsDto,
    RecipeRatingDto,
    RecipeNoteResponseDto,
} from '../../../../../shared/contracts/types';
import { PlanChangeEvent } from '../../../core/services/my-plan.service';

import {
    ConfirmDialogComponent,
    ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
    AddToCollectionDialogComponent,
    AddToCollectionDialogData,
    AddToCollectionDialogResult,
} from '../../../shared/components/add-to-collection-dialog/add-to-collection-dialog.component';
import {
    RecipeDetailHeaderMode,
    RecipeDetailViewComponent,
} from '../../../shared/components/recipe-detail-view/recipe-detail-view.component';

/**
 * Stan komponentu szczegółów przepisu explore
 */
interface ExploreRecipeDetailState {
    recipe: RecipeDetailDto | null;
    isLoading: boolean;
    error: ApiError | null;
}

/**
 * Komponent strony szczegółów przepisu w kontekście explore (publiczny widok).
 * Używany dla ścieżki /explore/recipes/:id.
 *
 * Zasada dostępu:
 * - visibility=PUBLIC → dostępne dla wszystkich (także gości)
 * - visibility!=PUBLIC → dostępne tylko dla zalogowanego autora
 * - pozostałe przypadki → 404
 */
@Component({
    selector: 'pych-explore-recipe-detail-page',
    standalone: true,
    imports: [
        RecipeDetailViewComponent,
    ],
    templateUrl: './explore-recipe-detail-page.component.html',
    styleUrl: './explore-recipe-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreRecipeDetailPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly exploreRecipesService = inject(ExploreRecipesService);
    private readonly recipesService = inject(RecipesService);
    private readonly supabase = inject(SupabaseService);
    private readonly myPlanService = inject(MyPlanService);
    private readonly slugService = inject(SlugService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);
    private readonly destroyRef = inject(DestroyRef);

    readonly state = signal<ExploreRecipeDetailState>({
        recipe: null,
        isLoading: true,
        error: null,
    });

    /** Czy użytkownik jest zalogowany */
    readonly isAuthenticated = signal<boolean>(false);

    /** ID aktualnie zalogowanego użytkownika (null jeśli gość) */
    readonly currentUserId = signal<string | null>(null);

    /** Czy trwa dodawanie przepisu do planu */
    readonly isAddingToPlan = signal<boolean>(false);

    readonly recipe = computed(() => this.state().recipe);
    readonly isLoading = computed(() => this.state().isLoading);
    readonly error = computed(() => this.state().error);
    readonly hasRecipe = computed(() => this.state().recipe !== null);
    private requestId = 0;

    /** Tytuł strony - nazwa przepisu lub fallback */
    readonly pageTitle = computed(() => {
        const recipe = this.state().recipe;
        if (!recipe) return 'Szczegóły przepisu';
        const variant = recipe.active_variant_count >= 2 ? recipe.variant_name : null;
        return variant ? `${recipe.name} · ${variant}` : (recipe.name ?? 'Szczegóły przepisu');
    });

    /**
     * Czy aktualnie zalogowany użytkownik jest właścicielem przepisu
     */
    readonly isOwner = computed(() => {
        const recipe = this.recipe();
        const userId = this.currentUserId();

        if (!recipe || !userId) return false;
        return recipe.user_id === userId;
    });

    /**
     * Tryb nagłówka - określa jakie akcje są dostępne
     */
    readonly headerMode = computed<RecipeDetailHeaderMode>(() => {
        if (!this.isAuthenticated()) {
            return 'guest';
        }
        return this.isOwner() ? 'ownerActions' : 'addToCollection';
    });

    async ngOnInit(): Promise<void> {
        // Sprawdź stan uwierzytelnienia
        await this.checkAuthStatus();

        // Subskrybuj się na zmiany w planie
        this.subscribeToPlanChanges();

        // Subskrybuj się na zmiany parametrów w URL
        combineLatest([this.route.paramMap, this.route.queryParamMap])
            .pipe(
                map(([params, queryParams]) => ({
                    id: params.get('id'),
                    slug: params.get('slug'),
                    variant: this.parseVariant(queryParams.get('variant')),
                })),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(({ id: idParam, slug, variant }) => {
                if (!idParam) {
                    this.handleInvalidId();
                    return;
                }

                const id = parseInt(idParam, 10);

                if (isNaN(id) || id <= 0) {
                    this.handleInvalidId();
                    return;
                }

                this.loadRecipe(id, slug ?? undefined, variant);
            });
    }

    /**
     * Subskrybuje się na zmiany w planie i aktualizuje lokalny stan przepisu
     */
    private subscribeToPlanChanges(): void {
        this.myPlanService.planChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((event: PlanChangeEvent) => {
                const currentRecipe = this.recipe();
                if (!currentRecipe || currentRecipe.id === null) {
                    return;
                }

                // Wyczyść plan - wszystkie przepisy wypadają z planu
                if (event.type === 'cleared') {
                    this.state.update((s) => ({
                        ...s,
                        recipe: s.recipe ? { ...s.recipe, in_my_plan: false } : null,
                    }));
                    return;
                }

                // Jeśli zdarzenie dotyczy aktualnie wyświetlanego przepisu, zaktualizuj stan
                if (event.recipeId === currentRecipe.id) {
                    const newInMyPlan = event.type === 'added';
                    this.state.update((s) => ({
                        ...s,
                        recipe: s.recipe ? { ...s.recipe, in_my_plan: newInMyPlan } : null,
                    }));
                }
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

            if (session?.user) {
                this.isAuthenticated.set(true);
                this.currentUserId.set(session.user.id);
            } else {
                this.isAuthenticated.set(false);
                this.currentUserId.set(null);
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.isAuthenticated.set(false);
            this.currentUserId.set(null);
        }
    }

    /**
     * Ładuje przepis przez endpoint explore
     * (opcjonalne uwierzytelnienie - PUBLIC dla wszystkich, nie-PUBLIC tylko dla autora)
     * 
     * @param id ID przepisu
     * @param slug Slug z URL (może być niepoprawny lub undefined)
     */
    private loadRecipe(id: number, slug?: string, variant?: number): void {
        const requestId = ++this.requestId;
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        this.exploreRecipesService.getExploreRecipeById(id, variant).subscribe({
            next: (recipe) => {
                if (requestId !== this.requestId) return;
                // Normalizacja sluga - jeśli slug w URL różni się od oczekiwanego
                const expectedSlug = this.slugService.slugify(recipe.name ?? 'przepis');
                
                if (slug !== expectedSlug) {
                    // Nawiguj do kanonicznego URL z replaceUrl
                    const resolvedPathId =
                        recipe.variant_resolution?.reason === 'VARIANT_DELETED' && recipe.id !== id
                            ? recipe.id
                            : id;
                    const canonicalPath = `/explore/recipes/${resolvedPathId}-${expectedSlug}`;
                    const urlTree = this.router.createUrlTree([canonicalPath], {
                        queryParams: this.route.snapshot.queryParams,
                        queryParamsHandling: 'merge',
                    });
                    
                    this.router.navigateByUrl(urlTree, { replaceUrl: true });
                    return;
                }

                this.state.update((s) => ({
                    ...s,
                    recipe,
                    isLoading: false,
                }));
                if (recipe.variant_resolution) {
                    this.router.navigate([], {
                        queryParams: { variant: null },
                        queryParamsHandling: 'merge',
                        replaceUrl: true,
                    });
                }
            },
            error: (err) => {
                if (requestId !== this.requestId) return;
                this.handleLoadError(err);
            },
        });
    }

    private parseVariant(value: string | null): number | undefined {
        if (!value) return undefined;
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    }

    onVariantSelected(variantId: number): void {
        const recipe = this.recipe();
        const id = Number(this.route.snapshot.paramMap.get('id'));
        if (!recipe || !Number.isInteger(variantId) || variantId <= 0 || !Number.isInteger(id)) return;
        this.router.navigate([], {
            queryParams: { variant: variantId },
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
        this.loadRecipe(id, this.route.snapshot.paramMap.get('slug') ?? undefined, variantId);
    }

    onDismissVariantResolution(): void {
        this.state.update((state) => ({
            ...state,
            recipe: state.recipe ? { ...state.recipe, variant_resolution: null } : null,
        }));
    }

    /**
     * Obsługuje błąd ładowania przepisu
     */
    private handleLoadError(err: Error & { status?: number }): void {
        let message = err.message || 'Wystąpił nieoczekiwany błąd';
        const status = err.status || 500;

        // Specjalne komunikaty dla różnych statusów
        if (status === 404) {
            if (!this.isAuthenticated()) {
                message = 'Ten przepis nie został znaleziony lub jest prywatny. Zaloguj się, aby uzyskać dostęp.';
            } else {
                message = 'Przepis nie został znaleziony lub nie masz do niego dostępu.';
            }
        }

        const apiError: ApiError = { message, status };
        this.state.update((s) => ({
            ...s,
            error: apiError,
            isLoading: false,
        }));
    }

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

    onEdit(): void {
        const recipe = this.recipe();
        if (recipe && this.isOwner()) {
            this.router.navigate(['/recipes', recipe.id, 'edit']);
        }
    }

    onDelete(): void {
        const recipe = this.recipe();
        if (!recipe || recipe.id === null || !this.isOwner()) return;

        const recipeName = recipe.name ?? 'Bez nazwy';
        const recipeId = recipe.id;

        const dialogData: ConfirmDialogData = {
            title: 'Usuń przepis',
            message: `Czy na pewno chcesz usunąć przepis "${recipeName}" wraz z ${recipe.active_variant_count} wariantami? Ta operacja jest nieodwracalna.`,
            confirmText: 'Usuń',
            cancelText: 'Anuluj',
            confirmColor: 'warn',
        };

        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: dialogData,
            width: '400px',
        });

        dialogRef.afterClosed().subscribe((confirmed: boolean) => {
            if (confirmed) {
                this.deleteRecipe(recipeId);
            }
        });
    }

    private deleteRecipe(id: number): void {
        this.recipesService.deleteRecipe(id).subscribe({
            next: () => {
                this.snackBar.open('Przepis został usunięty', 'OK', {
                    duration: 3000,
                });
                this.router.navigate(['/my-recipies']);
            },
            error: (err) => {
                this.snackBar.open(
                    err.message || 'Nie udało się usunąć przepisu',
                    'OK',
                    { duration: 5000 }
                );
            },
        });
    }

    onAddToCollection(): void {
        const recipe = this.recipe();
        if (!recipe || recipe.id === null || !this.isAuthenticated()) return;

        const dialogData: AddToCollectionDialogData = {
            recipeId: recipe.id,
            recipeName: recipe.name ?? 'Bez nazwy',
            initialCollectionIds: recipe.collection_ids ?? [],
        };

        const dialogRef = this.dialog.open(AddToCollectionDialogComponent, {
            data: dialogData,
            width: '600px',
            maxWidth: '90vw',
        });

        dialogRef.afterClosed().subscribe((result: AddToCollectionDialogResult) => {
            if (result?.action === 'saved') {
                this.snackBar.open(
                    'Zapisano kolekcje dla przepisu',
                    'OK',
                    { duration: 3000 }
                );
                // Zaktualizuj collection_ids w aktualnym stanie przepisu
                if (result.collection_ids !== undefined) {
                    this.state.update((s) => ({
                        ...s,
                        recipe: s.recipe ? {
                            ...s.recipe,
                            collection_ids: result.collection_ids!,
                        } : null,
                    }));
                }
            }
        });
    }

    /**
     * Powrót do strony explore
     */
    onBackToExplore(): void {
        this.router.navigate(['/explore']);
    }

    onFlagsChange(flags: RecipeFlagsDto): void {
        this.state.update((state) => ({
            ...state,
            recipe: state.recipe
                ? {
                    ...state.recipe,
                    is_favorite: flags.is_favorite,
                    is_want_to_try: flags.is_want_to_try,
                }
                : null,
        }));
    }

    onRatingChange(rating: RecipeRatingDto): void {
        this.state.update((state) => ({
            ...state,
            recipe: state.recipe
                ? {
                    ...state.recipe,
                    my_rating: rating.my_rating,
                    average_rating: rating.average_rating,
                    ratings_count: rating.ratings_count,
                }
                : null,
        }));
    }

    onNoteChange(note: RecipeNoteResponseDto): void {
        this.state.update((state) => {
            if (!state.recipe || state.recipe.id !== note.recipe_id) {
                return state;
            }
            return { ...state, recipe: { ...state.recipe, my_note: note.note } };
        });
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

    /**
     * Dodaje przepis do planu użytkownika
     */
    onAddToPlan(): void {
        const recipe = this.recipe();

        // Guard clauses
        if (!recipe || recipe.id === null) {
            console.warn('[ExploreRecipeDetailPage] Cannot add to plan: no recipe loaded');
            return;
        }

        if (!this.isAuthenticated()) {
            console.warn('[ExploreRecipeDetailPage] Cannot add to plan: user not authenticated');
            return;
        }

        if (recipe.in_my_plan) {
            // Już w planie - otwórz drawer zamiast dodawać ponownie
            this.onOpenPlan();
            return;
        }

        // Rozpocznij dodawanie
        this.isAddingToPlan.set(true);

        this.myPlanService
            .addToPlan({ recipe_id: recipe.id })
            .pipe(
                finalize(() => {
                    // Zawsze zdejmij spinner po zakończeniu (sukces lub błąd)
                    this.isAddingToPlan.set(false);
                })
            )
            .subscribe({
                next: () => {
                    // Sukces - zaktualizuj stan lokalny
                    this.state.update((s) => ({
                        ...s,
                        recipe: s.recipe ? { ...s.recipe, in_my_plan: true } : null,
                    }));

                    this.snackBar.open('Dodano do planu', 'OK', {
                        duration: 3000,
                    });
                },
                error: (err: ApiError) => {
                    // Obsługa błędów zgodnie z planem implementacji
                    if (err.status === 409) {
                        // Duplikat - potraktuj jako "już w planie"
                        this.state.update((s) => ({
                            ...s,
                            recipe: s.recipe ? { ...s.recipe, in_my_plan: true } : null,
                        }));
                        this.snackBar.open('Ten przepis jest już w Twoim planie.', 'OK', {
                            duration: 3000,
                        });
                    } else if (err.status === 422) {
                        // Limit 50
                        this.snackBar.open(
                            'Plan ma już 50 przepisów. Usuń coś z planu i spróbuj ponownie.',
                            'OK',
                            { duration: 5000 }
                        );
                    } else if (err.status === 401) {
                        // Sesja wygasła
                        this.snackBar.open('Sesja wygasła. Zaloguj się ponownie.', 'OK', {
                            duration: 5000,
                        });
                        this.onLogin();
                    } else {
                        // Inny błąd
                        this.snackBar.open(
                            err.message || 'Nie udało się dodać do planu. Spróbuj ponownie.',
                            'OK',
                            { duration: 5000 }
                        );
                    }
                    console.error('[ExploreRecipeDetailPage] Error adding to plan:', err);
                },
            });
    }

    /**
     * Otwiera drawer "Mój plan"
     */
    onOpenPlan(): void {
        this.myPlanService.openDrawer();
    }
}
