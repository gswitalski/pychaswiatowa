import 'zone.js';
import 'zone.js/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ProfileSettingsApiService } from '../../../../../core/services/profile-settings-api.service';
import { CompleteProfileFormComponent } from './complete-profile-form.component';

describe('CompleteProfileFormComponent', () => {
    let fixture: ComponentFixture<CompleteProfileFormComponent>;
    let component: CompleteProfileFormComponent;
    const checkUsernameAvailable = vi.fn();

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        checkUsernameAvailable.mockReset();
        await TestBed.configureTestingModule({
            imports: [CompleteProfileFormComponent],
            providers: [
                {
                    provide: ProfileSettingsApiService,
                    useValue: { checkUsernameAvailable },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CompleteProfileFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('powinien walidować wymagane pole, długość i brak białych znaków', () => {
        const username = component.form.controls.username;

        username.setValue('ab');
        expect(username.hasError('minlength')).toBe(true);

        username.setValue('test user');
        expect(username.hasError('pattern')).toBe(true);

        username.setValue('a'.repeat(51));
        expect(username.hasError('maxlength')).toBe(true);
    });

    it('powinien oznaczyć zajętą nazwę jako nieprawidłową', async () => {
        checkUsernameAvailable.mockReturnValue(of({ available: false }));
        component.form.controls.username.setValue('zajeta-nazwa');
        await waitForAvailabilityCheck();

        expect(component.form.controls.username.hasError('usernameTaken')).toBe(true);
        expect(checkUsernameAvailable).toHaveBeenCalledWith('zajeta-nazwa');
    });

    it('powinien zezwolić na zapis, gdy sprawdzenie dostępności zakończy się błędem', async () => {
        checkUsernameAvailable.mockReturnValue(
            throwError(() => new Error('Network error'))
        );
        component.form.controls.username.setValue('dostepna-nazwa');
        await waitForAvailabilityCheck();

        expect(component.form.valid).toBe(true);
        expect(component.usernameCheckWarning()).toBe(true);
    });

    it('powinien emitować nazwę użytkownika tylko dla poprawnego formularza', async () => {
        const saveSpy = vi.fn();
        component.save.subscribe(saveSpy);
        checkUsernameAvailable.mockReturnValue(of({ available: true }));
        component.form.controls.username.setValue('test-user');
        await waitForAvailabilityCheck();

        component.submitForm();

        expect(saveSpy).toHaveBeenCalledWith('test-user');
    });
});

function waitForAvailabilityCheck(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 450));
}
