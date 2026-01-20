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
import { ShoppingListItemVm } from '../../../../core/services/shopping-list.service';

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
    item = input.required<ShoppingListItemVm>();

    /** Czy trwa toggle */
    isToggling = input<boolean>(false);

    /** Czy trwa usuwanie */
    isDeleting = input<boolean>(false);

    /** Event emitowany przy zmianie checkboxa */
    toggleOwned = output<{ id: number; next: boolean }>();

    /** Event emitowany przy usunięciu */
    deleteManual = output<number>();

    /**
     * Obsługuje zmianę checkboxa
     */
    onCheckboxChange(checked: boolean): void {
        this.toggleOwned.emit({
            id: this.item().id,
            next: checked,
        });
    }

    /**
     * Obsługuje kliknięcie przycisku usuwania
     */
    onDeleteClick(): void {
        this.deleteManual.emit(this.item().id);
    }
}
