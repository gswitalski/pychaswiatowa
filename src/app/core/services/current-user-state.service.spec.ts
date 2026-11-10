import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MeDto, ProfileSettingsDto } from '../../../../shared/contracts/types';
import { CurrentUserStateService } from './current-user-state.service';

describe('CurrentUserStateService', () => {
    let service: CurrentUserStateService;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(() => {
        service = TestBed.inject(CurrentUserStateService);
        service.switchUser(null);
        service.switchUser('u1');
    });

    it('przechowuje nazwę i udostępnia przyciętą displayName', () => {
        service.applyMe({ id: 'u1', username: '  Jan  ' });

        expect(service.username()).toBe('  Jan  ');
        expect(service.displayName()).toBe('Jan');
    });

    it('ignoruje odpowiedzi nieaktywnego użytkownika i puste nazwy są niewidoczne', () => {
        service.applyMe({ id: 'u1', username: 'Jan' });
        service.applyMe({ id: 'u2', username: 'A' });
        expect(service.displayName()).toBe('Jan');

        service.applyProfile({ id: 'u1', username: '   ' });
        expect(service.displayName()).toBeNull();
    });

    it('czyści stan przy zmianie użytkownika, ale nie przy ponownym przełączeniu na ten sam id', () => {
        service.applyMe({ id: 'u1', username: 'Jan' });
        service.switchUser('u1');
        expect(service.displayName()).toBe('Jan');

        service.switchUser('u2');
        expect(service.displayName()).toBeNull();
    });

    it('nie przyjmuje danych bez aktywnego użytkownika', () => {
        service.switchUser(null);
        service.applyMe({ id: 'u1', username: 'Jan' });

        expect(service.username()).toBeNull();
    });

    it('ignoruje applyProfile z id innego użytkownika', () => {
        const profile: ProfileSettingsDto = {
            id: 'u2',
            email: 'u2@example.com',
            username: 'Użytkownik B',
            marketing_consent: false,
            marketing_consent_updated_at: null,
            marketing_consent_text_version: null,
        };

        service.applyProfile(profile);

        expect(service.username()).toBeNull();
        expect(service.displayName()).toBeNull();
    });

    it('ukrywa nazwę z samych białych znaków przekazaną przez applyProfile', () => {
        const profile: ProfileSettingsDto = {
            id: 'u1',
            email: 'u1@example.com',
            username: '   ',
            marketing_consent: false,
            marketing_consent_updated_at: null,
            marketing_consent_text_version: null,
        };

        service.applyMe({ id: 'u1', username: 'Jan' });
        service.applyProfile(profile);

        expect(service.username()).toBe('   ');
        expect(service.displayName()).toBeNull();
    });

    it('obsługuje sekwencję A → B → A bez przywracania starej nazwy', () => {
        const meA: Pick<MeDto, 'id' | 'username'> = { id: 'u1', username: 'Ala' };
        const meB: Pick<MeDto, 'id' | 'username'> = { id: 'u2', username: 'Bartek' };

        service.applyMe(meA);
        service.switchUser('u2');
        service.applyMe(meB);
        service.switchUser('u1');

        expect(service.displayName()).toBeNull();
        service.applyMe(meA);
        expect(service.displayName()).toBe('Ala');
    });
});
