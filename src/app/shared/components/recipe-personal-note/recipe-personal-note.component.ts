import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    linkedSignal,
    output,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RecipeNoteDto } from '../../../../../shared/contracts/types';
import { RecipeNoteService } from '../../../core/services/recipe-note.service';

const NOTE_MAX_LENGTH = 2000;

@Component({
    selector: 'pych-recipe-personal-note',
    standalone: true,
    imports: [MatFormFieldModule, MatInputModule, MatButtonModule],
    templateUrl: './recipe-personal-note.component.html',
    styleUrl: './recipe-personal-note.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipePersonalNoteComponent {
    private readonly recipeNoteService = inject(RecipeNoteService);
    private readonly snackBar = inject(MatSnackBar);

    readonly recipeId = input.required<number>();
    /** Saved note; `null` = no note, `undefined` = unknown (treated as unavailable). */
    readonly myNote = input<string | null | undefined>(null);
    /**
     * True when loading the user's note failed. The real state is unknown (not "no note"),
     * so editing and saving are blocked to avoid overwriting an existing note.
     */
    readonly noteUnavailable = input(false);

    /** Unknown note state (failed read or missing value) is never treated as "no note". */
    protected readonly isUnavailable = computed(
        () => this.noteUnavailable() || this.myNote() === undefined
    );

    readonly noteChange = output<RecipeNoteDto>();
    readonly sessionExpired = output<void>();

    protected readonly maxLength = NOTE_MAX_LENGTH;
    protected readonly saving = signal(false);

    protected readonly draft = linkedSignal<string | null | undefined, string>({
        source: this.myNote,
        computation: (note) => note ?? '',
    });

    protected readonly savedNormalized = computed(() =>
        (this.myNote() ?? '').trim()
    );

    protected readonly draftNormalized = computed(() =>
        this.draft().trim()
    );

    protected readonly isDirty = computed(
        () => this.draftNormalized() !== this.savedNormalized()
    );

    protected readonly isTooLong = computed(
        () => this.draft().length > NOTE_MAX_LENGTH
    );

    protected readonly canSave = computed(
        () =>
            !this.isUnavailable() &&
            this.isDirty() &&
            !this.saving() &&
            !this.isTooLong()
    );

    protected saveNote(): void {
        if (!this.canSave()) {
            return;
        }

        const note =
            this.draftNormalized().length === 0
                ? null
                : this.draftNormalized();

        this.saving.set(true);
        this.recipeNoteService.updateNote(this.recipeId(), note).subscribe({
            next: (dto) => {
                this.saving.set(false);
                this.noteChange.emit(dto);
                const message =
                    dto.my_note === null
                        ? 'Notatka została usunięta'
                        : 'Notatka została zapisana';
                this.snackBar.open(message, 'OK', { duration: 3000 });
            },
            error: (err: Error & { status?: number }) => {
                this.saving.set(false);
                if (err.status === 401) {
                    this.sessionExpired.emit();
                    return;
                }
                this.snackBar.open(
                    'Nie udało się zapisać notatki. Spróbuj ponownie.',
                    'OK',
                    { duration: 5000 }
                );
            },
        });
    }
}
