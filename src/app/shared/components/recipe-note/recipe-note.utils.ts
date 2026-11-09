import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { RECIPE_NOTE_MAX_LENGTH } from '../../../../../shared/contracts/recipe-note';

export function normalizeRecipeNote(raw: string): string | null {
    const normalized = raw.replace(/\r\n?/g, '\n').trim();
    return normalized.length === 0 ? null : normalized;
}

export function countRecipeNoteCharacters(note: string): number {
    return Array.from(note).length;
}

export const noteMaxLengthValidator: ValidatorFn = (
    control: AbstractControl,
): ValidationErrors | null =>
    countRecipeNoteCharacters(normalizeRecipeNote(control.value ?? '') ?? '') >
    RECIPE_NOTE_MAX_LENGTH
        ? { noteMaxLength: true }
        : null;
