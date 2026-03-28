import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    computed,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ProfileSettingsFacade } from './services/profile-settings.facade';
import {
    ProfileSettingsFormComponent,
    ProfileSettingsFormValue,
} from './components/profile-settings-form/profile-settings-form.component';
import { MARKETING_CONSENT_TEXT_VERSION } from '../../../../shared/contracts/marketing-consent';
import { ChangePasswordDialogComponent } from './components/change-password-dialog/change-password-dialog.component';

@Component({
    selector: 'pych-profile-settings-page',
    standalone: true,
    imports: [
        PageHeaderComponent,
        MatCardModule,
        MatButtonModule,
        MatDialogModule,
        MatSnackBarModule,
        ProfileSettingsFormComponent,
    ],
    providers: [ProfileSettingsFacade],
    templateUrl: './profile-settings-page.component.html',
    styleUrl: './profile-settings-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsPageComponent implements OnInit {
    private readonly facade = inject(ProfileSettingsFacade);
    private readonly dialog = inject(MatDialog);
    private readonly snackBar = inject(MatSnackBar);

    readonly profile = this.facade.profile;
    readonly isInitialLoading = this.facade.isInitialLoading;
    readonly isSavingProfile = this.facade.isSavingProfile;
    readonly loadError = this.facade.loadError;
    readonly saveError = this.facade.saveError;
    readonly lastSuccessMessage = this.facade.lastSuccessMessage;
    readonly canRenderForm = this.facade.canRenderForm;
    readonly loadingOverlayVisible = computed(
        () => this.isInitialLoading() && this.profile() !== null
    );

    ngOnInit(): void {
        this.facade.loadProfile();
    }

    retryLoad(): void {
        this.facade.loadProfile();
    }

    handleSaveProfile(formValue: ProfileSettingsFormValue): void {
        this.facade.saveProfile({
            username: formValue.username.trim(),
            marketing_consent: formValue.marketingConsent,
            marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION,
        });
    }

    openChangePasswordDialog(): void {
        this.dialog
            .open(ChangePasswordDialogComponent, {
                width: '500px',
                maxWidth: '95vw',
                disableClose: true,
                data: {
                    changePassword: this.facade.changePassword.bind(this.facade),
                },
            })
            .afterClosed()
            .subscribe((changed: boolean) => {
                if (!changed) {
                    return;
                }

                this.snackBar.open('Hasło zostało zmienione.', 'Zamknij', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'bottom',
                });
            });
    }
}
