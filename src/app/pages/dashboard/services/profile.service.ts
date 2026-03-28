import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ProfileSettingsApiService } from '../../../core/services/profile-settings-api.service';
import { ProfileDto } from '../../../../../shared/contracts/types';

@Injectable({
    providedIn: 'root',
})
export class ProfileService {
    private readonly profileSettingsApi = inject(ProfileSettingsApiService);

    getProfile(): Observable<ProfileDto> {
        return this.profileSettingsApi.getProfileSettings().pipe(
            map((profile) => ({
                id: profile.id,
                username: profile.username,
            }))
        );
    }
}


