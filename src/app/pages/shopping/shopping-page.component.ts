import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ShoppingListService } from '../../core/services/shopping-list.service';
import { ShoppingAddItemFormComponent } from './components/shopping-add-item-form/shopping-add-item-form.component';
import { ShoppingListComponent } from './components/shopping-list/shopping-list.component';
import { ApiError } from '../../../../shared/contracts/types';

/**
 * Główny widok listy zakupów (/shopping).
 * Odpowiada za:
 * - inicjalne pobranie listy zakupów
 * - renderowanie stanów: loading / error / empty / content
 * - przekazywanie danych i handlerów do komponentów dzieci
 * - komunikaty użytkownika (Snackbar) dla sukcesów/błędów
 */
@Component({
    selector: 'pych-shopping-page',
    standalone: true,
    imports: [
        PageHeaderComponent,
        EmptyStateComponent,
        ShoppingAddItemFormComponent,
        ShoppingListComponent,
        MatProgressSpinnerModule,
        MatButtonModule,
    ],
    templateUrl: './shopping-page.component.html',
    styleUrl: './shopping-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingPageComponent implements OnInit {
    private readonly shoppingListService = inject(ShoppingListService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    /** Stan listy zakupów */
    readonly state = this.shoppingListService.state;

    /** Stan mutacji */
    readonly mutationState = this.shoppingListService.mutationState;

    /** Posortowana lista elementów */
    readonly itemsSorted = this.shoppingListService.itemsSorted;

    /** Czy lista jest pusta */
    readonly isEmpty = this.shoppingListService.isEmpty;

    /** Czy trwa ładowanie */
    readonly isLoading = this.shoppingListService.isLoading;

    /** Czy trwa odświeżanie */
    readonly isRefreshing = this.shoppingListService.isRefreshing;

    /** Błąd */
    readonly error = this.shoppingListService.error;

    /** Czy trwa dodawanie ręcznej pozycji */
    readonly isAddingManual = this.shoppingListService.isAddingManual;

    ngOnInit(): void {
        // Pobierz listę zakupów przy wejściu na widok
        this.shoppingListService.loadShoppingList();
    }

    /**
     * Obsługuje dodanie ręcznej pozycji
     */
    onAddManualItem(text: string): void {
        this.shoppingListService
            .addManualItem({ text })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.snackBar.open('Dodano', 'OK', { duration: 2000 });
                },
                error: (err: ApiError) => {
                    this.snackBar.open(err.message, 'Zamknij', { duration: 4000 });
                },
            });
    }

    /**
     * Obsługuje zmianę stanu "posiadane" pozycji
     */
    onToggleOwned(event: { id: number; next: boolean }): void {
        this.shoppingListService
            .updateItemOwned(event.id, event.next)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    // Sukces - brak komunikatu (optymistyczne UI)
                },
                error: (err: ApiError) => {
                    this.snackBar.open(err.message, 'Zamknij', { duration: 4000 });
                },
            });
    }

    /**
     * Obsługuje usunięcie ręcznej pozycji
     */
    onDeleteManual(id: number): void {
        this.shoppingListService
            .deleteManualItem(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.snackBar.open('Usunięto', 'OK', { duration: 2000 });
                },
                error: (err: ApiError) => {
                    this.snackBar.open(err.message, 'Zamknij', { duration: 4000 });
                },
            });
    }

    /**
     * Obsługuje retry po błędzie
     */
    onRetry(): void {
        this.shoppingListService.refreshShoppingList();
    }
}
