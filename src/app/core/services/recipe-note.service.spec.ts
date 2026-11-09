import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { RecipeNoteService } from './recipe-note.service';
import { SupabaseService } from './supabase.service';

describe('RecipeNoteService', () => {
    let service: RecipeNoteService;
    const invoke = vi.fn();

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                RecipeNoteService,
                {
                    provide: SupabaseService,
                    useValue: { functions: { invoke } },
                },
            ],
        });
        service = TestBed.inject(RecipeNoteService);
        invoke.mockReset();
    });

    it('wysyła PUT z treścią notatki', async () => {
        const response = { recipe_id: 7, note: 'tekst', updated_at: null };
        invoke.mockResolvedValue({ data: response, error: null });

        await expect(firstValueFrom(service.setNote(7, 'tekst'))).resolves.toEqual(response);
        expect(invoke).toHaveBeenCalledWith('recipes/7/note', {
            method: 'PUT',
            body: { note: 'tekst' },
        });
    });

    it('obsługuje usunięcie przez null', async () => {
        invoke.mockResolvedValue({ data: { recipe_id: 7, note: null, updated_at: null }, error: null });
        await firstValueFrom(service.setNote(7, null));
        expect(invoke).toHaveBeenCalledWith('recipes/7/note', {
            method: 'PUT',
            body: { note: null },
        });
    });
});
