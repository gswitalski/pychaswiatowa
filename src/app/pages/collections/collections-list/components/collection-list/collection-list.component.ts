import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CollectionListItemDto } from '../../../../../../../shared/contracts/types';

@Component({
    selector: 'pych-collection-list',
    standalone: true,
    imports: [
        RouterLink,
        MatListModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
    ],
    templateUrl: './collection-list.component.html',
    styleUrl: './collection-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionListComponent {
    /** Lista kolekcji do wyświetlenia */
    readonly collections = input.required<CollectionListItemDto[]>();

    /** Zdarzenie edycji kolekcji */
    readonly edit = output<CollectionListItemDto>();

    /** Zdarzenie usunięcia kolekcji */
    readonly delete = output<CollectionListItemDto>();

    /**
     * Emituje zdarzenie edycji
     */
    onEdit(collection: CollectionListItemDto, event: Event): void {
        event.stopPropagation();
        event.preventDefault();
        this.edit.emit(collection);
    }

    /**
     * Emituje zdarzenie usunięcia
     */
    onDelete(collection: CollectionListItemDto, event: Event): void {
        event.stopPropagation();
        event.preventDefault();
        this.delete.emit(collection);
    }
}
