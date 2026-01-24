import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ShoppingListGroupedItemVm } from '../../../../core/services/shopping-list.service';

/**
 * Pojedynczy wiersz listy zakupów.
 * Zapewnia:
 * - checkbox "posiadane" (is_owned)
 * - prezentację treści (RECIPE: name + amount/unit, MANUAL: text)
 * - akcję usunięcia (tylko MANUAL)
 */
@Component({
    selector: 'pych-shopping-list-item',
    standalone: true,
    imports: [
        MatListModule,
        MatCheckboxModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './shopping-list-item.component.html',
    styleUrl: './shopping-list-item.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingListItemComponent {
    /** Pozycja listy */
    item = input.required<ShoppingListGroupedItemVm>();

    /** Czy trwa toggle */
    isToggling = input<boolean>(false);

    /** Czy trwa usuwanie */
    isDeleting = input<boolean>(false);

    /** Event emitowany przy zmianie checkboxa */
    toggleOwned = output<{ groupKey: string; next: boolean }>();

    /** Event emitowany przy usunięciu ręcznej pozycji */
    deleteManual = output<number>();

    /** Event emitowany przy usunięciu grupy z przepisów */
    deleteRecipeGroup = output<string>();

    /**
     * Obsługuje zmianę checkboxa
     */
    onCheckboxChange(checked: boolean): void {
        this.toggleOwned.emit({
            groupKey: this.item().groupKey,
            next: checked,
        });
    }

    /**
     * Obsługuje kliknięcie przycisku usuwania
     */
    onDeleteClick(): void {
        const item = this.item();

        if (item.kind === 'MANUAL') {
            this.deleteManual.emit(item.id);
        } else if (item.kind === 'RECIPE') {
            this.deleteRecipeGroup.emit(item.groupKey);
        }
    }
}
