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
import { By } from '@angular/platform-browser';
import { MatPaginator } from '@angular/material/paginator';
import { AdminRecipesTableComponent } from './admin-recipes-table.component';
import {
    AdminRecipesTableRowVm,
    AdminRecipesTableStateVm,
    AdminRecipesPaginationVm,
    AdminRecipesSortingVm,
} from './admin-recipes.models';

const row: AdminRecipesTableRowVm = {
    id: 42,
    name: 'Szarlotka',
    authorId: '1a2b3c4d-aaaa-bbbb-cccc-ef01',
    authorPrimaryLabel: 'Kasia',
    authorSecondaryLabel: 'kasia@example.com',
    categoryLabel: 'Deser',
    createdAtLabel: '3 maja 2026, 12:00',
    averageRatingLabel: '4,5',
    ratingsCount: 12,
    isGrill: true,
    isTermorobot: false,
    recipeUrl: '/explore/recipes/42',
    openAriaLabel: 'Otwórz przepis Szarlotka w nowej karcie',
};

const state: AdminRecipesTableStateVm = {
    isInitialLoading: false,
    isRefreshing: false,
    isEmpty: false,
    hasNoRowsOnPage: false,
    hasError: false,
    errorMessage: null,
};

const pagination: AdminRecipesPaginationVm = {
    currentPage: 1,
    pageSize: 25,
    totalPages: 1,
    totalItems: 1,
};

const sorting: AdminRecipesSortingVm = {
    sort_by: 'created_at',
    sort_dir: 'desc',
};

