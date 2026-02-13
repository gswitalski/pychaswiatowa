import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AdminSummaryDto } from '../../../../shared/contracts/types';

@Injectable({
    providedIn: 'root',
})
export class AdminApiService {
    private readonly supabase = inject(SupabaseService);

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
