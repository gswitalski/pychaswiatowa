import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AdminUserAiCreditsFormComponent } from './admin-user-ai-credits-form.component';
import { UpdateAdminUserAiCreditsResponseDto } from '../../../../../../shared/contracts/types';

describe('AdminUserAiCreditsFormComponent', () => {
    const initialCredits: UpdateAdminUserAiCreditsResponseDto = {
        user_id: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
        draft: { total: 10, used: 2, remaining: 8 },
        image: { total: 4, used: 1, remaining: 3 },
        limit_type: 'monthly',
        next_reset_at: '2099-10-15T00:00:00.000Z',
        updated_at: '2026-09-15T00:00:00.000Z',
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
            imports: [AdminUserAiCreditsFormComponent, NoopAnimationsModule],
        });
    });

    function createComponent() {
        const fixture = TestBed.createComponent(AdminUserAiCreditsFormComponent);
        fixture.componentRef.setInput('userId', initialCredits.user_id);
        fixture.componentRef.setInput('initialCredits', initialCredits);
        fixture.detectChanges();
        return fixture;
    }

    it('inicjalizuje formularz przekazanym saldem', () => {
        const fixture = createComponent();
        const form = fixture.componentInstance['form'];

        expect(form.getRawValue()).toEqual({
            limitType: 'monthly',
            draftTotal: 10,
            draftUsed: 2,
            imageTotal: 4,
            imageUsed: 1,
            nextResetAt: '2099-10-15',
        });
    });

    it('odrzuca wykorzystanie większe od całkowitego limitu', () => {
        const fixture = createComponent();
        const form = fixture.componentInstance['form'];

        form.controls.draftUsed.setValue(11);

        expect(form.hasError('draftUsedExceedsTotal')).toBe(true);
        expect(form.invalid).toBe(true);
    });

    it('przygotowuje wyzerowane wykorzystanie do wspólnego zapisu', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;

        component.resetCredits();

        expect(component.form.controls.draftUsed.value).toBe(0);
        expect(component.form.controls.imageUsed.value).toBe(0);
        expect(component.form.dirty).toBe(true);
    });
});
