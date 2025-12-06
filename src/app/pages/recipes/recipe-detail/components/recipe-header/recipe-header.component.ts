import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { RecipeDetailDto } from '../../../../../../../shared/contracts/types';

@Component({
    selector: 'pych-recipe-header',
    standalone: true,
    imports: [RouterLink, MatChipsModule],
    templateUrl: './recipe-header.component.html',
    styleUrl: './recipe-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeHeaderComponent {
    readonly recipe = input.required<RecipeDetailDto>();
}

