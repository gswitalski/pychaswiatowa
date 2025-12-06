import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RecipeContent } from '../../../../../../../shared/contracts/types';

@Component({
    selector: 'pych-recipe-content-list',
    standalone: true,
    imports: [],
    templateUrl: './recipe-content-list.component.html',
    styleUrl: './recipe-content-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeContentListComponent {
    readonly title = input.required<string>();
    readonly content = input.required<RecipeContent>();
}

