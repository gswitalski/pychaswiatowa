import 'zone.js';
import 'zone.js/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRole } from '../../../../../../../shared/contracts/types';
import { AuthService } from '../../../../core/services/auth.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { TopbarComponent } from './topbar.component';
import { CurrentUserStateService } from '../../../../core/services/current-user-state.service';

@Component({ standalone: true, template: '' })
class EmptyRouteComponent {}

describe('TopbarComponent', () => {
    const appRoleSignal = signal<AppRole>('user');
    const isAuthenticatedSignal = signal(false);
    const isMobileSignal = signal(false);
    const isMobileOrTabletSignal = signal(false);

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        appRoleSignal.set('user');
        isAuthenticatedSignal.set(false);
        isMobileSignal.set(false);
        isMobileOrTabletSignal.set(false);

        await TestBed.configureTestingModule({
            providers: [
                provideRouter([
                    { path: 'recipes/new/assist', component: EmptyRouteComponent },
                    { path: '**', component: EmptyRouteComponent },
                ]),
                {
                    provide: AuthService,
                    useValue: {
                        appRole: appRoleSignal,
                        isAuthenticated: isAuthenticatedSignal,
                        signOut: vi.fn().mockResolvedValue(undefined),
                    } satisfies Partial<AuthService>,
                },
                {
                    provide: LayoutService,
                    useValue: {
                        isMobile: isMobileSignal,
                        isMobileOrTablet: isMobileOrTabletSignal,
                        toggleSidebar: vi.fn(),
                    } satisfies Partial<LayoutService>,
                },
            ],
            imports: [NoopAnimationsModule],
        }).compileComponents();
        TestBed.inject(CurrentUserStateService).switchUser(null);
    });

    it('powinien zawierać pozycję Admin dla roli admin', () => {
        const component = TestBed.runInInjectionContext(() => new TopbarComponent());
        appRoleSignal.set('admin');

        const routes = component.mainNavItems().map((item) => item.route);

        expect(routes).toContain('/admin/dashboard');
    });

    it('nie powinien zawierać pozycji Admin dla roli nie-admin', () => {
        const component = TestBed.runInInjectionContext(() => new TopbarComponent());
        appRoleSignal.set('user');

        const routes = component.mainNavItems().map((item) => item.route);

        expect(routes).not.toContain('/admin/dashboard');
    });

    it('renderuje nazwę w tym samym przycisku co ikonę', () => {
        isMobileOrTabletSignal.set(true);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        const currentUserState = TestBed.inject(CurrentUserStateService);
        currentUserState.switchUser('u1');
        currentUserState.applyMe({ id: 'u1', username: 'Kasia_Gotuje' });
        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector('.topbar__user-button') as HTMLButtonElement;
        const username = button.querySelector('.topbar__username') as HTMLElement;

        expect(username.textContent).toBe('Kasia_Gotuje');
        expect(button.querySelector('mat-icon')).toBeTruthy();
        expect(button.getAttribute('aria-label')).toBe('Zalogowano jako Kasia_Gotuje');
        expect(button.classList.contains('topbar__user-button--named')).toBe(true);
    });

    it.each([null, '', '   '])('pokazuje samą ikonę bez nazwy dla %j', (username) => {
        isMobileOrTabletSignal.set(true);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        const currentUserState = TestBed.inject(CurrentUserStateService);
        currentUserState.switchUser('u1');
        if (username !== null) {
            currentUserState.applyMe({ id: 'u1', username });
        }
        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector('.topbar__user-button') as HTMLButtonElement;
        const tooltip = fixture.debugElement
            .query(By.directive(MatTooltip))
            .injector.get(MatTooltip);

        expect(button.querySelector('.topbar__username')).toBeNull();
        expect(button.getAttribute('aria-label')).toBe('Menu użytkownika');
        expect(button.classList.contains('topbar__user-button--named')).toBe(false);
        expect(tooltip.disabled).toBe(true);
        expect(tooltip.message).toBe('');
    });

    it('obsługuje nazwę wielowyrazową, tooltip i bezpieczną interpolację HTML', () => {
        isMobileOrTabletSignal.set(true);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        const currentUserState = TestBed.inject(CurrentUserStateService);
        currentUserState.switchUser('u1');
        currentUserState.applyMe({ id: 'u1', username: '<b>x</b>' });
        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector('.topbar__user-button') as HTMLButtonElement;
        const username = button.querySelector('.topbar__username') as HTMLElement;
        const tooltip = fixture.debugElement
            .query(By.directive(MatTooltip))
            .injector.get(MatTooltip);

        expect(username.textContent).toBe('<b>x</b>');
        expect(button.querySelector('b')).toBeNull();
        expect(button.getAttribute('aria-label')).toBe('Zalogowano jako <b>x</b>');
        expect(tooltip.message).toBe('Zalogowano jako <b>x</b>');
        expect(tooltip.disabled).toBe(false);

        currentUserState.applyMe({ id: 'u1', username: 'Jan Kowalski' });
        fixture.detectChanges();
        expect(username.textContent).toBe('Jan Kowalski');
        expect(button.getAttribute('aria-label')).toBe('Zalogowano jako Jan Kowalski');
    });

    it('pokazuje nagłówek menu po otwarciu i nie pokazuje go bez nazwy', async () => {
        isMobileOrTabletSignal.set(true);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        const currentUserState = TestBed.inject(CurrentUserStateService);
        currentUserState.switchUser('u1');
        currentUserState.applyMe({ id: 'u1', username: 'Jan Kowalski' });
        fixture.detectChanges();

        fixture.debugElement.query(By.directive(MatMenuTrigger))
            .injector.get(MatMenuTrigger)
            .openMenu();
        fixture.detectChanges();
        await fixture.whenStable();

        const header = document.querySelector('.topbar__menu-header') as HTMLElement;
        expect(header.textContent).toContain('Zalogowano jako Jan Kowalski');
        expect(header.classList.contains('mat-mdc-menu-item')).toBe(false);
        expect(document.querySelector('.topbar__menu-header + mat-divider')).toBeTruthy();

        currentUserState.switchUser(null);
        fixture.detectChanges();
        document.body.dispatchEvent(new Event('click'));
        fixture.detectChanges();
        fixture.debugElement.query(By.directive(MatMenuTrigger))
            .injector.get(MatMenuTrigger)
            .openMenu();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.querySelector('.topbar__menu-header')).toBeNull();
    });

    it('umieszcza nagłówek nad pozycją Admin dla roli admin', async () => {
        appRoleSignal.set('admin');
        isMobileOrTabletSignal.set(true);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        const currentUserState = TestBed.inject(CurrentUserStateService);
        currentUserState.switchUser('u1');
        currentUserState.applyMe({ id: 'u1', username: 'Admin User' });
        fixture.detectChanges();

        fixture.debugElement.query(By.directive(MatMenuTrigger))
            .injector.get(MatMenuTrigger)
            .openMenu();
        fixture.detectChanges();
        await fixture.whenStable();

        const header = document.querySelector('.topbar__menu-header') as HTMLElement;
        const adminItem = Array.from(document.querySelectorAll('.mat-mdc-menu-item')).find((item) =>
            item.textContent?.includes('Admin'),
        ) as HTMLElement | undefined;

        expect(header).toBeTruthy();
        expect(adminItem).toBeTruthy();
        expect(
            Boolean(header.compareDocumentPosition(adminItem as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
        ).toBe(true);
    });

    it('pokazuje przycisk dodawania przepisu dla zalogowanego użytkownika poza kreatorem', async () => {
        isAuthenticatedSignal.set(true);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        fixture.detectChanges();

        let addButton = fixture.nativeElement.querySelector('.topbar__add-recipe');
        expect(addButton).toBeTruthy();

        const router = TestBed.inject(Router);
        await router.navigateByUrl('/recipes/new/assist');
        fixture.detectChanges();
        addButton = fixture.nativeElement.querySelector('.topbar__add-recipe');
        expect(addButton).toBeNull();
    });

    it('pokazuje przycisk na trasie bez sidebara gdy użytkownik jest zalogowany', () => {
        isAuthenticatedSignal.set(true);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('.topbar__add-recipe')).toBeTruthy();
    });

    it('nawiguje do AI z obrazem na mobile/tablet', () => {
        isAuthenticatedSignal.set(true);
        isMobileOrTabletSignal.set(true);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        fixture.detectChanges();

        const router = TestBed.inject(Router);
        vi.spyOn(router, 'navigate').mockResolvedValue(true);

        const button = fixture.nativeElement.querySelector('.topbar__add-recipe') as HTMLButtonElement;
        button.click();

        expect(router.navigate).toHaveBeenCalledWith(['/recipes/new/assist'], {
            queryParams: { source: 'image' },
        });
        expect(button.getAttribute('aria-label')).toBe('Dodaj przepis ze zdjęcia AI');
    });

    it('nawiguje do strony wyboru na desktopie', () => {
        isAuthenticatedSignal.set(true);
        isMobileOrTabletSignal.set(false);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        fixture.detectChanges();

        const router = TestBed.inject(Router);
        vi.spyOn(router, 'navigate').mockResolvedValue(true);

        const button = fixture.nativeElement.querySelector('.topbar__add-recipe') as HTMLButtonElement;
        button.click();

        expect(router.navigate).toHaveBeenCalledWith(['/recipes/new/start']);
        expect(button.getAttribute('aria-label')).toBe('Dodaj przepis');
    });

    it('aktualizuje nazwę reaktywnie bez odtwarzania przycisku', () => {
        isMobileOrTabletSignal.set(true);
        const fixture = TestBed.createComponent(TopbarComponent);
        fixture.componentRef.setInput('shouldShowSidebar', false);
        const currentUserState = TestBed.inject(CurrentUserStateService);
        currentUserState.switchUser('u1');
        fixture.detectChanges();
        const buttonBefore = fixture.nativeElement.querySelector('.topbar__user-button');

        currentUserState.applyMe({ id: 'u1', username: 'Jan Kowalski' });
        fixture.detectChanges();

        const buttonAfter = fixture.nativeElement.querySelector('.topbar__user-button');
        expect(buttonAfter).toBe(buttonBefore);
        expect(buttonAfter.textContent).toContain('Jan Kowalski');
        expect(buttonAfter.getAttribute('aria-label')).toBe('Zalogowano jako Jan Kowalski');
    });
});
