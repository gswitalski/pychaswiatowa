import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
    RecipeCardComponent,
    RecipeCardData,
} from '../../../../shared/components/recipe-card/recipe-card';

/**
 * Komponent sekcji listy publicznych przepisów na landing page.
 * Wyświetla nagłówek i listę kart przepisów w siatce.
 * Obsługuje stany: loading, error, empty.
 */
@Component({
    selector: 'pych-public-recipes-section',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        RecipeCardComponent,
    ],
    templateUrl: './public-recipes-section.html',
    styleUrl: './public-recipes-section.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicRecipesSectionComponent {
    /** Tytuł sekcji (np. "Najnowsze", "Polecane") */
    title = input.required<string>();

    /** Lista przepisów do wyświetlenia */
    recipes = input.required<RecipeCardData[]>();

    /** Czy sekcja jest w trakcie ładowania */
    isLoading = input<boolean>(false);

    /** Komunikat błędu (null = brak błędu) */
    errorMessage = input<string | null>(null);

    /** Emitowane gdy użytkownik kliknie "Spróbuj ponownie" */
    retry = output<void>();

    /**
     * Obsługa kliknięcia przycisku retry
     */
    onRetry(): void {
        this.retry.emit();
    }
}
