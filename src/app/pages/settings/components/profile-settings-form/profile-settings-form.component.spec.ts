import 'zone.js';
import 'zone.js/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ProfileSettingsFormComponent } from './profile-settings-form.component';
import { ProfileSettingsDto } from '../../../../../../../shared/contracts/types';

describe('ProfileSettingsFormComponent', () => {
    const profile: ProfileSettingsDto = {
        id: 'user-1',
        email: 'test@pychaswiatowa.pl',
        username: 'kucharz',
        marketing_consent: true,
        marketing_consent_updated_at: null,
        marketing_consent_text_version: 'marketing-consent-pl-v1',
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [ProfileSettingsFormComponent],
        });
    });

    function createComponent() {
        const fixture = TestBed.createComponent(ProfileSettingsFormComponent);
        fixture.componentRef.setInput('profile', profile);
        fixture.detectChanges();
        return { fixture, component: fixture.componentInstance };
    }

    it('powinien zainicjalizować formularz wartościami z profilu', () => {
        const { component } = createComponent();

        expect(component.form.getRawValue()).toEqual({
            email: 'test@pychaswiatowa.pl',
            username: 'kucharz',
            marketingConsent: true,
        });
        expect(component.form.dirty).toBe(false);
    });

    it('powinien emitować zapis z przyciętą nazwą użytkownika', () => {
        const { component } = createComponent();
        const emitSpy = vi.spyOn(component.saveProfile, 'emit');

        component.form.controls.username.setValue('  nowy-user  ');
        component.form.markAsDirty();
        component.submitForm();

        expect(emitSpy).toHaveBeenCalledWith({
            email: 'test@pychaswiatowa.pl',
            username: 'nowy-user',
            marketingConsent: true,
        });
    });

    it('nie powinien emitować zapisu gdy formularz nie jest dirty', () => {
        const { component } = createComponent();
        const emitSpy = vi.spyOn(component.saveProfile, 'emit');

        component.submitForm();

        expect(emitSpy).not.toHaveBeenCalled();
    });

    it('powinien mapować błąd 409 na błąd pola username', () => {
        const { fixture, component } = createComponent();

        fixture.componentRef.setInput('submitErrorStatus', 409);
        fixture.detectChanges();

        expect(component.form.controls.username.hasError('serverConflict')).toBe(true);
        expect(component.getUsernameErrorMessage()).toBe(
            'Ta nazwa użytkownika jest już zajęta.'
        );
    });
});
