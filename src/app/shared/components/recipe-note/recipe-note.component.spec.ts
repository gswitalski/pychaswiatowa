import 'zone.js';
import 'zone.js/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { describe, expect, it, beforeAll, vi } from 'vitest';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { RecipeNoteComponent } from './recipe-note.component';
import { RecipeNoteService } from '../../../core/services/recipe-note.service';
import { UnsavedChangesService } from '../../../core/services/unsaved-changes.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('RecipeNoteComponent — zmiana wariantu z draftem', () => {
    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    async function setup(result: boolean | 'secondary') {
        const open = vi.fn().mockReturnValue({ afterClosed: () => of(result) });
        const setNote = vi.fn().mockReturnValue(of({
            recipe_id: 7,
            note: 'zapisana notatka',
            updated_at: null,
        }));
        const rendered = await render(RecipeNoteComponent, {
            imports: [NoopAnimationsModule],
            providers: [
                { provide: RecipeNoteService, useValue: { setNote } },
                { provide: UnsavedChangesService, useValue: { setDirty: vi.fn(), clear: vi.fn() } },
                { provide: MatDialog, useValue: { open } },
                { provide: MatSnackBar, useValue: { open: vi.fn() } },
            ],
            componentInputs: { recipeId: 7, note: 'stara notatka' },
        });
        const instance = rendered.fixture.componentInstance as unknown as {
            editing: { set(value: boolean): void };
            saved: { set(value: string | null): void };
            control: { setValue(value: string): void };
            prepareForVariantChange(): ReturnType<RecipeNoteComponent['prepareForVariantChange']>;
        };
        instance.saved.set('stara notatka');
        instance.editing.set(true);
        instance.control.setValue('nowa notatka');
        return { ...rendered, instance, open, setNote };
    }

    it('otwiera dialog trzech akcji i odrzuca draft', async () => {
        const { instance, open, setNote } = await setup('secondary');

        await new Promise<void>((resolve) =>
            instance.prepareForVariantChange().subscribe(() => resolve()),
        );

        expect(open).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                data: expect.objectContaining({
                    confirmText: 'Zapisz',
                    secondaryConfirmText: 'Odrzuć',
                    cancelText: 'Anuluj',
                }),
            }),
        );
        expect(setNote).not.toHaveBeenCalled();
    });

    it('zapisuje draft po wybraniu Zapisz', async () => {
        const { instance, setNote } = await setup(true);

        const result = await new Promise<string>((resolve) =>
            instance.prepareForVariantChange().subscribe(resolve),
        );

        expect(result).toBe('proceed');
        expect(setNote).toHaveBeenCalledWith(7, 'nowa notatka');
    });

    it('anuluje zmianę bez zapisu', async () => {
        const { instance, setNote } = await setup(false);

        const result = await new Promise<string>((resolve) =>
            instance.prepareForVariantChange().subscribe(resolve),
        );

        expect(result).toBe('cancel');
        expect(setNote).not.toHaveBeenCalled();
    });
});
