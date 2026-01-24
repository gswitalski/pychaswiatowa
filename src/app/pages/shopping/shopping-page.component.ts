import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ShoppingListService, ShoppingListGroupedRecipeItemVm } from '../../core/services/shopping-list.service';
import { MyPlanService } from '../../core/services/my-plan.service';
import { ShoppingAddItemFormComponent } from './components/shopping-add-item-form/shopping-add-item-form.component';
import { ShoppingListComponent } from './components/shopping-list/shopping-list.component';
import { ApiError, DeleteRecipeItemsGroupCommand } from '../../../../shared/contracts/types';

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
        MatIconModule,
        MatTooltipModule,
    ],
    templateUrl: './shopping-page.component.html',
    styleUrl: './shopping-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingPageComponent implements OnInit {
    private readonly shoppingListService = inject(ShoppingListService);
    private readonly myPlanService = inject(MyPlanService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);
    private readonly destroyRef = inject(DestroyRef);

    /** Stan listy zakupów */
    readonly state = this.shoppingListService.state;

    /** Stan mutacji */
    readonly mutationState = this.shoppingListService.mutationState;

    /** Posortowana lista zgrupowanych elementów */
    readonly groupedItemsSorted = this.shoppingListService.groupedItemsSorted;

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

    /** Czy trwa czyszczenie listy */
    readonly isClearing = this.shoppingListService.isClearing;

    /** Czy można wyczyścić listę (jest niepusta) */
    readonly canClear = this.shoppingListService.total;

    /** Snackbar ref dla akcji Undo przy usuwaniu grupy */
    private pendingDeleteSnackBarRef: MatSnackBarRef<TextOnlySnackBar> | null = null;

    /** Komenda usuwania grupy oczekująca na wykonanie */
    private pendingDeleteCommand: DeleteRecipeItemsGroupCommand | null = null;

    ngOnInit(): void {
        // Pobierz listę zakupów przy wejściu na widok (z uwzględnieniem zmian planu)
        const lastPlanChange = this.myPlanService.lastChangedAt();
        const lastShoppingLoad = this.shoppingListService.state().lastLoadedAt;

        if (lastPlanChange !== null && (lastShoppingLoad === null || lastShoppingLoad < lastPlanChange)) {
            this.shoppingListService.refreshShoppingList();
        } else {
            this.shoppingListService.loadShoppingList();
        }

        // Odśwież listę zakupów po zmianach w "Moim planie"
        this.myPlanService.planChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.shoppingListService.refreshShoppingList();
            });
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
    onToggleOwned(event: { groupKey: string; next: boolean }): void {
        this.shoppingListService
            .toggleOwnedGroup(event.groupKey, event.next)
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
     * Obsługuje usunięcie grupy z przepisów z mechanizmem Undo
     */
    onDeleteRecipeGroup(groupKey: string): void {
        // Anuluj poprzednie oczekujące usunięcie jeśli istnieje
        if (this.pendingDeleteSnackBarRef) {
            this.executePendingDelete();
        }

        // Znajdź grupę do usunięcia
        const group = this.groupedItemsSorted().find(item => item.groupKey === groupKey);

        if (!group || group.kind !== 'RECIPE') {
            return;
        }

        // Przygotuj komendę
        this.pendingDeleteCommand = this.shoppingListService.extractDeleteCommandFromGroup(
            group as ShoppingListGroupedRecipeItemVm
        );

        // Optymistycznie ukryj grupę lokalnie
        const itemsToHide = new Set(group.rowIds);
        const previousData = [...this.shoppingListService.state().data];

        this.shoppingListService.state.update(s => ({
            ...s,
            data: s.data.filter(item => !itemsToHide.has(item.id)),
        }));

        // Pokaż Snackbar z Undo
        this.pendingDeleteSnackBarRef = this.snackBar.open(
            'Usunięto pozycje z przepisu',
            'Cofnij',
            { duration: 5000 }
        );

        // Obsłuż akcję Undo
        this.pendingDeleteSnackBarRef.onAction()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                // Przywróć dane lokalnie
                this.shoppingListService.state.update(s => ({
                    ...s,
                    data: previousData,
                }));

                // Wyczyść oczekujące usunięcie
                this.pendingDeleteCommand = null;
                this.pendingDeleteSnackBarRef = null;
            });

        // Po zamknięciu Snackbar (bez Undo) wykonaj usunięcie
        this.pendingDeleteSnackBarRef.afterDismissed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((dismissedInfo) => {
                // Jeśli dismissed przez akcję (Undo), nie wykonuj usunięcia
                if (dismissedInfo.dismissedByAction) {
                    return;
                }

                // Wykonaj faktyczne usunięcie przez API
                this.executePendingDelete();
            });
    }

    /**
     * Wykonuje oczekujące usunięcie grupy
     */
    private executePendingDelete(): void {
        if (!this.pendingDeleteCommand) {
            return;
        }

        const command = this.pendingDeleteCommand;
        this.pendingDeleteCommand = null;
        this.pendingDeleteSnackBarRef = null;

        this.shoppingListService
            .deleteRecipeGroup(command)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    // Sukces - dane już zaktualizowane lokalnie
                },
                error: (err: ApiError) => {
                    // Błąd - odśwież listę i pokaż komunikat
                    this.snackBar.open(err.message, 'Zamknij', { duration: 4000 });
                    this.shoppingListService.refreshShoppingList();
                },
            });
    }

    /**
     * Obsługuje retry po błędzie
     */
    onRetry(): void {
        this.shoppingListService.refreshShoppingList();
    }

    /**
     * Otwiera dialog potwierdzenia czyszczenia listy
     */
    onOpenClearDialog(): void {
        const dialogData: ConfirmDialogData = {
            title: 'Wyczyść listę zakupów',
            message: 'Czy na pewno chcesz wyczyścić całą listę zakupów? Ta akcja nie wpłynie na Twój plan.',
            confirmText: 'Wyczyść',
            cancelText: 'Anuluj',
            confirmColor: 'warn',
        };

        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: dialogData,
            width: '400px',
            disableClose: this.isClearing(),
        });

        dialogRef.afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((confirmed) => {
                if (confirmed) {
                    this.onClearList();
                }
            });
    }

    /**
     * Czyści całą listę zakupów
     */
    private onClearList(): void {
        this.shoppingListService
            .clearShoppingList()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.snackBar.open('Lista zakupów została wyczyszczona', 'OK', { duration: 3000 });
                },
                error: (err: ApiError) => {
                    this.snackBar.open(err.message, 'Zamknij', { duration: 4000 });
                },
            });
    }
}
