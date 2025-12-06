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
        return from(this.fetchProfile()).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                if (!result.data) {
                    throw new Error('Profile not found');
                }
                return result.data;
            })
        );
    }

    private async fetchProfile() {
        const { data: { user } } = await this.supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await this.supabase
            .from('profiles')
            .select('id, username')
            .eq('id', user.id)
            .single();

        return { data, error };
    }
}

