import 'zone.js';
import 'zone.js/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeFlagsDto } from '../../../../../shared/contracts/types';
import { RecipeFlagsService } from '../../../core/services/recipe-flags.service';
import { RecipeFlagTogglesComponent } from './recipe-flag-toggles.component';

describe('RecipeFlagTogglesComponent', () => {
    const setFlags = vi.fn();
    const snackBarOpen = vi.fn();
    let fixture: ComponentFixture<RecipeFlagTogglesComponent>;
    let component: RecipeFlagTogglesComponent;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        setFlags.mockReset();
        snackBarOpen.mockReset();

        await TestBed.configureTestingModule({
            imports: [RecipeFlagTogglesComponent],
            providers: [
                {
                    provide: RecipeFlagsService,
                    useValue: { setFlags },
                },
                {
                    provide: MatSnackBar,
                    useValue: { open: snackBarOpen },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RecipeFlagTogglesComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('recipeId', 42);
        fixture.componentRef.setInput('isFavorite', false);
        fixture.componentRef.setInput('isWantToTry', false);
        fixture.detectChanges();
    });

    it('optymistycznie ustawia ulubiony i synchronizuje odpowiedź API', () => {
        const response$ = new Subject<RecipeFlagsDto>();
        const flagsChange = vi.fn();
        setFlags.mockReturnValue(response$);
        component.flagsChange.subscribe(flagsChange);

        component.toggleFavorite();

        expect(component.favorite()).toBe(true);
        expect(component.favoritePending()).toBe(true);
        expect(setFlags).toHaveBeenCalledWith(42, { is_favorite: true });

        const response: RecipeFlagsDto = {
            recipe_id: 42,
            is_favorite: true,
            is_want_to_try: true,
        };
        response$.next(response);
        response$.complete();

        expect(component.favoritePending()).toBe(false);
        expect(component.wantToTry()).toBe(true);
        expect(flagsChange).toHaveBeenCalledWith(response);
    });

    it('ignoruje kolejne kliknięcie tej samej flagi podczas zapisu', () => {
        setFlags.mockReturnValue(new Subject<RecipeFlagsDto>());

        component.toggleWantToTry();
        component.toggleWantToTry();

        expect(setFlags).toHaveBeenCalledOnce();
        expect(component.wantToTryPending()).toBe(true);
    });

    it('cofa zmianę i pokazuje ogólny komunikat po błędzie', () => {
        setFlags.mockReturnValue(
            throwError(() => ({ message: 'Server error', status: 500 }))
        );

        component.toggleFavorite();

        expect(component.favorite()).toBe(false);
        expect(component.favoritePending()).toBe(false);
        expect(snackBarOpen).toHaveBeenCalledWith(
            'Nie udało się zapisać. Spróbuj ponownie.',
            'OK',
            { duration: 5000 }
        );
    });

    it('emituje wygaśnięcie sesji po błędzie 401', () => {
        const sessionExpired = vi.fn();
        component.sessionExpired.subscribe(sessionExpired);
        setFlags.mockReturnValue(
            throwError(() => ({ message: 'Unauthorized', status: 401 }))
        );

        component.toggleWantToTry();

        expect(component.wantToTry()).toBe(false);
        expect(sessionExpired).toHaveBeenCalledOnce();
        expect(snackBarOpen).toHaveBeenCalledWith(
            'Sesja wygasła. Zaloguj się ponownie.',
            'OK',
            { duration: 5000 }
        );
    });

    it('udostępnia stan przełączników technologiom asystującym', () => {
        fixture.componentRef.setInput('isFavorite', true);
        fixture.detectChanges();

        const buttons = fixture.nativeElement.querySelectorAll('button');

        expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
        expect(buttons[0].getAttribute('aria-label')).toBe(
            'Ulubiony przepis'
        );
        expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    });
});
