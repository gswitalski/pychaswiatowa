import 'zone.js';
import 'zone.js/testing';
import '@angular/compiler';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRecipesFiltersComponent } from './admin-recipes-filters.component';
import { EMPTY_ADMIN_RECIPES_FILTERS } from './admin-recipes.models';

describe('AdminRecipesFiltersComponent', () => {
    let fixture: ComponentFixture<AdminRecipesFiltersComponent>;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AdminRecipesFiltersComponent, NoopAnimationsModule],
        }).compileComponents();
        fixture = TestBed.createComponent(AdminRecipesFiltersComponent);
        fixture.componentRef.setInput('categories', [{ id: 1, name: 'Zupy' }]);
        fixture.componentRef.setInput('categoriesLoading', false);
        fixture.componentRef.setInput('categoriesError', null);
        fixture.componentRef.setInput('appliedFilters', EMPTY_ADMIN_RECIPES_FILTERS);
        fixture.detectChanges();
    });

    it('renderuje wszystkie pola i akcje', () => {
        expect(fixture.nativeElement.textContent).toContain('Nazwa');
        expect(fixture.nativeElement.textContent).toContain('Autor');
        expect(fixture.nativeElement.textContent).toContain('Bez kategorii');
        expect(fixture.nativeElement.textContent).toContain('Grill');
        expect(fixture.nativeElement.textContent).toContain('Termorobot');
        expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(2);
    });

    it('nie emituje przy zmianie pola i emituje jeden przy zastosowaniu', () => {
        const apply = vi.spyOn(fixture.componentInstance.apply, 'emit');
        fixture.componentInstance.form.controls.name.setValue('  Żur  ');
        expect(apply).not.toHaveBeenCalled();
        fixture.componentInstance.onSubmit();
        expect(apply).toHaveBeenCalledTimes(1);
        expect(apply).toHaveBeenCalledWith(expect.objectContaining({ name: 'Żur' }));
    });

    it('blokuje zastosowanie dla niepoprawnego zakresu i walidacji ID', () => {
        const apply = vi.spyOn(fixture.componentInstance.apply, 'emit');
        fixture.componentInstance.form.controls.id.setValue(0);
        fixture.componentInstance.form.controls.ratingMin.setValue(5);
        fixture.componentInstance.form.controls.ratingMax.setValue(2);
        fixture.componentInstance.onSubmit();
        expect(apply).not.toHaveBeenCalled();
        expect(fixture.componentInstance.form.invalid).toBe(true);
    });

    it('emituje wyczyszczenie i obsługuje ponowienie kategorii', () => {
        const clear = vi.spyOn(fixture.componentInstance.clear, 'emit');
        const retry = vi.spyOn(fixture.componentInstance.retryCategories, 'emit');
        fixture.componentInstance.onClear();
        fixture.componentInstance.onRetryCategories();
        expect(clear).toHaveBeenCalledTimes(1);
        expect(retry).toHaveBeenCalledTimes(1);
    });
});
