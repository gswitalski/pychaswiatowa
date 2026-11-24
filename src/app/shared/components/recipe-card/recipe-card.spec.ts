import 'zone.js';
import 'zone.js/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
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

    it('pokazuje pełny wiersz nazw, separator i parametr variant', () => {
        fixture.componentRef.setInput('recipe', {
            id: 42,
            name: 'Lasagne',
            imageUrl: null,
            variantName: 'Wegetariańska',
            activeVariantCount: 4,
            matchingVariantCount: 2,
            matchingVariantNames: [' Klasyczna ', 'Wegetariańska'],
            matchingVariantOverflow: 1,
            variantFilterActive: true,
        });
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const line = element.querySelector('.recipe-title-line');
        const summary = line?.querySelector('.recipe-variant-summary');
        expect(line?.querySelector('.recipe-name')?.textContent).toContain('Lasagne');
        expect(summary?.textContent).toContain('· Klasyczna · Wegetariańska');
        expect(line?.textContent).not.toContain('+1');
        expect(element.querySelector('.recipe-variant')).toBeNull();
        expect(element.querySelector('a')?.getAttribute('href')).toContain('variant=42');
        expect(element.querySelector('a')?.getAttribute('aria-label'))
            .toContain('Klasyczna · Wegetariańska');
        expect(fixture.componentInstance.titleLineText()).toBe(
            'Lasagne · Klasyczna · Wegetariańska'
        );
    });

    it('pokazuje kategorię jako drugą linię i tooltip tylko przy obcięciu', () => {
        fixture.componentRef.setInput('recipe', {
            id: 42,
            name: 'Lasagne',
            imageUrl: null,
            categoryName: 'Danie główne',
            activeVariantCount: 2,
            matchingVariantNames: ['Klasyczna', 'Wegetariańska'],
        });
        fixture.componentRef.setInput('showCategory', true);
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        expect(element.querySelector('.recipe-category')?.textContent)
            .toContain('Danie główne');
        const tooltip = fixture.debugElement
            .query(By.css('.recipe-title-line'))
            .injector.get(MatTooltip);
        expect(tooltip.message).toBe('Lasagne · Klasyczna · Wegetariańska');
        expect(tooltip.disabled).toBe(true);

        const line = element.querySelector('.recipe-title-line') as HTMLElement;
        Object.defineProperty(line, 'scrollWidth', { configurable: true, value: 240 });
        Object.defineProperty(line, 'clientWidth', { configurable: true, value: 120 });
        fixture.componentInstance.measureTitleOverflow();
        fixture.detectChanges();

        expect(fixture.componentInstance.titleOverflow()).toBe(true);
        expect(tooltip.disabled).toBe(false);
    });

    it('nie pokazuje wiersza dla pojedynczego wariantu', () => {
        const element = renderCard(false);

        expect(element.querySelector('.recipe-variant')).toBeNull();
        expect(element.querySelector('.recipe-variant-summary')).toBeNull();
        expect(element.querySelector('a')?.getAttribute('href')).not.toContain('variant=');
    });

    it('nie pokazuje pustego wiersza, gdy nazwy są puste', () => {
        fixture.componentRef.setInput('recipe', {
            id: 42,
            name: 'Lasagne',
            imageUrl: null,
            activeVariantCount: 2,
            matchingVariantNames: ['  ', ''],
        });
        fixture.detectChanges();

        expect(
            (fixture.nativeElement as HTMLElement).querySelector('.recipe-variant-summary')
        ).toBeNull();
    });
});
