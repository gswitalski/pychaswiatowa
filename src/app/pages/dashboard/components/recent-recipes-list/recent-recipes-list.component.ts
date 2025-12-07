import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RecipeListItemDto } from '../../../../../../shared/contracts/types';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'pych-recent-recipes-list',
    standalone: true,
    imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, DatePipe],
    templateUrl: './recent-recipes-list.component.html',
    styleUrl: './recent-recipes-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentRecipesListComponent {
    @Input() recipes: RecipeListItemDto[] = [];

    get hasRecipes(): boolean {
        return this.recipes.length > 0;
    }
}


