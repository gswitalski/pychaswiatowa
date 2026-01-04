import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    input,
    OnInit,
    output,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { CategoryDto, TagDto } from '../../../../../../../shared/contracts/types';
import { RecipesFiltersViewModel, SortOption } from '../../models/recipes-filters.model';

@Component({
    selector: 'pych-recipes-filters',
    standalone: true,
    imports: [
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatIconModule,
        MatChipsModule,
        MatAutocompleteModule,
    ],
    templateUrl: './recipes-filters.component.html',
    styleUrl: './recipes-filters.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipesFiltersComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);

    /** Początkowy stan filtrów */
    readonly initialFilters = input.required<RecipesFiltersViewModel>();

    /** Lista dostępnych kategorii */
    readonly categories = input.required<CategoryDto[]>();

    /** Lista dostępnych tagów do autouzupełniania */
    readonly tags = input.required<TagDto[]>();

    /** Zdarzenie emitowane przy każdej zmianie filtrów */
    readonly filtersChange = output<RecipesFiltersViewModel>();

    /** Subject do obsługi debounce wyszukiwania */
    private readonly searchSubject = new Subject<string>();

    /** Wewnętrzny stan filtrów */
    private readonly _searchQuery = signal<string>('');
    private readonly _categoryId = signal<number | null>(null);
    private readonly _selectedTags = signal<string[]>([]);
    private readonly _sortOption = signal<SortOption>('created_at_desc');
    private readonly _termorobot = signal<boolean | null>(null);
    private readonly _grill = signal<boolean | null>(null);

    /** Input dla nowego tagu */
    readonly tagInput = signal<string>('');

    /** Opcje sortowania */
    readonly sortOptions: { value: SortOption; label: string }[] = [
        { value: 'created_at_desc', label: 'Najnowsze' },
        { value: 'created_at_asc', label: 'Najstarsze' },
        { value: 'name_asc', label: 'Nazwa A-Z' },
        { value: 'name_desc', label: 'Nazwa Z-A' },
    ];

    /** Filtrowane tagi dla autouzupełniania */
    readonly filteredTags = computed(() => {
        const input = this.tagInput().toLowerCase();
        const selected = this._selectedTags();

        return this.tags().filter(
            (tag) =>
                tag.name.toLowerCase().includes(input) &&
                !selected.includes(tag.name)
        );
    });

    /** Gettery dla szablonu */
    get searchQuery(): string {
        return this._searchQuery();
    }

    get categoryId(): number | null {
        return this._categoryId();
    }

    get selectedTags(): string[] {
        return this._selectedTags();
    }

    get sortOption(): SortOption {
        return this._sortOption();
    }

    get termorobot(): boolean | null {
        return this._termorobot();
    }

    get grill(): boolean | null {
        return this._grill();
    }

    constructor() {
        // Inicjalizacja stanu z initialFilters
        effect(() => {
            const filters = this.initialFilters();
            this._searchQuery.set(filters.searchQuery ?? '');
            this._categoryId.set(filters.categoryId);
            this._selectedTags.set([...filters.tags]);
            this._sortOption.set(
                `${filters.sortBy}_${filters.sortDirection}` as SortOption
            );
            this._termorobot.set(filters.termorobot);
            this._grill.set(filters.grill);
        }, { allowSignalWrites: true });
    }

    ngOnInit(): void {
        // Debounce dla wyszukiwania
        this.searchSubject
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((value) => {
                this._searchQuery.set(value);
                this.emitFilters();
            });
    }

    onSearchInput(value: string): void {
        this.searchSubject.next(value);
    }

    onCategoryChange(categoryId: number | null): void {
        this._categoryId.set(categoryId);
        this.emitFilters();
    }

    onSortChange(sortOption: SortOption): void {
        this._sortOption.set(sortOption);
        this.emitFilters();
    }

    onTagInputChange(value: string): void {
        this.tagInput.set(value);
    }

    addTag(tagName: string): void {
        const normalizedTag = tagName.trim().toLowerCase();

        if (normalizedTag && !this._selectedTags().includes(normalizedTag)) {
            this._selectedTags.update((tags) => [...tags, normalizedTag]);
            this.tagInput.set('');
            this.emitFilters();
        }
    }

    removeTag(tagName: string): void {
        this._selectedTags.update((tags) => tags.filter((t) => t !== tagName));
        this.emitFilters();
    }

    onTermorobotChange(value: boolean | null): void {
        this._termorobot.set(value);
        this.emitFilters();
    }

    onGrillChange(value: boolean | null): void {
        this._grill.set(value);
        this.emitFilters();
    }

    private emitFilters(): void {
        const sortOption = this._sortOption();
        // Znajdź ostatni underscore żeby poprawnie rozdzielić 'created_at_desc'
        const lastUnderscoreIndex = sortOption.lastIndexOf('_');
        const sortBy = sortOption.substring(0, lastUnderscoreIndex) as 'name' | 'created_at';
        const sortDirection = sortOption.substring(lastUnderscoreIndex + 1) as 'asc' | 'desc';

        const filters: RecipesFiltersViewModel = {
            searchQuery: this._searchQuery() || null,
            categoryId: this._categoryId(),
            tags: this._selectedTags(),
            sortBy,
            sortDirection,
            termorobot: this._termorobot(),
            grill: this._grill(),
        };

        this.filtersChange.emit(filters);
    }
}

