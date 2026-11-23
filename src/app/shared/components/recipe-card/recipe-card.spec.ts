import 'zone.js';
import 'zone.js/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
    RecipeCardComponent,
    RecipeCardData,
} from './recipe-card';

describe('RecipeCardComponent', () => {
    let fixture: ComponentFixture<RecipeCardComponent>;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RecipeCardComponent],
            providers: [
                provideRouter([]),
                {
                    provide: SupabaseService,
                    useValue: {
                        storage: {
                            from: () => ({
                                getPublicUrl: () => ({
                                    data: { publicUrl: null },
                                }),
                            }),
                        },
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RecipeCardComponent);
    });

    function renderCard(isFavorite?: boolean): HTMLElement {
        const recipe: RecipeCardData = {
            id: 42,
            name: 'Testowy przepis',
            imageUrl: null,
            isFavorite,
        };

        fixture.componentRef.setInput('recipe', recipe);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    it('pokazuje wskaźnik dla ulubionego przepisu', () => {
        const element = renderCard(true);
        const indicator = element.querySelector('.favorite-indicator');

        expect(indicator).not.toBeNull();
        expect(indicator?.getAttribute('aria-label')).toBe(
            'Ulubiony przepis'
        );
    });

    it('nie pokazuje wskaźnika dla nieulubionego przepisu', () => {
        const element = renderCard(false);

        expect(element.querySelector('.favorite-indicator')).toBeNull();
    });

    it('nie pokazuje wskaźnika, gdy stan ulubionego nie istnieje', () => {
        const element = renderCard();

        expect(element.querySelector('.favorite-indicator')).toBeNull();
    });

    it('pokazuje metadane grupy, skraca nazwy i dodaje parametr variant', () => {
        fixture.componentRef.setInput('recipe', {
            id: 42,
            name: 'Lasagne',
            imageUrl: null,
            variantName: 'Wegetariańska',
            activeVariantCount: 4,
            matchingVariantCount: 2,
            matchingVariantNames: ['Klasyczna', 'Wegetariańska', 'Pikantna', 'Bezglutenowa'],
            matchingVariantOverflow: 1,
            variantFilterActive: true,
        });
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        expect(element.querySelector('.recipe-variant')?.textContent).toContain('Wegetariańska');
        expect(element.querySelector('.recipe-variant-summary')?.textContent)
            .toContain('pasują 2 z 4');
        expect(element.querySelector('.recipe-variant-summary')?.textContent)
            .toContain('+1');
        expect(element.querySelector('a')?.getAttribute('href')).toContain('variant=42');
        expect(element.querySelector('a')?.getAttribute('aria-label'))
            .toContain('4');
    });

    it('zachowuje dotychczasowy link i wygląd dla pojedynczego wariantu', () => {
        const element = renderCard(false);

        expect(element.querySelector('.recipe-variant')).toBeNull();
        expect(element.querySelector('a')?.getAttribute('href')).not.toContain('variant=');
    });
});
