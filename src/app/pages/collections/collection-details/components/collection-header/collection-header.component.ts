import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Typ danych przekazywanych do nagłówka kolekcji
 */
export interface CollectionHeaderData {
    name: string;
    description: string | null;
}

@Component({
    selector: 'pych-collection-header',
    standalone: true,
    imports: [MatIconModule],
    templateUrl: './collection-header.component.html',
    styleUrl: './collection-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionHeaderComponent {
    /** Dane kolekcji do wyświetlenia */
    readonly collectionData = input.required<CollectionHeaderData>();
}


