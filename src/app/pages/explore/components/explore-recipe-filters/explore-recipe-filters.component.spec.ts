import 'zone.js';
import 'zone.js/testing';

import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
    EXPLORE_FILTERS_DEFAULT,
    ExploreFilters,
} from '../../models/explore-filters.model';
import { ExploreRecipeFiltersComponent } from './explore-recipe-filters.component';

describe('ExploreRecipeFiltersComponent', () => {
    let fixture: ComponentFixture<ExploreRecipeFiltersComponent>;
    let component: ExploreRecipeFiltersComponent;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ExploreRecipeFiltersComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ExploreRecipeFiltersComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('filters', { ...EXPLORE_FILTERS_DEFAULT });
        fixture.componentRef.setInput('isAuthenticated', false);
        fixture.detectChanges();
    });

    it('ukrywa osobiste filtry dla gościa', () => {
        expect(fixture.nativeElement.textContent).not.toContain('Ulubione');
        expect(fixture.nativeElement.textContent).not.toContain('Chcę wypróbować');
    });

    it('pokazuje osobiste filtry dla zalogowanego użytkownika', () => {
        fixture.componentRef.setInput('isAuthenticated', true);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain('Ulubione');
        expect(fixture.nativeElement.textContent).toContain('Chcę wypróbować');
    });

    it('emituje włączenie filtra Termorobot', () => {
        let emitted: ExploreFilters | undefined;
        component.filtersChange.subscribe((filters) => (emitted = filters));

        component.toggle('termorobot');

        expect(emitted).toEqual({ ...EXPLORE_FILTERS_DEFAULT, termorobot: true });
    });

    it('emituje zmianę diety', () => {
        let emitted: ExploreFilters | undefined;
        component.filtersChange.subscribe((filters) => (emitted = filters));

        component.onDietChange({ value: 'vegan' } as never);

        expect(emitted).toEqual({ ...EXPLORE_FILTERS_DEFAULT, diet: 'vegan' });
    });
});
