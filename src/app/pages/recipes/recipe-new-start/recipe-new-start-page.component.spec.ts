import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeDraftStateService } from '../services/recipe-draft-state.service';
import { RecipeNewStartPageComponent } from './recipe-new-start-page.component';

describe('RecipeNewStartPageComponent', () => {
    const navigateMock = vi.fn();
    const clearDraftMock = vi.fn();

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        vi.clearAllMocks();

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: Router,
                    useValue: {
                        navigate: navigateMock,
                    } satisfies Partial<Router>,
                },
                {
                    provide: Location,
                    useValue: {
                        back: vi.fn(),
                    } satisfies Partial<Location>,
                },
                {
                    provide: RecipeDraftStateService,
                    useValue: {
                        clearDraft: clearDraftMock,
                    } satisfies Partial<RecipeDraftStateService>,
                },
            ],
        });
    });

    it('pozwala użytkownikowi wybrać generowanie przepisu przez AI', () => {
        const component = TestBed.runInInjectionContext(
            () => new RecipeNewStartPageComponent()
        );
        const aiOption = component.options.find(
            (option) => option.route === '/recipes/new/assist'
        );

        expect(aiOption).toBeDefined();

        component.selectOption(aiOption!);

        expect(navigateMock).toHaveBeenCalledWith(['/recipes/new/assist']);
    });
});
