import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UnsavedChangesService {
    private readonly dirtySources = signal<ReadonlySet<string>>(new Set());
    readonly hasUnsavedChanges = computed(() => this.dirtySources().size > 0);

    constructor() {
        const win = inject(DOCUMENT).defaultView;
        win?.addEventListener('beforeunload', (event) => {
            if (!this.hasUnsavedChanges()) {
                return;
            }
            event.preventDefault();
            event.returnValue = '';
        });
    }

    setDirty(key: string, dirty: boolean): void {
        const current = this.dirtySources();
        const alreadyDirty = current.has(key);
        if (alreadyDirty === dirty) {
            return;
        }
        const next = new Set(current);
        if (dirty) {
            next.add(key);
        } else {
            next.delete(key);
        }
        this.dirtySources.set(next);
    }

    clear(key: string): void {
        this.setDirty(key, false);
    }
}
