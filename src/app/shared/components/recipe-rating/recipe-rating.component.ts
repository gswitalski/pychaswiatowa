import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    computed,
    inject,
    input,
    linkedSignal,
    output,
    signal,
    viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RecipeRatingDto } from '../../../../../shared/contracts/types';
import { RecipeRatingService } from '../../../core/services/recipe-rating.service';
import {
    buildRatingSummary,
    buildReadonlyAriaLabel,
    RATING_STARS,
    RatingStar,
} from './recipe-rating.utils';

export type RecipeRatingMode = 'interactive' | 'guest' | 'owner';

@Component({
    selector: 'pych-recipe-rating',
    standalone: true,
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './recipe-rating.component.html',
    styleUrl: './recipe-rating.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeRatingComponent {
    private readonly recipeRatingService = inject(RecipeRatingService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    readonly recipeId = input.required<number>();
    readonly averageRating = input<number | null>(null);
    readonly ratingsCount = input<number>(0);
    readonly myRating = input<number | null>(null);
    readonly isAuthenticated = input.required<boolean>();
    readonly isOwner = input.required<boolean>();

    readonly ratingChange = output<RecipeRatingDto>();
    readonly sessionExpired = output<void>();
    readonly loginRequested = output<void>();

    protected readonly stars = RATING_STARS;
    protected readonly pending = signal(false);
    protected readonly hovered = signal<RatingStar | null>(null);
    protected readonly focusedStar = signal<RatingStar | null>(null);
    protected readonly starButtons =
        viewChildren<ElementRef<HTMLButtonElement>>('starButton');

    protected readonly mode = computed<RecipeRatingMode>(() => {
        if (!this.isAuthenticated()) {
            return 'guest';
        }

        return this.isOwner() ? 'owner' : 'interactive';
    });

    protected readonly selected = linkedSignal<number | null, number | null>({
        source: this.myRating,
        computation: (myRating, previous) =>
            this.pending() && previous ? previous.value : myRating,
    });

    protected readonly displayValue = computed(() => {
        if (this.pending()) {
            return this.selected() ?? 0;
        }

        return (
            this.hovered() ??
            this.focusedStar() ??
            this.selected() ??
            0
        );
    });

    protected readonly readonlyFilled = computed(() =>
        Math.round(this.averageRating() ?? 0)
    );
    protected readonly isEmpty = computed(() => this.ratingsCount() === 0);
    protected readonly summaryText = computed(() =>
        buildRatingSummary(this.averageRating(), this.ratingsCount())
    );
    protected readonly readonlyAriaLabel = computed(() =>
        buildReadonlyAriaLabel(this.averageRating(), this.ratingsCount())
    );
    protected readonly rovingStar = computed<RatingStar>(() => {
        const value = this.focusedStar() ?? this.selected() ?? 1;
        return value as RatingStar;
    });

    protected rate(value: RatingStar | null): void {
        if (this.mode() !== 'interactive' || this.pending()) {
            return;
        }

        const previous = this.selected();
        const next = value === previous ? null : value;

        this.selected.set(next);
        this.pending.set(true);

        this.recipeRatingService
            .setRating(this.recipeId(), next)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (rating) => {
                    this.selected.set(rating.my_rating);
                    this.pending.set(false);
                    this.focusedStar.set(null);

                    if (rating.recipe_id === this.recipeId()) {
                        this.ratingChange.emit(rating);
                    }

                    this.showSuccessMessage(previous, next);
                },
                error: (error: { status?: number }) => {
                    this.selected.set(previous);
                    this.pending.set(false);
                    this.handleError(error);
                },
            });
    }

    protected onHover(star: RatingStar): void {
        if (this.pending() || this.mode() !== 'interactive') {
            return;
        }

        this.hovered.set(star);
    }

    protected onGroupLeave(): void {
        if (!this.pending()) {
            this.hovered.set(null);
        }
    }

    protected onFocusStar(star: RatingStar): void {
        if (!this.pending()) {
            this.focusedStar.set(star);
        }
    }

    protected onBlurGroup(event: FocusEvent): void {
        const group = event.currentTarget as HTMLElement;
        if (!group.contains(event.relatedTarget as Node | null)) {
            this.focusedStar.set(null);
        }
    }

    protected onKeydown(event: KeyboardEvent, star: RatingStar): void {
        if (this.pending()) {
            return;
        }

        let target: RatingStar | null = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            target = Math.min(star + 1, 5) as RatingStar;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            target = Math.max(star - 1, 1) as RatingStar;
        } else if (event.key === 'Home') {
            target = 1;
        } else if (event.key === 'End') {
            target = 5;
        }

        if (target === null) {
            return;
        }

        event.preventDefault();
        this.focusedStar.set(target);
        this.starButtons()[target - 1]?.nativeElement.focus();
    }

    protected isStarFilled(star: RatingStar): boolean {
        return star <= this.displayValue();
    }

    protected isReadonlyStarFilled(star: RatingStar): boolean {
        return star <= this.readonlyFilled();
    }

    protected isPreviewStar(star: RatingStar): boolean {
        const preview = this.hovered() ?? this.focusedStar();
        return !this.pending() && preview !== null && star <= preview;
    }

    protected starTooltip(star: RatingStar): string {
        if (this.selected() === star) {
            return `Twoja ocena: ${star}. Kliknij ponownie, aby usunąć`;
        }

        return `Oceń na ${star} z 5`;
    }

    private showSuccessMessage(
        previous: number | null,
        next: number | null
    ): void {
        const message =
            next === null
                ? 'Twoja ocena została usunięta'
                : previous === null
                  ? 'Twoja ocena została zapisana'
                  : 'Twoja ocena została zaktualizowana';

        this.snackBar.open(message, 'OK', { duration: 3000 });
    }

    private handleError(error: { status?: number }): void {
        if (error.status === 401) {
            this.snackBar.open(
                'Sesja wygasła. Zaloguj się ponownie.',
                'OK',
                { duration: 5000 }
            );
            this.sessionExpired.emit();
            return;
        }

        this.snackBar.open(
            'Nie udało się zapisać oceny. Spróbuj ponownie.',
            'OK',
            { duration: 5000 }
        );
    }
}
