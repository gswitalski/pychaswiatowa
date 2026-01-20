import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { ShoppingListItemVm } from '../../../../core/services/shopping-list.service';
import { ShoppingListItemComponent } from '../shopping-list-item/shopping-list-item.component';

/**
 * Kontener listy zakupów.
 * Renderuje listę pozycji, już posortowaną wg reguł MVP.
 */
@Component({
    selector: 'pych-shopping-list',
    standalone: true,
    imports: [
        MatListModule,
        MatDividerModule,
        ShoppingListItemComponent,
    ],
    templateUrl: './shopping-list.component.html',
    styleUrl: './shopping-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingListComponent {
    /** Lista pozycji (posortowana) */
    items = input.required<ShoppingListItemVm[]>();

    /** ID elementów w trakcie toggle */
    toggleInProgressIds = input.required<Set<number>>();

    /** ID elementów w trakcie usuwania */
    deleteInProgressIds = input.required<Set<number>>();

    /** Event emitowany przy zmianie stanu "posiadane" */
    toggleOwned = output<{ id: number; next: boolean }>();

    /** Event emitowany przy usunięciu ręcznej pozycji */
    deleteManual = output<number>();

    /**
     * Sprawdza czy element jest w trakcie toggle
     */
    isToggling(id: number): boolean {
        return this.toggleInProgressIds().has(id);
    }

    /**
     * Sprawdza czy element jest w trakcie usuwania
     */
    isDeleting(id: number): boolean {
        return this.deleteInProgressIds().has(id);
    }

    /**
     * Obsługuje toggle owned
     */
    onToggleOwned(event: { id: number; next: boolean }): void {
        this.toggleOwned.emit(event);
    }

    /**
     * Obsługuje usunięcie
     */
    onDeleteManual(id: number): void {
        this.deleteManual.emit(id);
    }
}
