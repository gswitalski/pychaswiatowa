import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileCompletionService } from '../services/profile-completion.service';
import { usernameCompleteMatchGuard } from './username-complete-match.guard';

describe('usernameCompleteMatchGuard', () => {
    const ensureChecked = vi.fn();
    const navigate = vi.fn();

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        await TestBed.configureTestingModule({
            providers: [
                {
                    provide: ProfileCompletionService,
                    useValue: { ensureChecked },
                },
                { provide: Router, useValue: { navigate } },
            ],
        }).compileComponents();
    });

    it('powinien dopuścić użytkownika z kompletnym profilem', async () => {
        ensureChecked.mockResolvedValue(true);

        const result = await TestBed.runInInjectionContext(() =>
            usernameCompleteMatchGuard({} as never, [] as never)
        );

        expect(result).toBe(true);
        expect(navigate).not.toHaveBeenCalled();
    });

    it('powinien przekierować użytkownika z niekompletnym profilem', async () => {
        ensureChecked.mockResolvedValue(false);

        const result = await TestBed.runInInjectionContext(() =>
            usernameCompleteMatchGuard({} as never, [] as never)
        );

        expect(result).toBe(false);
        expect(navigate).toHaveBeenCalledWith(['/auth/complete-profile']);
    });
});
