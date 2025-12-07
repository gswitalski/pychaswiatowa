import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { RecipeListItemDto } from '../../../../../../../shared/contracts/types';

@Component({
    selector: 'pych-recipe-card',
    standalone: true,
    imports: [RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatMenuModule],
    templateUrl: './recipe-card.component.html',
    styleUrl: './recipe-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCardComponent {
    /** Obiekt przepisu do wyświetlenia */
    readonly recipe = input.required<RecipeListItemDto>();

    /** Czy pokazać przycisk akcji usuwania */
    readonly showRemoveAction = input<boolean>(false);

    /** Event emitowany po kliknięciu opcji usunięcia */
    readonly remove = output<void>();

    /** Placeholder dla brakującego obrazka */
    readonly placeholderImage = '/placeholder-recipe.svg';

    /**
     * Obsługuje kliknięcie przycisku menu (zapobiega nawigacji)
     */
    onMenuClick(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
    }

    /**
     * Emituje event usunięcia przepisu z kolekcji
     */
    onRemoveClick(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.remove.emit();
    }
}

