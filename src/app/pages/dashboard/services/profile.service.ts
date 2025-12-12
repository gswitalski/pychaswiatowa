import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ProfileDto } from '../../../../../shared/contracts/types';

@Injectable({
    providedIn: 'root',
})
export class ProfileService {
    private readonly supabase = inject(SupabaseService);

    getProfile(): Observable<ProfileDto> {
        return from(
            this.supabase.functions.invoke<ProfileDto>('profile', {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message);
                }
                if (!response.data) {
                    throw new Error('Profile not found');
                }
                return response.data;
            })
        );
    }
}


