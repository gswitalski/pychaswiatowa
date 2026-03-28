import 'zone.js';
import 'zone.js/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import {
    ChangePasswordDialogComponent,
    ChangePasswordDialogData,
} from './change-password-dialog.component';

describe('ChangePasswordDialogComponent', () => {
    const closeMock = vi.fn();
    const changePasswordMock = vi.fn();

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        closeMock.mockReset();
        changePasswordMock.mockReset();

        const dialogData: ChangePasswordDialogData = {
            changePassword: changePasswordMock,
        };

        TestBed.configureTestingModule({
            imports: [ChangePasswordDialogComponent],
            providers: [
                { provide: MatDialogRef, useValue: { close: closeMock } },
                { provide: MAT_DIALOG_DATA, useValue: dialogData },
            ],
        });
    });

    function createComponent() {
        const fixture = TestBed.createComponent(ChangePasswordDialogComponent);
        fixture.detectChanges();
        return { fixture, component: fixture.componentInstance };
    }

    it('powinien blokować submit przy niezgodnych hasłach', () => {
        const { component } = createComponent();

        component.form.controls.currentPassword.setValue('OldSecret123');
        component.form.controls.newPassword.setValue('NewSecret123');
        component.form.controls.confirmNewPassword.setValue('Mismatch123');
        component.onSubmit();

        expect(changePasswordMock).not.toHaveBeenCalled();
        expect(component.form.hasError('passwordMismatch')).toBe(true);
    });

    it('powinien zamknąć dialog po sukcesie zmiany hasła', () => {
        const { component } = createComponent();
        changePasswordMock.mockReturnValue(of({ status: 'ok', message: 'ok' }));

        component.form.controls.currentPassword.setValue('OldSecret123');
        component.form.controls.newPassword.setValue('NewSecret456');
        component.form.controls.confirmNewPassword.setValue('NewSecret456');
        component.onSubmit();

        expect(changePasswordMock).toHaveBeenCalledWith({
            current_password: 'OldSecret123',
            new_password: 'NewSecret456',
        });
        expect(closeMock).toHaveBeenCalledWith(true);
    });

    it('powinien przypisać błąd do currentPassword dla statusu 422', () => {
        const { component } = createComponent();
        changePasswordMock.mockReturnValue(
            throwError(() => ({
                message: 'Podane stare hasło jest niepoprawne.',
                status: 422,
            }))
        );

        component.form.controls.currentPassword.setValue('OldSecret123');
        component.form.controls.newPassword.setValue('NewSecret456');
        component.form.controls.confirmNewPassword.setValue('NewSecret456');
        component.onSubmit();

        expect(component.form.controls.currentPassword.hasError('incorrectCurrentPassword')).toBe(
            true
        );
        expect(component.submitError).toBe('Podane stare hasło jest niepoprawne.');
        expect(closeMock).not.toHaveBeenCalled();
    });
});
