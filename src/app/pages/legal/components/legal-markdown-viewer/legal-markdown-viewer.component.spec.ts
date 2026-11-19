import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LegalMarkdownViewerComponent } from './legal-markdown-viewer.component';
import { AuthService } from '../../../../core/services/auth.service';
import { LoginDialogComponent } from '../../../../shared/components/login-dialog/login-dialog.component';

describe('LegalMarkdownViewerComponent', () => {
    const dialogOpen = vi.fn();
    const navigateByUrl = vi.fn();
    const isAuthenticated = signal(false);
    let httpTesting: HttpTestingController;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting(),
        );
    });

    beforeEach(() => {
        isAuthenticated.set(false);
        dialogOpen.mockReset();
        navigateByUrl.mockReset();

        TestBed.configureTestingModule({
            imports: [LegalMarkdownViewerComponent, NoopAnimationsModule],
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                {
                    provide: MatDialog,
                    useValue: { open: dialogOpen },
                },
                {
                    provide: Router,
                    useValue: { navigateByUrl },
                },
                {
                    provide: AuthService,
                    useValue: { isAuthenticated },
                },
            ],
        });

        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpTesting.verify();
    });

    function createClickEvent(anchor: HTMLAnchorElement): MouseEvent {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        vi.spyOn(event, 'preventDefault');
        Object.defineProperty(event, 'target', { value: anchor, configurable: true });
        return event;
    }

    function setupFixture() {
        const fixture = TestBed.createComponent(LegalMarkdownViewerComponent);
        fixture.componentRef.setInput('assetPath', '/assets/legal/subscription-terms.md');
        fixture.detectChanges();
        const request = httpTesting.expectOne('/assets/legal/subscription-terms.md');
        request.flush('# Test');
        fixture.detectChanges();
        return fixture;
    }

    it('otwiera dialog logowania po kliknięciu /settings jako gość', () => {
        const fixture = setupFixture();
        const anchor = document.createElement('a');
        anchor.setAttribute('href', '/settings');
        const event = createClickEvent(anchor);

        fixture.componentInstance.handleContentClick(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(dialogOpen).toHaveBeenCalledWith(LoginDialogComponent, {
            data: { nextUrl: '/settings' },
            width: '480px',
            maxWidth: 'calc(100vw - 32px)',
            panelClass: 'mobile-fullscreen-dialog',
        });
        expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('nawiguje SPA po kliknięciu /settings jako zalogowany użytkownik', () => {
        isAuthenticated.set(true);
        const fixture = setupFixture();
        const anchor = document.createElement('a');
        anchor.setAttribute('href', '/settings');
        const event = createClickEvent(anchor);

        fixture.componentInstance.handleContentClick(event);

        expect(navigateByUrl).toHaveBeenCalledWith('/settings');
        expect(dialogOpen).not.toHaveBeenCalled();
    });
});