import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    computed,
    effect,
    inject,
    output,
    signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { filter } from 'rxjs';
import { CollectionsApiService } from '../../../../core/services/collections-api.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { SlugService } from '../../../../shared/services/slug.service';
import {
    SidebarCollectionRecipesState,
    SidebarCollectionsTreeState,
} from './models/sidebar-collections-tree.model';

@Component({
    selector: 'pych-sidebar-collections-tree',
    standalone: true,
    imports: [MatIconModule, MatButtonModule, MatListModule],
    templateUrl: './sidebar-collections-tree.component.html',
    styleUrl: './sidebar-collections-tree.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarCollectionsTreeComponent {
    private readonly collectionsApi = inject(CollectionsApiService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    private readonly supabase = inject(SupabaseService);
    private readonly slugService = inject(SlugService);

    readonly navigationClick = output<void>();
    readonly currentUrl = signal(this.router.url);
    readonly activeRecipeId = computed(() => {
        const match = this.currentUrl().match(/\/recipes\/(\d+)(-|$)/);
        if (!match) {
            return null;
        }
        return Number(match[1]);
    });

    private readonly emptyRecipesState: SidebarCollectionRecipesState = {
        status: 'idle',
        items: [],
        errorMessage: null,
        pageInfo: null,
    };

    private readonly hasInitialized = signal(false);

    readonly state = signal<SidebarCollectionsTreeState>({
        isCollectionsExpanded: false,
        collections: [],
        collectionsLoading: false,
        collectionsError: null,
        expandedCollectionIds: new Set<number>(),
        recipesByCollectionId: new Map<number, SidebarCollectionRecipesState>(),
    });

    readonly hasCollections = computed(() => this.state().collections.length > 0);

    readonly showCollectionsEmptyState = computed(() => {
        const current = this.state();
        return !current.collectionsLoading && !current.collectionsError && current.collections.length === 0;
    });

    constructor() {
        effect(() => {
            if (this.hasInitialized()) {
                return;
            }
            this.hasInitialized.set(true);
            this.loadCollections();
        });

        this.router.events
            .pipe(
                filter((event): event is NavigationEnd => event instanceof NavigationEnd),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((event) => {
                this.currentUrl.set(event.urlAfterRedirects);
            });
    }

    onNavigateToCollections(): void {
        this.router.navigate(['/collections']);
        this.navigationClick.emit();
    }

    onToggleCollections(event: Event): void {
        event.preventDefault();
        event.stopPropagation();

        this.state.update((current) => ({
            ...current,
            isCollectionsExpanded: !current.isCollectionsExpanded,
        }));
    }

    onToggleCollection(event: Event, collectionId: number): void {
        event.preventDefault();
        event.stopPropagation();

        if (collectionId <= 0) {
            return;
        }

        const currentState = this.state();
        const wasExpanded = currentState.expandedCollectionIds.has(collectionId);
        const nextExpanded = new Set(currentState.expandedCollectionIds);

        if (wasExpanded) {
            nextExpanded.delete(collectionId);
        } else {
            nextExpanded.add(collectionId);
        }

        this.state.update((current) => ({
            ...current,
            expandedCollectionIds: nextExpanded,
        }));

        if (!wasExpanded) {
            this.loadRecipesForCollection(collectionId);
        }
    }

    onRetryLoadCollections(): void {
        this.loadCollections();
    }

    onRetryLoadRecipes(event: Event, collectionId: number): void {
        event.preventDefault();
        event.stopPropagation();

        if (collectionId <= 0) {
            return;
        }

        this.loadRecipesForCollection(collectionId, true);
    }

    onNavigateToRecipe(recipeId: number, recipeName: string): void {
        if (recipeId <= 0) {
            return;
        }

        const slug = this.slugService.slugify(recipeName);
        this.router.navigate(['/recipes', `${recipeId}-${slug}`]);
        this.navigationClick.emit();
    }

    isCollectionExpanded(collectionId: number): boolean {
        return this.state().expandedCollectionIds.has(collectionId);
    }

    isCollectionsRouteActive(): boolean {
        return this.currentUrl().startsWith('/collections');
    }

    isRecipeActive(recipeId: number): boolean {
        return this.activeRecipeId() === recipeId;
    }

    isCollectionActive(collectionId: number): boolean {
        const activeRecipeId = this.activeRecipeId();
        if (!activeRecipeId) {
            return false;
        }
        return this.getRecipesState(collectionId).items.some(
            (recipe) => recipe.id === activeRecipeId
        );
    }

    getRecipesState(collectionId: number): SidebarCollectionRecipesState {
        return this.state().recipesByCollectionId.get(collectionId) ?? this.emptyRecipesState;
    }

    getRecipeImageUrl(imagePath: string): string | null {
        if (!imagePath) {
            return null;
        }

        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }

        const { data } = this.supabase.storage
            .from('recipe-images')
            .getPublicUrl(imagePath);

        return data?.publicUrl ?? null;
    }

    private loadCollections(): void {
        this.state.update((current) => ({
            ...current,
            collectionsLoading: true,
            collectionsError: null,
        }));

        this.collectionsApi.getCollections()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (collections) => {
                    this.state.update((current) => ({
                        ...current,
                        collections,
                        collectionsLoading: false,
                    }));
                },
                error: (error: Error & { status?: number }) => {
                    this.state.update((current) => ({
                        ...current,
                        collectionsLoading: false,
                        collectionsError: this.resolveCollectionsErrorMessage(error),
                    }));
                },
            });
    }

    private loadRecipesForCollection(collectionId: number, forceReload = false): void {
        const currentRecipesState = this.getRecipesState(collectionId);
        if (!forceReload) {
            if (currentRecipesState.status === 'loading' || currentRecipesState.status === 'ready') {
                return;
            }
        }

        this.updateRecipesState(collectionId, {
            status: 'loading',
            errorMessage: null,
        });

        this.collectionsApi
            .getCollectionRecipesForSidebar(collectionId, 500, 'name.asc')
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (response) => {
                    this.updateRecipesState(collectionId, {
                        status: 'ready',
                        items: response.data ?? [],
                        pageInfo: response.pageInfo ?? null,
                        errorMessage: null,
                    });
                },
                error: (error: Error & { status?: number }) => {
                    this.updateRecipesState(collectionId, {
                        status: 'error',
                        errorMessage: this.resolveRecipesErrorMessage(error),
                    });
                },
            });
    }

    private updateRecipesState(
        collectionId: number,
        patch: Partial<SidebarCollectionRecipesState>
    ): void {
        this.state.update((current) => {
            const recipesByCollectionId = new Map(current.recipesByCollectionId);
            const existing = recipesByCollectionId.get(collectionId) ?? this.emptyRecipesState;

            recipesByCollectionId.set(collectionId, {
                ...existing,
                ...patch,
            });

            return {
                ...current,
                recipesByCollectionId,
            };
        });
    }

    private resolveCollectionsErrorMessage(error: Error & { status?: number }): string {
        if (error?.status === 403) {
            return 'Nie masz dostępu do kolekcji.';
        }
        if (error?.status === 404) {
            return 'Nie znaleziono kolekcji.';
        }
        return error?.message || 'Wystąpił błąd. Spróbuj ponownie.';
    }

    private resolveRecipesErrorMessage(error: Error & { status?: number }): string {
        if (error?.status === 403) {
            return 'Nie masz dostępu do przepisów w tej kolekcji.';
        }
        if (error?.status === 404) {
            return 'Nie znaleziono przepisów w tej kolekcji.';
        }
        return error?.message || 'Wystąpił błąd. Spróbuj ponownie.';
    }
}
