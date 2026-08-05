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
import { SupabaseService } from '../services/supabase.service';
import { oauthCompleteProfileGuard } from './oauth-complete-profile.guard';

describe('oauthCompleteProfileGuard', () => {
    const getSession = vi.fn();
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
                    provide: SupabaseService,
                    useValue: { auth: { getSession } },
                },
                {
                    provide: ProfileCompletionService,
                    useValue: { ensureChecked },
                },
                { provide: Router, useValue: { navigate } },
            ],
        }).compileComponents();
    });

    it('powinien przekierować niezalogowanego użytkownika na /login', async () => {
        getSession.mockResolvedValue({ data: { session: null } });

        const result = await TestBed.runInInjectionContext(() =>
            oauthCompleteProfileGuard({} as never, {} as never)
        );

        expect(result).toBe(false);
        expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('powinien przekierować użytkownika z kompletnym profilem na dashboard', async () => {
        getSession.mockResolvedValue({ data: { session: {} } });
        ensureChecked.mockResolvedValue(true);

        const result = await TestBed.runInInjectionContext(() =>
            oauthCompleteProfileGuard({} as never, {} as never)
        );

        expect(result).toBe(false);
        expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('powinien dopuścić użytkownika z niekompletnym profilem', async () => {
        getSession.mockResolvedValue({ data: { session: {} } });
        ensureChecked.mockResolvedValue(false);

        const result = await TestBed.runInInjectionContext(() =>
            oauthCompleteProfileGuard({} as never, {} as never)
        );

        expect(result).toBe(true);
        expect(navigate).not.toHaveBeenCalled();
    });
});
