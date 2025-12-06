import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'pych-recipe-image',
    standalone: true,
    imports: [MatIconModule],
    templateUrl: './recipe-image.component.html',
    styleUrl: './recipe-image.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeImageComponent {
    readonly imageUrl = input<string | null>(null);
    readonly recipeName = input<string>('');
}

