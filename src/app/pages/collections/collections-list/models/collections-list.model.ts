import { FormControl } from '@angular/forms';
import { CollectionListItemDto } from '../../../../../../shared/contracts/types';

/**
 * Definiuje kształt stanu dla CollectionsListPageComponent
 */
export interface CollectionsListState {
    collections: CollectionListItemDto[];
    isLoading: boolean;
    error: string | null;
}

/**
 * Definiuje strukturę formularza reaktywnego dla kolekcji
 */
export interface CollectionFormViewModel {
    name: FormControl<string>;
    description: FormControl<string | null>;
}

/**
 * Dane przekazywane do dialogu formularza kolekcji
 */
export interface CollectionFormDialogData {
    mode: 'create' | 'edit';
    collection?: CollectionListItemDto;
}
