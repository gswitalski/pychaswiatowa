import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Publiczny komponent wyszukiwania przepisów na landing page.
 * Zawiera pole tekstowe z walidacją (min. 2 znaki dla niepustego query).
 * Emituje zdarzenie searchSubmit z poprawnym zapytaniem.
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
    ],
    templateUrl: './public-recipes-search.html',
    styleUrl: './public-recipes-search.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicRecipesSearchComponent {
    /** Placeholder dla pola wyszukiwania */
    placeholder = input<string>('Wyszukaj przepis...');

    /** Początkowe zapytanie (opcjonalne) */
    initialQuery = input<string>('');

    /** Emituje poprawne zapytanie wyszukiwania (min. 2 znaki) */
    searchSubmit = output<string>();

    /** FormControl dla pola wyszukiwania */
    queryControl = new FormControl<string>('', {
        nonNullable: true,
    });

    /** Signal przechowujący błąd walidacji */
    validationError = signal<string | null>(null);

    /**
     * Obsługa submitu wyszukiwania (Enter lub klik przycisku).
     * Waliduje długość zapytania i emituje zdarzenie jeśli poprawne.
     */
    onSearchSubmit(): void {
        const query = this.queryControl.value.trim();

        // Resetuj poprzedni błąd
        this.validationError.set(null);

        // Jeśli puste - możemy nawigować do /explore bez parametru
        // (lub nie robić nic - zależnie od wymagań UX)
        if (query.length === 0) {
            this.searchSubmit.emit('');
            return;
        }

        // Walidacja: min. 2 znaki dla niepustego zapytania
        if (query.length === 1) {
            this.validationError.set('Wpisz co najmniej 2 znaki');
            return;
        }

        // Emituj poprawne zapytanie
        this.searchSubmit.emit(query);
    }

    /**
     * Czyści błąd walidacji przy zmianie wartości pola
     */
    onInputChange(): void {
        if (this.validationError()) {
            this.validationError.set(null);
        }
    }
}
