import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import {
    ConfirmDialogComponent,
    ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { UnsavedChangesService } from '../services/unsaved-changes.service';

export const unsavedChangesGuard: CanDeactivateFn<unknown> = () => {
    const unsaved = inject(UnsavedChangesService);
    if (!unsaved.hasUnsavedChanges()) {
        return true;
    }

    const data: ConfirmDialogData = {
        title: 'Niezapisane zmiany',
        message: 'Masz niezapisaną notatkę. Jeśli opuścisz stronę, zmiany przepadną.',
        confirmText: 'Opuść',
        cancelText: 'Zostań',
        confirmColor: 'warn',
    };
    return inject(MatDialog)
        .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
            width: '400px',
            disableClose: true,
            data,
        })
        .afterClosed()
        .pipe(map((leave) => leave === true));
};
