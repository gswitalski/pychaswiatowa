import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { FormControl } from '@angular/forms';
import {
    countRecipeNoteCharacters,
    normalizeRecipeNote,
    noteMaxLengthValidator,
} from './recipe-note.utils';

describe('recipe-note.utils', () => {
    it('normalizuje białe znaki i łamania linii', () => {
        expect(normalizeRecipeNote('  a\r\n\r\nb  ')).toBe('a\n\nb');
        expect(normalizeRecipeNote(' \r\n ')).toBeNull();
    });

    it('liczy znaki Unicode jako code points', () => {
        expect(countRecipeNoteCharacters('🍲a')).toBe(2);
        expect(countRecipeNoteCharacters('a'.repeat(2000))).toBe(2000);
    });

    it('waliduje limit po normalizacji', () => {
        expect(noteMaxLengthValidator(new FormControl('a'.repeat(2000)))).toBeNull();
        expect(noteMaxLengthValidator(new FormControl('a'.repeat(2001)))).toEqual({
            noteMaxLength: true,
        });
    });
});
