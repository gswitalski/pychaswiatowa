import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RecipeListItemDto } from '../../../../../../../shared/contracts/types';
import { RecipeCardComponent } from '../recipe-card/recipe-card.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
    selector: 'pych-recipe-list',
    standalone: true,
    imports: [RecipeCardComponent, EmptyStateComponent, MatProgressSpinnerModule],
    templateUrl: './recipe-list.component.html',
    styleUrl: './recipe-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeListComponent {
    /** Lista przepisów do wyświetlenia */
    readonly recipes = input.required<RecipeListItemDto[]>();

    /** Flaga informująca o stanie ładowania */
    readonly isLoading = input<boolean>(false);
}

