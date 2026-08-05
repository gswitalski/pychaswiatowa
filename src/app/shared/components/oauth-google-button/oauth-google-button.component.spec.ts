import 'zone.js';
import 'zone.js/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OauthGoogleButtonComponent } from './oauth-google-button.component';

describe('OauthGoogleButtonComponent', () => {
    let fixture: ComponentFixture<OauthGoogleButtonComponent>;
    let component: OauthGoogleButtonComponent;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [OauthGoogleButtonComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(OauthGoogleButtonComponent);
        component = fixture.componentInstance;
        component.label = 'Zaloguj się przez Google';
        fixture.detectChanges();
    });

    it('powinien emitować clicked po kliknięciu, gdy nie trwa ładowanie', () => {
        const clickedSpy = vi.fn();
        component.clicked.subscribe(clickedSpy);

        component.handleClick();

        expect(clickedSpy).toHaveBeenCalledOnce();
    });

    it('nie powinien emitować clicked podczas ładowania', () => {
        const clickedSpy = vi.fn();
        component.clicked.subscribe(clickedSpy);
        component.isLoading = true;

        component.handleClick();

        expect(clickedSpy).not.toHaveBeenCalled();
    });
});
