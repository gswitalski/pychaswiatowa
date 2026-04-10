import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminUsersPageComponent } from './admin-users-page.component';
import { GetAdminUsersResponseDto } from '../../../../../shared/contracts/types';

function buildUsersResponse(
    overrides: Partial<GetAdminUsersResponseDto> = {}
): GetAdminUsersResponseDto {
    return {
        data: [
            {
                id: '12345678-aaaa-bbbb-cccc-1234567890ab',
                login: 'admin@example.com',
                username: 'admin',
                role: 'admin',
                created_at: '2024-01-15T10:00:00.000Z',
                last_sign_in_at: null,
                recipes_count: 4,
            },
        ],
        pagination: {
            currentPage: 1,
            pageSize: 25,
            totalPages: 3,
            totalItems: 60,
        },
        sorting: {
            sort_by: 'created_at',
            sort_dir: 'desc',
        },
        ...overrides,
    };
}

describe('AdminUsersPageComponent', () => {
    let mockAdminApiService: {
        getUsers: ReturnType<typeof vi.fn>;
    };
    let mockRouter: {
        navigate: ReturnType<typeof vi.fn>;
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        mockAdminApiService = {
            getUsers: vi.fn(),
        };
        mockRouter = {
            navigate: vi.fn(),
        };

        TestBed.configureTestingModule({
            imports: [AdminUsersPageComponent],
            providers: [
                { provide: AdminApiService, useValue: mockAdminApiService },
                { provide: Router, useValue: mockRouter },
            ],
        });
    });

    function createComponent() {
        const fixture = TestBed.createComponent(AdminUsersPageComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();
        return { fixture, component };
    }

    it('powinien ładować dane startowe z domyślnym query', () => {
        mockAdminApiService.getUsers.mockReturnValue(of(buildUsersResponse()));

        const { component } = createComponent();

        expect(mockAdminApiService.getUsers).toHaveBeenCalledWith({
            page: 1,
            page_size: 25,
            sort_by: 'created_at',
            sort_dir: 'desc',
        });
        expect(component.rows()).toHaveLength(1);
        expect(component.rows()[0].lastSignInAtLabel).toBe('Nigdy');
    });

    it('powinien resetować stronę do 1 przy zmianie sortowania', () => {
        mockAdminApiService.getUsers.mockReturnValue(of(buildUsersResponse()));
        const { component } = createComponent();
        mockAdminApiService.getUsers.mockClear();

        component.onSortChange({
            sort_by: 'login',
            sort_dir: 'asc',
        });

        expect(mockAdminApiService.getUsers).toHaveBeenCalledWith({
            page: 1,
            page_size: 25,
            sort_by: 'login',
            sort_dir: 'asc',
        });
    });

    it('powinien zmieniać stronę zachowując sortowanie', () => {
        mockAdminApiService.getUsers.mockReturnValue(of(buildUsersResponse()));
        const { component } = createComponent();
        mockAdminApiService.getUsers.mockClear();

        component.onPageChange({
            page: 2,
            page_size: 25,
        });

        expect(mockAdminApiService.getUsers).toHaveBeenCalledWith({
            page: 2,
            page_size: 25,
            sort_by: 'created_at',
            sort_dir: 'desc',
        });
    });

    it('powinien przekierować na login dla błędu 401', () => {
        mockAdminApiService.getUsers.mockReturnValue(
            throwError(() => ({ message: 'Unauthorized', status: 401 }))
        );

        createComponent();

        expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: { returnUrl: '/admin/users' },
        });
    });

    it('powinien pokazać error state dla błędu nieautoryzacyjnego', () => {
        mockAdminApiService.getUsers.mockReturnValue(
            throwError(() => ({ message: 'Server error', status: 500 }))
        );

        const { component } = createComponent();

        expect(component.tableState().hasError).toBe(true);
        expect(component.errorMessage()).toBe(
            'Nie udało się pobrać listy użytkowników. Odśwież widok lub spróbuj ponownie.'
        );
    });
});
