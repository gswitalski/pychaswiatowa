import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    signal,
    OnInit,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { SearchService } from '../../../core/services/search.service';
import {
    GlobalSearchResponseDto,
    SearchRecipeDto,
    SearchCollectionDto,
} from '../../../../../shared/contracts/types';

/**
 * Global search component (Omnibox) with autocomplete functionality.
 * Searches recipes and collections with debounced API calls.
 */
@Component({
    selector: 'pych-omnibox',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatAutocompleteModule,
        MatIconModule,
        MatOptionModule,
    ],
    templateUrl: './omnibox.component.html',
    styleUrl: './omnibox.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OmniboxComponent implements OnInit {
    private readonly searchService = inject(SearchService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    /** Search input control */
    searchControl = new FormControl('');

    /** Search results */
    searchResults = signal<GlobalSearchResponseDto>({ recipes: [], collections: [] });

    /** Loading state */
    isLoading = signal(false);

    /** Error state */
    hasError = signal(false);

    /** Check if there are any results */
    get hasResults(): boolean {
        const results = this.searchResults();
        return results.recipes.length > 0 || results.collections.length > 0;
    }

    ngOnInit(): void {
        this.setupSearchListener();
    }

    /**
     * Set up reactive search with debounce
     */
    private setupSearchListener(): void {
        this.searchControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                filter((query) => {
                    if (!query || query.trim().length < 2) {
                        this.searchResults.set({ recipes: [], collections: [] });
                        return false;
                    }
                    return true;
                }),
                switchMap((query) => {
                    this.isLoading.set(true);
                    this.hasError.set(false);
                    return this.searchService.searchGlobal(query!).pipe(
                        catchError(() => {
                            this.hasError.set(true);
                            return of({ recipes: [], collections: [] });
                        })
                    );
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((results) => {
                this.searchResults.set(results);
                this.isLoading.set(false);
            });
    }

    /**
     * Navigate to recipe detail page
     */
    selectRecipe(recipe: SearchRecipeDto): void {
        this.router.navigate(['/recipes', recipe.id]);
        this.clearSearch();
    }

    /**
     * Navigate to collection detail page
     */
    selectCollection(collection: SearchCollectionDto): void {
        this.router.navigate(['/collections', collection.id]);
        this.clearSearch();
    }

    /**
     * Clear search input and results
     */
    clearSearch(): void {
        this.searchControl.setValue('');
        this.searchResults.set({ recipes: [], collections: [] });
    }
}

