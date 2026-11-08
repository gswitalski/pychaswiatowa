import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { firstValueFrom } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeNoteService } from './recipe-note.service';
import { SupabaseService } from './supabase.service';

describe('RecipeNoteService', () => {
    const invoke = vi.fn();
    let service: RecipeNoteService;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        invoke.mockReset();

        await TestBed.configureTestingModule({
            providers: [
                RecipeNoteService,
                {
                    provide: SupabaseService,
                    useValue: { functions: { invoke } },
                },
            ],
        }).compileComponents();

        service = TestBed.inject(RecipeNoteService);
    });

    it('wysyła PUT z treścią notatki i zwraca DTO', async () => {
        const response = {
            recipe_id: 42,
            my_note: 'Mniej soli',
        };
        invoke.mockResolvedValue({ data: response, error: null });

        const result = await firstValueFrom(
            service.updateNote(42, 'Mniej soli')
        );

        expect(result).toEqual(response);
        expect(invoke).toHaveBeenCalledWith('recipes/42/note', {
            method: 'PUT',
            body: { note: 'Mniej soli' },
        });
    });

    it('umożliwia usunięcie notatki (null)', async () => {
        invoke.mockResolvedValue({
            data: { recipe_id: 7, my_note: null },
            error: null,
        });

        await firstValueFrom(service.updateNote(7, null));

        expect(invoke).toHaveBeenCalledWith('recipes/7/note', {
            method: 'PUT',
            body: { note: null },
        });
    });

    it('przenosi status HTTP błędu odpowiedzi', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: { message: 'Unauthorized', context: { status: 401 } },
        });

        await expect(
            firstValueFrom(service.updateNote(42, 'x'))
        ).rejects.toMatchObject({
            message: 'Unauthorized',
            status: 401,
        });
    });

    it('zgłasza błąd serwera, gdy brak danych', async () => {
        invoke.mockResolvedValue({ data: null, error: null });

        await expect(
            firstValueFrom(service.updateNote(42, 'x'))
        ).rejects.toMatchObject({ status: 500 });
    });
});
