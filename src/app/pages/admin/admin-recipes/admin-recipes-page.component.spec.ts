import 'zone.js';
import 'zone.js/testing';
import '@angular/compiler';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GetAdminRecipesResponseDto } from '../../../../../shared/contracts/types';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { AdminRecipesPageComponent } from './admin-recipes-page.component';

const response: GetAdminRecipesResponseDto = {
    data: [
        {
            id: 42,
            name: 'Szarlotka',
            author_id: '1a2b3c4d-aaaa-bbbb-cccc-ef01',
            author_username: null,
            author_email: 'kasia@example.com',
            category_name: null,
            created_at: '2026-05-03T10:15:00.000Z',
            average_rating: 4.5,
            ratings_count: 12,
            is_grill: true,
            is_termorobot: false,
        },
    ],
    pagination: { currentPage: 1, pageSize: 25, totalPages: 1, totalItems: 1 },
    sorting: { sort_by: 'created_at', sort_dir: 'desc' },
};

describe('AdminRecipesPageComponent', () => {
    let api: { getRecipes: ReturnType<typeof vi.fn> };
    let router: { navigate: ReturnType<typeof vi.fn> };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        api = { getRecipes: vi.fn().mockReturnValue(of(response)) };
        router = { navigate: vi.fn() };
        await TestBed.configureTestingModule({
            imports: [AdminRecipesPageComponent, NoopAnimationsModule],
            providers: [
                { provide: AdminApiService, useValue: api },
                {
                    provide: CategoriesService,
                    useValue: {
                        categories: signal([]),
                        loading: signal(false),
                        error: signal<string | null>(null),
                        loadCategories: vi.fn().mockReturnValue(of([])),
                        clearCache: vi.fn(),
                    },
                },
                { provide: Router, useValue: router },
            ],
        }).compileComponents();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function createComponent(result?: Observable<GetAdminRecipesResponseDto>) {
        const fixture = TestBed.createComponent(AdminRecipesPageComponent);
        if (result) {
            api.getRecipes.mockReturnValue(result);
        }
        fixture.detectChanges();
        return fixture;
    }

    it('pobiera domyślną stronę i mapuje autora oraz wartości zastępcze', () => {
        const fixture = createComponent();
        expect(api.getRecipes).toHaveBeenCalledWith({
            page: 1,
            page_size: 25,
            sort_by: 'created_at',
            sort_dir: 'desc',
        });
        expect(fixture.componentInstance.rows()[0]).toMatchObject({
            authorPrimaryLabel: 'Brak nazwy użytkownika',
            authorSecondaryLabel: 'kasia@example.com',
            categoryLabel: '—',
            averageRatingLabel: '4,5',
            recipeUrl: '/explore/recipes/42',
        });
        expect(fixture.nativeElement.textContent).toContain('Przepisy publiczne');
        expect(fixture.nativeElement.textContent).toContain(
            'Przepisy prywatne i udostępnione linkiem nie są tutaj pokazywane.'
        );
    });

    it('wraca na stronę pierwszą po zmianie rozmiaru przed odpowiedzią serwera', () => {
        const request = new Subject<GetAdminRecipesResponseDto>();
        const fixture = createComponent();
        fixture.componentInstance.query.set({
            page: 3,
            page_size: 25,
            sort_by: 'created_at',
            sort_dir: 'desc',
        });
        fixture.componentInstance.pagination.update((value) => ({ ...value, currentPage: 3 }));
        api.getRecipes.mockReturnValue(request);
        fixture.componentInstance.onPageChange({ page: 3, page_size: 50 });
        expect(fixture.componentInstance.query()).toEqual({
            page: 1,
            page_size: 50,
            sort_by: 'created_at',
            sort_dir: 'desc',
        });
        expect(fixture.componentInstance.pagination().currentPage).toBe(1);
        expect(fixture.componentInstance.pagination().pageSize).toBe(50);
        request.next({ ...response, pagination: { ...response.pagination, pageSize: 50 } });
    });

    it('koryguje stronę poza zakresem tylko raz', () => {
        const outOfRange: GetAdminRecipesResponseDto = {
            data: [],
            pagination: { currentPage: 9, pageSize: 25, totalPages: 3, totalItems: 61 },
            sorting: { sort_by: 'created_at', sort_dir: 'desc' },
        };
        const secondResponse = { ...response, pagination: { ...response.pagination, currentPage: 3, totalItems: 61, totalPages: 3 } };
        api.getRecipes
            .mockReturnValueOnce(of(outOfRange))
            .mockReturnValueOnce(of(secondResponse));
        const fixture = createComponent();
        expect(api.getRecipes).toHaveBeenNthCalledWith(2, {
            page: 3,
            page_size: 25,
            sort_by: 'created_at',
            sort_dir: 'desc',
        });
        expect(fixture.componentInstance.rows()).toHaveLength(1);
        expect(fixture.componentInstance.isEmpty()).toBe(false);
    });

    it('po korekcie bez danych pokazuje brak wyników bez kolejnego żądania', () => {
        const outOfRange: GetAdminRecipesResponseDto = {
            data: [],
            pagination: { currentPage: 9, pageSize: 25, totalPages: 3, totalItems: 61 },
            sorting: { sort_by: 'created_at', sort_dir: 'desc' },
        };
        api.getRecipes
            .mockReturnValueOnce(of(outOfRange))
            .mockReturnValueOnce(of(outOfRange));
        const fixture = createComponent();
        expect(api.getRecipes).toHaveBeenCalledTimes(2);
        expect(fixture.componentInstance.hasNoRowsOnPage()).toBe(true);
        expect(fixture.componentInstance.isEmpty()).toBe(false);
    });

    it('po korekcie z totalItems spadającym do zera pokazuje pustą listę', () => {
        const outOfRange: GetAdminRecipesResponseDto = {
            data: [],
            pagination: { currentPage: 9, pageSize: 25, totalPages: 3, totalItems: 61 },
            sorting: { sort_by: 'created_at', sort_dir: 'desc' },
        };
        const empty = {
            ...outOfRange,
            pagination: { currentPage: 3, pageSize: 25, totalPages: 0, totalItems: 0 },
        };
        api.getRecipes.mockReturnValueOnce(of(outOfRange)).mockReturnValueOnce(of(empty));
        const fixture = createComponent();
        expect(api.getRecipes).toHaveBeenCalledTimes(2);
        expect(fixture.componentInstance.isEmpty()).toBe(true);
        expect(fixture.componentInstance.hasNoRowsOnPage()).toBe(false);
    });

    it('nie koryguje pustej listy z totalItems równym zero', () => {
        const empty = { ...response, data: [], pagination: { ...response.pagination, totalItems: 0, totalPages: 0 } };
        const fixture = createComponent(of(empty));
        expect(api.getRecipes).toHaveBeenCalledTimes(1);
        expect(fixture.componentInstance.isEmpty()).toBe(true);
    });

    it('resetuje stronę przy sortowaniu i nie wysyła identycznego sortowania', () => {
        const fixture = createComponent();
        fixture.componentInstance.query.set({
            page: 3,
            page_size: 50,
            sort_by: 'created_at',
            sort_dir: 'desc',
        });
        fixture.componentInstance.onSortChange({ sort_by: 'name', sort_dir: 'asc' });
        expect(api.getRecipes).toHaveBeenLastCalledWith({
            page: 1,
            page_size: 50,
            sort_by: 'name',
            sort_dir: 'asc',
        });
        fixture.componentInstance.query.set({
            page: 1,
            page_size: 50,
            sort_by: 'name',
            sort_dir: 'asc',
        });
        const calls = api.getRecipes.mock.calls.length;
        fixture.componentInstance.onSortChange({ sort_by: 'name', sort_dir: 'asc' });
        expect(api.getRecipes).toHaveBeenCalledTimes(calls);
    });

    it('zachowuje sortowanie i rozmiar przy zmianie strony', () => {
        const fixture = createComponent();
        fixture.componentInstance.query.set({
            page: 1,
            page_size: 50,
            sort_by: 'name',
            sort_dir: 'asc',
        });
        fixture.componentInstance.onPageChange({ page: 2, page_size: 50 });
        expect(api.getRecipes).toHaveBeenLastCalledWith({
            page: 2,
            page_size: 50,
            sort_by: 'name',
            sort_dir: 'asc',
        });
    });

    it('nie wysyła żądania dla tej samej strony i rozmiaru', () => {
        const fixture = createComponent();
        fixture.componentInstance.query.set({
            page: 1,
            page_size: 25,
            sort_by: 'created_at',
            sort_dir: 'desc',
        });
        const calls = api.getRecipes.mock.calls.length;
        fixture.componentInstance.onPageChange({ page: 1, page_size: 25 });
        expect(api.getRecipes).toHaveBeenCalledTimes(calls);
    });

    it('obsługuje 401, 403, 500, retry i błąd przy istniejących wierszach', () => {
        const unauthorized = createComponent(throwError(() => ({ status: 401 })));
        expect(router.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: { returnUrl: '/admin/recipes' },
        });
        expect(unauthorized.componentInstance.isInitialLoading()).toBe(false);

        router.navigate.mockClear();
        createComponent(throwError(() => ({ status: 403 })));
        expect(router.navigate).toHaveBeenCalledWith(['/forbidden']);

        const failed = createComponent(throwError(() => ({ status: 500 })));
        expect(failed.componentInstance.errorMessage()).toContain('Nie udało się pobrać');
        expect(failed.componentInstance.isInitialLoading()).toBe(false);
        api.getRecipes.mockReturnValueOnce(of(response));
        failed.componentInstance.onRetry();
        expect(api.getRecipes).toHaveBeenLastCalledWith(failed.componentInstance.query());

        api.getRecipes.mockReturnValue(of(response));
        const existing = createComponent();
        const request = new Subject<GetAdminRecipesResponseDto>();
        api.getRecipes.mockReturnValue(request);
        existing.componentInstance.onPageChange({ page: 2, page_size: 25 });
        request.error({ status: 500 });
        expect(existing.componentInstance.rows()).toHaveLength(1);
        expect(existing.componentInstance.tableState().hasError).toBe(true);
    });

    it('ignoruje spóźnioną odpowiedź starszego żądania niezależnie od kolejności', () => {
        const first = new Subject<GetAdminRecipesResponseDto>();
        const second = new Subject<GetAdminRecipesResponseDto>();
        api.getRecipes.mockReturnValueOnce(first).mockReturnValueOnce(second);
        const fixture = createComponent();
        fixture.componentInstance.onSortChange({ sort_by: 'name', sort_dir: 'asc' });
        second.next({
            ...response,
            data: [{ ...response.data[0], id: 99, name: 'Nowszy przepis' }],
            pagination: { ...response.pagination, currentPage: 2, pageSize: 50, totalItems: 51 },
            sorting: { sort_by: 'name', sort_dir: 'asc' },
        });
        expect(fixture.componentInstance.rows()[0].id).toBe(99);
        expect(fixture.componentInstance.sorting()).toEqual({
            sort_by: 'name',
            sort_dir: 'asc',
        });
        expect(fixture.componentInstance.query()).toEqual({
            page: 2,
            page_size: 50,
            sort_by: 'name',
            sort_dir: 'asc',
        });
        expect(fixture.componentInstance.pagination()).toMatchObject({
            currentPage: 2,
            pageSize: 50,
            totalItems: 51,
        });

        first.next({
            ...response,
            data: [{ ...response.data[0], id: 1, name: 'Spóźniony przepis' }],
            sorting: { sort_by: 'created_at', sort_dir: 'desc' },
        });
        expect(fixture.componentInstance.rows()[0].id).toBe(99);
        expect(fixture.componentInstance.sorting().sort_by).toBe('name');
        expect(fixture.componentInstance.query().page).toBe(2);
        expect(fixture.componentInstance.pagination().currentPage).toBe(2);
    });

    it('unieważnia korektę strony po nowej akcji użytkownika', () => {
        const first = new Subject<GetAdminRecipesResponseDto>();
        const second = new Subject<GetAdminRecipesResponseDto>();
        api.getRecipes.mockReturnValueOnce(first).mockReturnValueOnce(second);
        const fixture = createComponent();
        fixture.componentInstance.onSortChange({ sort_by: 'name', sort_dir: 'asc' });
        second.next({
            ...response,
            data: [{ ...response.data[0], id: 99, name: 'Nowszy przepis' }],
            pagination: { ...response.pagination, currentPage: 2, pageSize: 50, totalItems: 51 },
            sorting: { sort_by: 'name', sort_dir: 'asc' },
        });
        const correction = new Subject<GetAdminRecipesResponseDto>();
        const newest = new Subject<GetAdminRecipesResponseDto>();
        api.getRecipes.mockReturnValueOnce(of({
            ...response,
            data: [],
            pagination: { currentPage: 9, pageSize: 25, totalPages: 3, totalItems: 61 },
        })).mockReturnValueOnce(correction).mockReturnValueOnce(newest);
        fixture.componentInstance.onRetry();
        fixture.componentInstance.onSortChange({ sort_by: 'category', sort_dir: 'asc' });
        correction.next({
            ...response,
            data: [{ ...response.data[0], id: 88, name: 'Spóźniona korekta' }],
            pagination: { ...response.pagination, currentPage: 3 },
            sorting: { sort_by: 'created_at', sort_dir: 'desc' },
        });
        expect(fixture.componentInstance.rows()[0].id).toBe(99);
        expect(fixture.componentInstance.isRefreshing()).toBe(true);
        expect(fixture.componentInstance.query().sort_by).toBe('category');
        newest.next({
            ...response,
            data: [{ ...response.data[0], id: 77, name: 'Najnowsza odpowiedź' }],
            sorting: { sort_by: 'category', sort_dir: 'asc' },
        });
        expect(fixture.componentInstance.rows()[0].id).toBe(77);
        expect(fixture.componentInstance.isRefreshing()).toBe(false);
        expect(fixture.componentInstance.isInitialLoading()).toBe(false);
        expect(fixture.componentInstance.sorting().sort_by).toBe('category');
    });

    it('zachowuje dane podczas odświeżania', () => {
        const fixture = createComponent();
        const request = new Subject<GetAdminRecipesResponseDto>();
        api.getRecipes.mockReturnValue(request);
        fixture.componentInstance.onPageChange({ page: 2, page_size: 25 });
        expect(fixture.componentInstance.isRefreshing()).toBe(true);
        expect(fixture.componentInstance.isInitialLoading()).toBe(false);
        expect(fixture.componentInstance.rows()).toHaveLength(1);
    });

    it.each([
        ['brak nazwy i e-maila', null, null, '1a2b3c4d...ef01', null],
        ['nazwa bez e-maila', ' Kasia ', null, 'Kasia', null],
        ['białe znaki', '  ', '  ', '1a2b3c4d...ef01', null],
    ])('mapuje autora: %s', (_label, username, email, primary, secondary) => {
        const fixture = createComponent(of({
            ...response,
            data: [{ ...response.data[0], author_username: username, author_email: email }],
        }));
        expect(fixture.componentInstance.rows()[0]).toMatchObject({
            authorPrimaryLabel: primary,
            authorSecondaryLabel: secondary,
        });
    });

    it.each([
        [4, '4,0'],
        [4.5, '4,5'],
        [null, '—'],
        [Number.NaN, '—'],
    ])('formatuje średnią ocenę %s', (rating, label) => {
        const fixture = createComponent(of({
            ...response,
            data: [{ ...response.data[0], average_rating: rating, ratings_count: 0 }],
        }));
        expect(fixture.componentInstance.rows()[0].averageRatingLabel).toBe(label);
        expect(fixture.componentInstance.rows()[0].ratingsCount).toBe(0);
    });

    it('mapuje niepoprawną datę na Brak daty', () => {
        const fixture = createComponent(of({
            ...response,
            data: [{ ...response.data[0], created_at: 'invalid' }],
        }));
        expect(fixture.componentInstance.rows()[0].createdAtLabel).toBe('Brak daty');
    });

    it('formatuje poprawną datę i mapuje oba znaczniki', () => {
        const date = '2026-05-03T10:15:00.000Z';
        const fixture = createComponent(of({
            ...response,
            data: [{ ...response.data[0], created_at: date, is_grill: true, is_termorobot: true }],
        }));
        expect(fixture.componentInstance.rows()[0].createdAtLabel).toBe(
            new Date(date).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })
        );
        expect(fixture.componentInstance.rows()[0].isGrill).toBe(true);
        expect(fixture.componentInstance.rows()[0].isTermorobot).toBe(true);
    });

    it('nie odczytuje trwałego stanu przeglądarki', () => {
        const getItem = vi.spyOn(Storage.prototype, 'getItem');
        const fixture = createComponent();
        expect(getItem).not.toHaveBeenCalled();
        expect(fixture.componentInstance.query()).toMatchObject({
            page: 1,
            page_size: 25,
            sort_by: 'created_at',
            sort_dir: 'desc',
        });
    });
});
