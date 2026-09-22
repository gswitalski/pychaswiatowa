import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    AdminSummaryDto,
    AppRole,
    GetAdminUsersQueryDto,
    GetAdminUsersResponseDto,
    UpdateAdminUserAiCreditsCommand,
    UpdateAdminUserAiCreditsResponseDto,
    UpdateAdminUserRoleResponseDto,
} from '../../../../shared/contracts/types';

@Injectable({
    providedIn: 'root',
})
export class AdminApiService {
    private readonly supabase = inject(SupabaseService);

    getUsers(query: GetAdminUsersQueryDto): Observable<GetAdminUsersResponseDto> {
        const queryParams = new URLSearchParams();

        if (query.page !== undefined) {
            queryParams.append('page', query.page.toString());
        }
        if (query.page_size !== undefined) {
            queryParams.append('page_size', query.page_size.toString());
        }
        if (query.sort_by) {
            queryParams.append('sort_by', query.sort_by);
        }
        if (query.sort_dir) {
            queryParams.append('sort_dir', query.sort_dir);
        }

        const queryString = queryParams.toString();
        const endpoint = queryString ? `admin/users?${queryString}` : 'admin/users';

        return from(
            this.supabase.functions.invoke<GetAdminUsersResponseDto>(endpoint, {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    const error = new Error(
                        response.error.message || 'Błąd pobierania listy użytkowników'
                    ) as Error & {
                        status?: number;
                    };
                    error.status = this.extractStatusFromError(response.error) ?? 500;
                    throw error;
                }

                if (!response.data) {
                    throw new Error('Nie udało się pobrać listy użytkowników');
                }

                return response.data;
            })
        );
    }

    getSummary(): Observable<AdminSummaryDto> {
        return from(
            this.supabase.functions.invoke<AdminSummaryDto>('admin/summary', {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    const error = new Error(response.error.message || 'Błąd pobierania danych admina') as Error & {
                        status?: number;
                    };
                    error.status = this.extractStatusFromError(response.error) ?? 500;
                    throw error;
                }

                if (!response.data) {
                    throw new Error('Nie udało się pobrać podsumowania panelu administracyjnego');
                }

                return response.data;
            })
        );
    }

    updateUserRole(userId: string, appRole: AppRole): Observable<UpdateAdminUserRoleResponseDto> {
        return from(
            this.supabase.functions.invoke<UpdateAdminUserRoleResponseDto>(
                `admin/users/${userId}/role`,
                {
                    method: 'PATCH',
                    body: { app_role: appRole },
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    const error = new Error(
                        response.error.message || 'Błąd aktualizacji roli użytkownika'
                    ) as Error & {
                        status?: number;
                    };
                    error.status = this.extractStatusFromError(response.error) ?? 500;
                    throw error;
                }

                if (!response.data) {
                    throw new Error('Nie udało się zaktualizować roli użytkownika');
                }

                return response.data;
            })
        );
    }

    updateUserAiCredits(
        userId: string,
        command: UpdateAdminUserAiCreditsCommand
    ): Observable<UpdateAdminUserAiCreditsResponseDto> {
        return from(
            this.supabase.functions.invoke<UpdateAdminUserAiCreditsResponseDto>(
                `admin/users/${userId}/ai-credits`,
                {
                    method: 'PATCH',
                    body: command,
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    const error = new Error(
                        response.error.message || 'Błąd aktualizacji kredytów AI'
                    ) as Error & { status?: number };
                    error.status = this.extractStatusFromError(response.error) ?? 500;
                    throw error;
                }

                if (!response.data) {
                    throw new Error('Nie udało się zaktualizować kredytów AI');
                }

                return response.data;
            })
        );
    }

    getUserAiCredits(
        userId: string
    ): Observable<UpdateAdminUserAiCreditsResponseDto> {
        return from(
            this.supabase.functions.invoke<UpdateAdminUserAiCreditsResponseDto>(
                `admin/users/${userId}/ai-credits`,
                { method: 'GET' }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    const error = new Error(
                        response.error.message || 'Błąd pobierania kredytów AI'
                    ) as Error & { status?: number };
                    error.status = this.extractStatusFromError(response.error) ?? 500;
                    throw error;
                }

                if (!response.data) {
                    throw new Error('Nie udało się pobrać kredytów AI');
                }

                return response.data;
            })
        );
    }

    private extractStatusFromError(error: {
        message?: string;
        status?: number;
        context?: { status?: number };
    }): number | null {
        if (error.status) return error.status;
        if (error.context?.status) return error.context.status;
        return null;
    }
}
