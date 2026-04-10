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
import { GetAdminUsersResponseDto } from '../../../../shared/contracts/types';

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
});
