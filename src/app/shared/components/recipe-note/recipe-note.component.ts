import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    effect,
    Injector,
    inject,
    input,
    linkedSignal,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RecipeNoteResponseDto } from '../../../../../shared/contracts/types';
import { RECIPE_NOTE_MAX_LENGTH } from '../../../../../shared/contracts/recipe-note';
import { RecipeNoteService } from '../../../core/services/recipe-note.service';
import { UnsavedChangesService } from '../../../core/services/unsaved-changes.service';
import {
    ConfirmDialogComponent,
    ConfirmDialogData,
} from '../confirm-dialog/confirm-dialog.component';
import {
    countRecipeNoteCharacters,
    normalizeRecipeNote,
    noteMaxLengthValidator,
} from './recipe-note.utils';

let instanceCounter = 0;

@Component({
    selector: 'pych-recipe-note',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        TextFieldModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './recipe-note.component.html',
    styleUrl: './recipe-note.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeNoteComponent {
    private readonly noteService = inject(RecipeNoteService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);
    private readonly unsavedChanges = inject(UnsavedChangesService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly injector = inject(Injector);
    private readonly dirtyKey = `recipe-note:${++instanceCounter}`;

    readonly recipeId = input.required<number>();
    readonly note = input<string | null>(null);
    readonly noteChange = output<RecipeNoteResponseDto>();
    readonly sessionExpired = output<void>();

    protected readonly maxLength = RECIPE_NOTE_MAX_LENGTH;
    protected readonly saved = linkedSignal<string | null, string | null>({
        source: this.note,
        computation: (note, previous) => (this.pending() && previous ? previous.value : note),
    });
    protected readonly editing = signal(false);
    protected readonly pending = signal(false);
    protected readonly control = new FormControl('', {
        nonNullable: true,
        validators: [noteMaxLengthValidator],
    });
    protected readonly draft = toSignal(this.control.valueChanges, { initialValue: '' });
    protected readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');
    protected readonly editButton = viewChild<ElementRef<HTMLButtonElement>>('editButton');
    protected readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');
    protected readonly normalizedDraft = () => normalizeRecipeNote(this.draft());
    protected readonly charCount = () => countRecipeNoteCharacters(this.normalizedDraft() ?? '');
    protected readonly overLimit = () => this.control.invalid;
    protected readonly isDirty = () =>
        this.editing() && this.normalizedDraft() !== this.saved();
    protected readonly canSave = () =>
        this.editing() &&
        !this.pending() &&
        !this.overLimit() &&
        this.isDirty() &&
        !(this.normalizedDraft() === null && this.saved() === null);

    constructor() {
        effect(() => this.unsavedChanges.setDirty(this.dirtyKey, this.isDirty()));
        this.destroyRef.onDestroy(() => this.unsavedChanges.clear(this.dirtyKey));
    }

    protected startEdit(): void {
        if (this.pending()) {
            return;
        }
        this.control.setValue(this.saved() ?? '');
        this.control.markAsPristine();
        this.editing.set(true);
        this.focusAfterRender(() => this.noteField());
    }

    protected cancel(): void {
        if (this.pending()) {
            return;
        }
        this.editing.set(false);
        this.control.reset('');
        this.focusAfterRender(() => (this.saved() !== null ? this.editButton() : this.addButton()));
    }

    protected onShortcutSave(event: Event): void {
        event.preventDefault();
        if (this.canSave()) {
            this.save();
        }
    }

    protected save(): void {
        if (!this.canSave()) {
            return;
        }
        const payload = this.normalizedDraft();
        this.pending.set(true);
        this.noteService
            .setNote(this.recipeId(), payload)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (response) => {
                    this.saved.set(response.note);
                    this.editing.set(false);
                    this.control.reset('');
                    this.pending.set(false);
                    if (response.recipe_id === this.recipeId()) {
                        this.noteChange.emit(response);
                    }
                    this.showSuccess(response.note);
                    this.focusAfterRender(() =>
                        response.note !== null ? this.editButton() : this.addButton(),
                    );
                },
                error: (error: { status?: number }) => {
                    this.pending.set(false);
                    this.handleError(error);
                },
            });
    }

    protected remove(): void {
        if (this.saved() === null || this.pending()) {
            return;
        }
        const data: ConfirmDialogData = {
            title: 'Usuń notatkę',
            message: 'Usunąć notatkę? Tej operacji nie można cofnąć.',
            confirmText: 'Usuń',
            cancelText: 'Anuluj',
            confirmColor: 'warn',
        };
        this.dialog
            .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
                width: '400px',
                data,
            })
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((confirmed) => {
                if (!confirmed || this.pending() || this.saved() === null) {
                    return;
                }
                const snapshot = {
                    saved: this.saved(),
                    editing: this.editing(),
                    draft: this.control.value,
                };
                this.saved.set(null);
                this.editing.set(false);
                this.control.reset('');
                this.pending.set(true);
                this.noteService
                    .setNote(this.recipeId(), null)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe({
                        next: (response) => {
                            this.pending.set(false);
                            this.noteChange.emit(response);
                            this.snackBar.open('Notatka została usunięta', 'OK', { duration: 3000 });
                            this.focusAfterRender(() => this.addButton());
                        },
                        error: (error: { status?: number }) => {
                            this.saved.set(snapshot.saved);
                            this.editing.set(snapshot.editing);
                            this.control.setValue(snapshot.draft);
                            this.pending.set(false);
                            this.handleError(error);
                            this.focusAfterRender(() =>
                                snapshot.editing ? this.noteField() : this.editButton(),
                            );
                        },
                    });
            });
    }

    private showSuccess(note: string | null): void {
        this.snackBar.open(
            note === null ? 'Notatka została usunięta' : 'Notatka została zapisana',
            'OK',
            { duration: 3000 },
        );
    }

    private handleError(error: { status?: number }): void {
        if (error.status === 401) {
            this.snackBar.open('Sesja wygasła. Zaloguj się ponownie.', 'OK', { duration: 5000 });
            this.sessionExpired.emit();
            return;
        }
        this.snackBar.open('Nie udało się zapisać notatki. Spróbuj ponownie.', 'OK', {
            duration: 5000,
        });
    }

    private focusAfterRender(target: () => ElementRef<HTMLElement> | undefined): void {
        afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
    }
}
