import {
    ChangeDetectionStrategy,
    Component,
    inject,
    DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MyPlanService } from '../../../core/services/my-plan.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { SlugService } from '../../services/slug.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { PlanListItemDto, ApiError } from '../../../../../shared/contracts/types';

/**
 * Drawer "Mój plan" - globalny panel wysuwany z prawej strony.
 * Wyświetla listę przepisów w planie użytkownika.
 *
 * Funkcjonalności:
 * - Przegląd listy przepisów (od najnowszych)
 * - Usunięcie pojedynczej pozycji
 * - Wyczyszczenie całej listy
 * - Nawigacja do szczegółów przepisu
 */
@Component({
    selector: 'pych-my-plan-drawer',
    standalone: true,
    imports: [
        MatListModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatToolbarModule,
        MatSnackBarModule,
        MatDialogModule,
        MatTooltipModule,
    ],
    templateUrl: './my-plan-drawer.component.html',
    styleUrl: './my-plan-drawer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPlanDrawerComponent {
    private readonly myPlanService = inject(MyPlanService);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);
    private readonly destroyRef = inject(DestroyRef);
    private readonly supabase = inject(SupabaseService);
    private readonly slugService = inject(SlugService);

    /** Lista elementów planu */
    readonly items = this.myPlanService.items;

    /** Całkowita liczba elementów */
    readonly planTotal = this.myPlanService.planTotal;

    /** Czy ładowanie początkowe */
    readonly isLoading = this.myPlanService.isLoading;

    /** Czy odświeżanie */
    readonly isRefreshing = this.myPlanService.isRefreshing;

    /** Błąd */
    readonly error = this.myPlanService.error;

    /** Czy trwa czyszczenie planu */
    readonly isClearing = this.myPlanService.isClearing;

    /** Czy plan ma elementy */
    readonly hasItems = this.myPlanService.hasItems;

    /**
     * Sprawdza czy dany przepis jest w trakcie usuwania
     */
    isDeletingRecipe(recipeId: number): boolean {
        return this.myPlanService.isDeletingRecipe(recipeId);
    }

    /**
     * Zamyka drawer
     */
    onClose(): void {
        this.myPlanService.closeDrawer();
    }

    /**
     * Otwiera dialog potwierdzenia i czyści plan
     */
    onClearPlan(): void {
        const dialogData: ConfirmDialogData = {
            title: 'Wyczyść plan',
            message: 'Czy na pewno chcesz usunąć wszystkie przepisy z planu? Ta operacja jest nieodwracalna.',
            confirmText: 'Wyczyść',
            cancelText: 'Anuluj',
            confirmColor: 'warn',
        };

        this.dialog.open(ConfirmDialogComponent, { data: dialogData })
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((confirmed) => {
                if (confirmed) {
                    this.executeClearPlan();
                }
            });
    }

    /**
     * Wykonuje czyszczenie planu
     */
    private executeClearPlan(): void {
        this.myPlanService.clearPlan()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.snackBar.open('Wyczyszczono plan', 'OK', { duration: 3000 });
                },
                error: (err: ApiError) => {
                    this.handleApiError(err, 'Nie udało się wyczyścić planu');
                },
            });
    }

    /**
     * Usuwa przepis z planu
     */
    onRemoveFromPlan(event: Event, recipeId: number): void {
        event.stopPropagation();

        this.myPlanService.removeFromPlan(recipeId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.snackBar.open('Usunięto z planu', 'OK', { duration: 3000 });
                },
                error: (err: ApiError) => {
                    this.handleApiError(err, 'Nie udało się usunąć przepisu');
                },
            });
    }

    /**
     * Nawiguje do szczegółów przepisu w formacie kanonicznym :id-:slug
     */
    onNavigateToRecipe(item: PlanListItemDto): void {
        this.myPlanService.closeDrawer();
        
        // Generuj slug z nazwy przepisu
        const slug = this.slugService.slugify(item.recipe.name);
        const recipeSegment = `${item.recipe_id}-${slug}`;
        
        this.router.navigate(['/explore/recipes', recipeSegment]);
    }

    /**
     * Ponawia próbę pobrania planu
     */
    onRetry(): void {
        this.myPlanService.refreshPlan();
    }

    /**
     * Zwraca pełny public URL obrazka przepisu lub null jeśli brak obrazka
     * Konwertuje storage path na pełny URL używając Supabase Storage
     */
    getRecipeImageUrl(imagePath: string | null): string | null {
        if (!imagePath) {
            return null;
        }

        // Jeśli to już pełny URL, zwróć bez zmian
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }

        // W przeciwnym razie skonstruuj public URL ze ścieżki storage
        const { data } = this.supabase.storage
            .from('recipe-images')
            .getPublicUrl(imagePath);

        return data?.publicUrl || null;
    }

    /**
     * Obsługuje błędy API
     */
    private handleApiError(err: ApiError, defaultMessage: string): void {
        // Obsługa 401 - sesja wygasła
        if (err.status === 401) {
            this.snackBar.open('Sesja wygasła. Zaloguj się ponownie.', 'OK', { duration: 5000 });
            this.myPlanService.closeDrawer();
            this.router.navigate(['/login'], {
                queryParams: { returnUrl: this.router.url }
            });
            return;
        }

        this.snackBar.open(err.message || defaultMessage, 'OK', { duration: 5000 });
    }

    /**
     * TrackBy dla listy elementów
     */
    trackByRecipeId(_index: number, item: PlanListItemDto): number {
        return item.recipe_id;
    }
}

