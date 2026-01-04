import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    effect,
    inject,
    OnInit,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PublicRecipesFacade } from '../../../explore/services/public-recipes.facade';
import { PublicRecipesSearchContext } from '../../../explore/models/public-recipes-search.model';
import { PublicRecipeResultsComponent } from '../public-recipe-results/public-recipe-results';

/**
 * Publiczny komponent wyszukiwania przepisów.
 * Reużywalny na Landing Page (/) i Explore (/explore).
 *
 * Obsługuje:
 * - Wyszukiwanie z debounce (300-400ms)
 * - Tryb feed (pusta fraza) vs search (≥3 znaki)
 * - Renderowanie wyników z paginacją cursor-based
 * - Wskazówki dla krótkiej frazy (1-2 znaki)
 */
@Component({
    selector: 'pych-public-recipes-search',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        PublicRecipeResultsComponent,
    ],
    providers: [PublicRecipesFacade],
    templateUrl: './public-recipes-search.html',
    styleUrl: './public-recipes-search.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicRecipesSearchComponent implements OnInit {
    private readonly facade = inject(PublicRecipesFacade);

    // ==================== Inputs ====================

    /** Kontekst wyszukiwania (wymagane) - determinuje zachowanie pustej frazy */
    readonly context = input.required<PublicRecipesSearchContext>();

    /** Początkowe zapytanie (opcjonalne) */
    readonly initialQuery = input<string>('');

    /** Placeholder dla pola wyszukiwania */
    readonly placeholder = input<string>('Szukaj przepisów...');

    /** Czas debounce w ms (opcjonalne, domyślnie 350) */
    readonly debounceMs = input<number>(350);

    /** Rozmiar strony (opcjonalne, domyślnie 12) */
    readonly pageSize = input<number>(12);

    /** Czy pokazywać wyniki (false = tylko input, deleguje wyświetlanie wyników do rodzica) */
    readonly showResults = input<boolean>(true);

    // ==================== Outputs ====================

    /** Emituje zapytanie po walidacji (dla trybu bez showResults) */
    readonly searchSubmit = output<string>();

    // ==================== FormControl ====================

    /** FormControl dla pola wyszukiwania */
    readonly queryControl = new FormControl<string>('', {
        nonNullable: true,
    });

    // ==================== Exposed Facade State ====================

    /** ViewModel z facade */
    readonly vm = this.facade.vm;

    /** Tryb wyszukiwania */
    readonly mode = this.facade.mode;

    /** Czy widoczna wskazówka krótkiej frazy */
    readonly shortQueryHintVisible = this.facade.shortQueryHintVisible;

    /** Lista przepisów */
    readonly items = this.facade.items;

    /** Informacje o paginacji */
    readonly pageInfo = this.facade.pageInfo;

    /** Loading states */
    readonly loadingInitial = this.facade.loadingInitial;
    readonly loadingMore = this.facade.loadingMore;

    /** Błąd */
    readonly errorMessage = this.facade.errorMessage;

    constructor() {
        // Effect do synchronizacji initialQuery z FormControl
        effect(() => {
            const initial = this.initialQuery();
            if (initial && initial !== this.queryControl.value) {
                this.queryControl.setValue(initial, { emitEvent: false });
            }
        });
    }

    ngOnInit(): void {
        // Inicjalizuj facade
        this.facade.initialize(
            this.context(),
            this.debounceMs(),
            this.pageSize(),
            this.initialQuery()
        );
    }

    // ==================== Event Handlers ====================

    /**
     * Obsługa zmiany wartości w polu input.
     * Aktualizuje queryDraft w facade (uruchamia debounced processing).
     */
    onInputChange(): void {
        const query = this.queryControl.value;
        this.facade.updateQueryDraft(query);
    }

    /**
     * Obsługa submitu wyszukiwania (Enter lub klik przycisku).
     * Wymusza natychmiastowe przetworzenie (pomija debounce).
     */
    onSearchSubmit(): void {
        const query = this.queryControl.value.trim();

        // Walidacja: min. 3 znaki dla niepustego zapytania
        if (query.length >= 1 && query.length < 3) {
            // Nie robimy nic - wskazówka jest widoczna przez shortQueryHintVisible
            return;
        }

        // Wymusz natychmiastowe przetworzenie
        this.facade.submitQueryImmediate(query);

        // Emituj dla trybu bez showResults (legacy support dla landing)
        if (!this.showResults()) {
            this.searchSubmit.emit(query);
        }
    }

    /**
     * Obsługa kliknięcia "Więcej".
     */
    onLoadMore(): void {
        this.facade.loadMore();
    }

    /**
     * Obsługa ponowienia po błędzie.
     */
    onRetry(): void {
        this.facade.retry();
    }
}
