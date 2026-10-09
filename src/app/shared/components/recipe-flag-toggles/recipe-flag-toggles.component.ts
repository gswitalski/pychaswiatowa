import {
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    linkedSignal,
    output,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    ApiError,
    RecipeFlagsDto,
    UpdateRecipeFlagsCommand,
} from '../../../../../shared/contracts/types';
import { RecipeFlagsService } from '../../../core/services/recipe-flags.service';

type RecipeFlagName = 'is_favorite' | 'is_want_to_try';

@Component({
    selector: 'pych-recipe-flag-toggles',
    standalone: true,
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './recipe-flag-toggles.component.html',
    styleUrl: './recipe-flag-toggles.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeFlagTogglesComponent {
    private readonly recipeFlagsService = inject(RecipeFlagsService);
    private readonly snackBar = inject(MatSnackBar);

    readonly recipeId = input.required<number>();
    readonly isFavorite = input<boolean>(false);
    readonly isWantToTry = input<boolean>(false);

    readonly flagsChange = output<RecipeFlagsDto>();
    readonly sessionExpired = output<void>();

    readonly favoritePending = signal(false);
    readonly wantToTryPending = signal(false);

    readonly favorite = linkedSignal({
        source: this.isFavorite,
        computation: (isFavorite, previous) =>
            this.favoritePending() && previous
                ? previous.value
                : isFavorite,
    });

    readonly wantToTry = linkedSignal({
        source: this.isWantToTry,
        computation: (isWantToTry, previous) =>
            this.wantToTryPending() && previous
                ? previous.value
                : isWantToTry,
    });

    toggleFavorite(): void {
        this.toggle('is_favorite');
    }

    toggleWantToTry(): void {
        this.toggle('is_want_to_try');
    }

    private toggle(flag: RecipeFlagName): void {
        const isFavorite = flag === 'is_favorite';
        const value = isFavorite ? this.favorite : this.wantToTry;
        const pending = isFavorite
            ? this.favoritePending
            : this.wantToTryPending;

        if (pending()) {
            return;
        }

        const previous = value();
        const next = !previous;
        const patch: UpdateRecipeFlagsCommand = isFavorite
            ? { is_favorite: next }
            : { is_want_to_try: next };

        value.set(next);
        pending.set(true);

        this.recipeFlagsService.setFlags(this.recipeId(), patch).subscribe({
            next: (flags) => {
                this.favorite.set(flags.is_favorite);
                this.wantToTry.set(flags.is_want_to_try);
                pending.set(false);
                this.flagsChange.emit(flags);
            },
            error: (error: ApiError) => {
                value.set(previous);
                pending.set(false);
                this.handleError(error);
            },
        });
    }

    private handleError(error: ApiError): void {
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
            'Nie udało się zapisać. Spróbuj ponownie.',
            'OK',
            { duration: 5000 }
        );
    }
}
