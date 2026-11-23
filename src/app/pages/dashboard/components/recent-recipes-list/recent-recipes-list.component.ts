import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
    RecipeCardComponent,
    RecipeCardData,
} from '../../../../shared/components/recipe-card/recipe-card';
import { RecipeListItemDto } from '../../../../../../shared/contracts/types';
import { mapRecipeListItemToCardData } from '../../../../shared/components/recipe-card/recipe-card.mapper';

@Component({
    selector: 'pych-recent-recipes-list',
    standalone: true,
    imports: [RouterLink, MatButtonModule, MatIconModule, RecipeCardComponent],
    templateUrl: './recent-recipes-list.component.html',
    styleUrl: './recent-recipes-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentRecipesListComponent {
    @Input() recipes: RecipeListItemDto[] = [];

    get hasRecipes(): boolean {
        return this.recipes.length > 0;
    }

    toCardData(recipe: RecipeListItemDto): RecipeCardData {
        return mapRecipeListItemToCardData(recipe, recipe.category_name ?? null);
    }
}