describe('AdminRecipesTableComponent', () => {
    let fixture: ComponentFixture<AdminRecipesTableComponent>;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AdminRecipesTableComponent, NoopAnimationsModule],
        }).compileComponents();
        fixture = TestBed.createComponent(AdminRecipesTableComponent);
        fixture.componentRef.setInput('rows', [row]);
        fixture.componentRef.setInput('state', state);
        fixture.componentRef.setInput('pagination', pagination);
        fixture.componentRef.setInput('sorting', sorting);
        fixture.componentRef.setInput('displayedColumns', [
            'id',
            'name',
            'author',
            'category',
            'createdAt',
            'averageRating',
            'ratingsCount',
            'flags',
            'actions',
        ]);
        fixture.detectChanges();
    });

    it('renderuje dziewięć kolumn i link w nowej karcie', () => {
        const text = fixture.nativeElement.textContent;
        const headers = Array.from(fixture.nativeElement.querySelectorAll('th')).map(
            (header: Element) => header.textContent?.trim()
        );
        expect(headers).toEqual([
            'ID',
            'Nazwa',
            'Autor',
            'Kategoria',
            'Data utworzenia',
            'Średnia ocena',
            'Liczba ocen',
            'Znaczniki',
            'Akcja',
        ]);
        expect(fixture.nativeElement.querySelectorAll('th[mat-sort-header]')).toHaveLength(6);
        expect(fixture.nativeElement.querySelector('th.mat-column-id[mat-sort-header]')).toBeNull();
        expect(fixture.nativeElement.querySelector('th.mat-column-flags[mat-sort-header]')).toBeNull();
        expect(fixture.nativeElement.querySelector('th.mat-column-actions[mat-sort-header]')).toBeNull();
        expect(fixture.nativeElement.querySelector('.admin-recipes-table__scroll')?.contains(
            fixture.nativeElement.querySelector('table')
        )).toBe(true);
        expect(text).toContain('Średnia ocena');
        expect(text).toContain('Liczba ocen');
        expect(text).not.toContain('Widoczność');
        const link = fixture.nativeElement.querySelector('a');
        expect(link.getAttribute('href')).toBe('/explore/recipes/42');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener');
        expect(link.getAttribute('aria-label')).toContain('Szarlotka');
        expect(link.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('ustawia aria-sort z wejścia i aktualizuje je po zmianie sortowania', () => {
        expect(fixture.nativeElement.querySelector('th.mat-column-createdAt')?.getAttribute('aria-sort')).toBe(
            'descending'
        );
        fixture.componentRef.setInput('sorting', { sort_by: 'name', sort_dir: 'asc' });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('th.mat-column-name')?.getAttribute('aria-sort')).toBe(
            'ascending'
        );
    });

    it('emituje sortowanie po kliknięciu wszystkich sześciu nagłówków', () => {
        const component = fixture.componentInstance;
        const sortSpy = vi.spyOn(component.sortChange, 'emit');

        const nameHeader = fixture.nativeElement.querySelector(
            'th.mat-column-name .mat-sort-header-container'
        ) as HTMLElement;
        nameHeader.click();
        fixture.detectChanges();
        nameHeader.click();
        fixture.detectChanges();
        expect(sortSpy).toHaveBeenLastCalledWith({ sort_by: 'name', sort_dir: 'desc' });
        expect(fixture.nativeElement.querySelector('th.mat-column-name')?.getAttribute('aria-sort')).toBe(
            'descending'
        );

        for (const column of ['author', 'category', 'createdAt', 'averageRating', 'ratingsCount']) {
            const header = fixture.nativeElement.querySelector(
                `th.mat-column-${column} .mat-sort-header-container`
            ) as HTMLElement;
            header.click();
            fixture.detectChanges();
        }

        expect(sortSpy.mock.calls.map(([event]) => event.sort_by)).toEqual([
            'name',
            'name',
            'author',
            'category',
            'created_at',
            'average_rating',
            'ratings_count',
        ]);
    });

    it('emituje desc dla pięciu pozostałych kolumn po drugim kliknięciu', () => {
        const sortSpy = vi.spyOn(fixture.componentInstance.sortChange, 'emit');
        for (const column of ['author', 'category', 'createdAt', 'averageRating', 'ratingsCount']) {
            const header = fixture.nativeElement.querySelector(
                `th.mat-column-${column} .mat-sort-header-container`
            ) as HTMLElement;
            header.click();
            fixture.detectChanges();
            header.click();
            fixture.detectChanges();
            expect(sortSpy).toHaveBeenLastCalledWith({
                sort_by: {
                    author: 'author',
                    category: 'category',
                    createdAt: 'created_at',
                    averageRating: 'average_rating',
                    ratingsCount: 'ratings_count',
                }[column],
                sort_dir: 'desc',
            });
        }
    });

    it('renderuje komórki, znaczniki i bezpiecznie escapuje HTML', () => {
        fixture.componentRef.setInput('rows', [{
            ...row,
            name: '<b>x</b> &amp;',
            isTermorobot: true,
        }]);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('b')).toBeNull();
        expect(fixture.nativeElement.textContent).toContain('<b>x</b> &amp;');
        expect(fixture.nativeElement.querySelector('td.mat-column-name')?.getAttribute('title')).toBe(
            '<b>x</b> &amp;'
        );
        expect(fixture.nativeElement.textContent).toContain('Grill');
        expect(fixture.nativeElement.textContent).toContain('Termorobot');
        expect(fixture.nativeElement.querySelectorAll('.admin-recipes-table__flag')).toHaveLength(2);
    });

    it('renderuje komórki bez drugiej linii autora, wartości zastępcze i brak znaczników', () => {
        fixture.componentRef.setInput('rows', [{
            ...row,
            authorSecondaryLabel: null,
            categoryLabel: '—',
            averageRatingLabel: '—',
            ratingsCount: 0,
            isGrill: false,
            isTermorobot: false,
        }]);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('42');
        expect(fixture.nativeElement.querySelector('.admin-recipes-table__author-secondary')).toBeNull();
        expect(fixture.nativeElement.textContent).toContain('—');
        expect(fixture.nativeElement.textContent).toContain('0');
        expect(fixture.nativeElement.querySelector('.admin-recipes-table__flags')).toBeNull();
    });

    it('renderuje osobno znacznik Grill, Termorobot oraz żaden', () => {
        fixture.componentRef.setInput('rows', [{ ...row, isTermorobot: false }]);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Grill');
        expect(fixture.nativeElement.textContent).not.toContain('Termorobot');
        expect(fixture.nativeElement.querySelectorAll('.admin-recipes-table__flag')).toHaveLength(1);
        expect(fixture.nativeElement.querySelector('.admin-recipes-table__flag mat-icon')?.getAttribute('aria-hidden')).toBe(
            'true'
        );

        fixture.componentRef.setInput('rows', [{ ...row, isGrill: false, isTermorobot: true }]);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Termorobot');
        expect(fixture.nativeElement.textContent).not.toContain('Grill');
        expect(fixture.nativeElement.querySelectorAll('.admin-recipes-table__flag')).toHaveLength(1);

        fixture.componentRef.setInput('rows', [{ ...row, isGrill: false, isTermorobot: false }]);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.admin-recipes-table__flags')).toBeNull();
    });

    it('emituje zmianę strony i rozmiaru oraz udostępnia opcje 25/50/100', () => {
        const pageSpy = vi.spyOn(fixture.componentInstance.pageChange, 'emit');
        const paginator = fixture.debugElement.query(By.directive(MatPaginator))
            .componentInstance as MatPaginator;
        expect(fixture.componentInstance.pageSizeOptions).toEqual([25, 50, 100]);
        expect(paginator.hidePageSize).toBe(false);
        expect(paginator.pageSize).toBe(25);
        expect(paginator.pageSizeOptions).toEqual([25, 50, 100]);
        paginator.page.emit({ pageIndex: 1, pageSize: 25, length: 100, previousPageIndex: 0 });
        paginator.page.emit({ pageIndex: 0, pageSize: 50, length: 100, previousPageIndex: 2 });
        expect(pageSpy).toHaveBeenNthCalledWith(1, { page: 2, page_size: 25 });
        expect(pageSpy).toHaveBeenNthCalledWith(2, { page: 1, page_size: 50 });
    });

    it('renderuje spinner podczas ładowania', () => {
        fixture.componentRef.setInput('state', { ...state, isInitialLoading: true });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
        expect(fixture.nativeElement.textContent).toContain('Ładowanie listy');
    });

    it('renderuje błąd bez wierszy i emituje retry', () => {
        fixture.componentRef.setInput('rows', []);
        fixture.componentRef.setInput('state', {
            ...state,
            isInitialLoading: false,
            hasError: true,
            errorMessage: 'Błąd',
        });
        const retrySpy = vi.spyOn(fixture.componentInstance.retry, 'emit');
        fixture.detectChanges();
        fixture.nativeElement.querySelector('button').click();
        expect(fixture.nativeElement.textContent).toContain('Błąd');
        expect(retrySpy).toHaveBeenCalled();
    });

    it('renderuje isEmpty bez tabeli i paginatora', () => {
        fixture.componentRef.setInput('rows', []);
        fixture.componentRef.setInput('state', { ...state, isEmpty: true });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Brak przepisów publicznych');
        expect(fixture.nativeElement.querySelector('table')).toBeNull();
        expect(fixture.nativeElement.querySelector('mat-paginator')).toBeNull();
    });

    it('renderuje wiersze i klasę podczas odświeżania', () => {
        fixture.componentRef.setInput('rows', [row]);
        fixture.componentRef.setInput('state', { ...state, isRefreshing: true });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.admin-recipes-table')?.classList.contains(
            'admin-recipes-table--refreshing'
        )).toBe(true);
        expect(fixture.nativeElement.textContent).toContain('Szarlotka');
    });

    it('renderuje błąd inline razem z wierszami', () => {
        fixture.componentRef.setInput('state', {
            ...state,
            hasError: true,
            errorMessage: 'Błąd inline',
        });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Błąd inline');
        expect(fixture.nativeElement.textContent).toContain('Szarlotka');
    });

    it('renderuje brak wyników na stronie z paginatorem bez komunikatu pustej listy', () => {
        fixture.componentRef.setInput('rows', []);
        fixture.componentRef.setInput('state', { ...state, hasNoRowsOnPage: true });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Brak wyników na tej stronie.');
        expect(fixture.nativeElement.textContent).not.toContain('Brak przepisów publicznych do wyświetlenia.');
        expect(fixture.nativeElement.querySelector('mat-paginator')).toBeTruthy();
    });
});
