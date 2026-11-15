import 'zone.js';
import 'zone.js/testing';
import { beforeAll, beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { of } from 'rxjs';
import { PublicRecipesFacade } from './public-recipes.facade';
import { PublicRecipesService } from '../../../core/services/public-recipes.service';

describe('PublicRecipesFacade', () => {
    const feedMock = vi.fn().mockReturnValue(
        of({
            data: [],
            pageInfo: { hasMore: false, nextCursor: null },
        })
    );

    const apiMock = {
        getPublicRecipesFeed: feedMock,
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        feedMock.mockClear();
        TestBed.configureTestingModule({
            providers: [
                PublicRecipesFacade,
                { provide: PublicRecipesService, useValue: apiMock },
            ],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('w kontekście landing nie woła API po debounce, tylko emituje landingSearchReady$', async () => {
        vi.useFakeTimers();

        const facade = TestBed.inject(PublicRecipesFacade);
        const ready: string[] = [];
        facade.landingSearchReady$.subscribe((q) => ready.push(q));

        facade.initialize('landing', 350, 12);

        facade.updateQueryDraft('tarta');
        expect(feedMock).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(350);

        expect(feedMock).not.toHaveBeenCalled();
        expect(ready).toEqual(['tarta']);
    });

    it('w kontekście explore woła API po debounce dla frazy ≥ 3 znaków', async () => {
        vi.useFakeTimers();

        const facade = TestBed.inject(PublicRecipesFacade);
        facade.initialize('explore', 350, 12);
        feedMock.mockClear();

        facade.updateQueryDraft('makaron');
        await vi.advanceTimersByTimeAsync(350);

        expect(feedMock).toHaveBeenCalledTimes(1);
    });

    it('nie emituje landingSearchReady$ dla frazy krótszej niż 3 znaki', async () => {
        vi.useFakeTimers();

        const facade = TestBed.inject(PublicRecipesFacade);
        const ready: string[] = [];
        facade.landingSearchReady$.subscribe((q) => ready.push(q));

        facade.initialize('landing', 350, 12);
        facade.updateQueryDraft('ab');
        await vi.advanceTimersByTimeAsync(350);

        expect(ready).toEqual([]);
        expect(feedMock).not.toHaveBeenCalled();
    });
});