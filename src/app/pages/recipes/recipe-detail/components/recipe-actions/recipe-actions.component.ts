import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'pych-recipe-actions',
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
    templateUrl: './recipe-actions.component.html',
    styleUrl: './recipe-actions.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeActionsComponent {
    readonly editClicked = output<void>();
    readonly deleteClicked = output<void>();
    readonly addToCollectionClicked = output<void>();

    onEdit(): void {
        this.editClicked.emit();
    }

    onDelete(): void {
        this.deleteClicked.emit();
    }

    onAddToCollection(): void {
        this.addToCollectionClicked.emit();
    }
}

