import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RecipeListItemDto } from '../../../../../../../shared/contracts/types';

@Component({
    selector: 'pych-recipe-card',
    standalone: true,
    imports: [RouterLink, MatCardModule, MatIconModule],
    templateUrl: './recipe-card.component.html',
    styleUrl: './recipe-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCardComponent {
    /** Obiekt przepisu do wyświetlenia */
    readonly recipe = input.required<RecipeListItemDto>();

    /** Placeholder dla brakującego obrazka */
    readonly placeholderImage = '/placeholder-recipe.svg';
}

