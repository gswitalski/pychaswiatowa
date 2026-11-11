import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { AdminApiService } from './admin-api.service';
import { SupabaseService } from './supabase.service';
import {
    GetAdminRecipesResponseDto,
    GetAdminUsersResponseDto,
    UpdateAdminUserRoleResponseDto,
} from '../../../../shared/contracts/types';

interface MockSupabaseService {
    functions: {
        invoke: ReturnType<typeof vi.fn>;
    };
}

describe('AdminApiService', () => {
    let service: AdminApiService;
    let mockSupabaseService: MockSupabaseService;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        mockSupabaseService = {
            functions: {
                invoke: vi.fn(),
            },
        };

        await TestBed.configureTestingModule({
            providers: [
                AdminApiService,
                { provide: SupabaseService, useValue: mockSupabaseService },
            ],
        }).compileComponents();

        service = TestBed.inject(AdminApiService);
        vi.clearAllMocks();
    });

    describe('getUsers()', () => {
        it('powinien budować poprawny endpoint z query string', async () => {
            const mockResponse: GetAdminUsersResponseDto = {
                data: [],
                pagination: {
                    currentPage: 1,
                    pageSize: 25,
                    totalPages: 0,
                    totalItems: 0,
                },
                sorting: {
                    sort_by: 'created_at',
                    sort_dir: 'desc',
                },
            };

            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            const result = await firstValueFrom(
                service.getUsers({
                    page: 1,
                    page_size: 25,
                    sort_by: 'created_at',
                    sort_dir: 'desc',
                })
            );

            expect(result).toEqual(mockResponse);
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
                'admin/users?page=1&page_size=25&sort_by=created_at&sort_dir=desc',
                { method: 'GET' }
            );
        });

        it('powinien mapować błąd i status HTTP', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Unauthorized', status: 401 },
            });

            await expect(
                firstValueFrom(
                    service.getUsers({
                        page: 1,
                        page_size: 25,
                    })
                )
            ).rejects.toMatchObject({
                message: 'Unauthorized',
                status: 401,
            });
        });

        it('powinien rzucić błąd gdy odpowiedź nie zawiera data', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: null,
            });

            await expect(
                firstValueFrom(
                    service.getUsers({
                        page: 1,
                        page_size: 25,
                    })
                )
            ).rejects.toThrow('Nie udało się pobrać listy użytkowników');
        });
    });

    describe('getRecipes()', () => {
        const response: GetAdminRecipesResponseDto = {
            data: [],
            pagination: { currentPage: 1, pageSize: 25, totalPages: 0, totalItems: 0 },
            sorting: { sort_by: 'created_at', sort_dir: 'desc' },
        };

        it('powinien wysłać parametry sortowania i paginacji', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({ data: response, error: null });

            await expect(
                firstValueFrom(
                    service.getRecipes({
                        page: 1,
                        page_size: 25,
                        sort_by: 'created_at',
                        sort_dir: 'desc',
                    })
                )
            ).resolves.toEqual(response);
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
                'admin/recipes?page=1&page_size=25&sort_by=created_at&sort_dir=desc',
                { method: 'GET' }
            );
        });

        it('powinien wysłać pojedynczy parametr page', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({ data: response, error: null });
            await firstValueFrom(service.getRecipes({ page: 2 }));
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith('admin/recipes?page=2', {
                method: 'GET',
            });
        });

        it('powinien wysłać pojedynczy parametr sort_by', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({ data: response, error: null });
            await firstValueFrom(service.getRecipes({ sort_by: 'name' }));
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith('admin/recipes?sort_by=name', {
                method: 'GET',
            });
        });

        it('powinien wysłać pusty query bez parametrów', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({ data: response, error: null });
            await firstValueFrom(service.getRecipes({}));
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith('admin/recipes', {
                method: 'GET',
            });
        });

        it('powinien wysłać pojedynczy page_size i sort_dir', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({ data: response, error: null });
            await firstValueFrom(service.getRecipes({ page_size: 50 }));
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
                'admin/recipes?page_size=50',
                { method: 'GET' }
            );
            mockSupabaseService.functions.invoke.mockResolvedValue({ data: response, error: null });
            await firstValueFrom(service.getRecipes({ sort_dir: 'asc' }));
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
                'admin/recipes?sort_dir=asc',
                { method: 'GET' }
            );
        });

        it('powinien zgłosić błąd przy braku data', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({ data: null, error: null });
            await expect(firstValueFrom(service.getRecipes({}))).rejects.toThrow(
                'Nie udało się pobrać listy przepisów publicznych'
            );
        });

        it('powinien użyć domyślnego komunikatu błędu', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: '' },
            });
            await expect(firstValueFrom(service.getRecipes({}))).rejects.toMatchObject({
                message: 'Błąd pobierania listy przepisów publicznych',
                status: 500,
            });
        });

        it('powinien przenieść status błędu API także z context', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Forbidden', context: { status: 403 } },
            });
            await expect(firstValueFrom(service.getRecipes({}))).rejects.toMatchObject({
                status: 403,
            });
            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Server error' },
            });
            await expect(firstValueFrom(service.getRecipes({}))).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('updateUserRole()', () => {
        it('powinien wysłać PATCH na poprawny endpoint z body app_role', async () => {
            const targetUserId = '7c8966c3-bc93-4bda-bcd1-bdcfd2af7b99';
            const mockResponse: UpdateAdminUserRoleResponseDto = {
                user: {
                    id: targetUserId,
                    login: 'ania@example.com',
                    username: 'ania',
                    role: 'premium',
                    created_at: '2026-04-10T12:00:00.000Z',
                    last_sign_in_at: null,
                    recipes_count: 3,
                },
            };

            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            const result = await firstValueFrom(service.updateUserRole(targetUserId, 'premium'));

            expect(result).toEqual(mockResponse);
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
                `admin/users/${targetUserId}/role`,
                {
                    method: 'PATCH',
                    body: { app_role: 'premium' },
                }
            );
        });

        it('powinien mapować błąd i status HTTP', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Conflict', status: 409 },
            });

            await expect(
                firstValueFrom(
                    service.updateUserRole('7c8966c3-bc93-4bda-bcd1-bdcfd2af7b99', 'user')
                )
            ).rejects.toMatchObject({
                message: 'Conflict',
                status: 409,
            });
        });

        it('powinien rzucić błąd gdy odpowiedź nie zawiera data', async () => {
            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: null,
            });

            await expect(
                firstValueFrom(
                    service.updateUserRole('7c8966c3-bc93-4bda-bcd1-bdcfd2af7b99', 'admin')
                )
            ).rejects.toThrow('Nie udało się zaktualizować roli użytkownika');
        });
    });
});
