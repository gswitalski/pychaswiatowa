import 'zone.js';
import 'zone.js/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeRatingDto } from '../../../../../shared/contracts/types';
import { RecipeRatingService } from '../../../core/services/recipe-rating.service';
import { RecipeRatingComponent } from './recipe-rating.component';

describe('RecipeRatingComponent', () => {
    const setRating = vi.fn();
    const snackBarOpen = vi.fn();
    let fixture: ComponentFixture<RecipeRatingComponent>;
    let component: RecipeRatingComponent;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        setRating.mockReset();
        snackBarOpen.mockReset();

        await TestBed.configureTestingModule({
            imports: [RecipeRatingComponent],
            providers: [
                {
                    provide: RecipeRatingService,
                    useValue: { setRating },
                },
                {
                    provide: MatSnackBar,
                    useValue: { open: snackBarOpen },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RecipeRatingComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('recipeId', 42);
        fixture.componentRef.setInput('isAuthenticated', true);
        fixture.componentRef.setInput('isOwner', false);
        fixture.detectChanges();
    });

    it('zapisuje klikniętą gwiazdkę i emituje odpowiedź API', () => {
        const response: RecipeRatingDto = {
            recipe_id: 42,
            my_rating: 4,
            average_rating: 4,
            ratings_count: 1,
        };
        const ratingChange = vi.fn();
        component.ratingChange.subscribe(ratingChange);
        setRating.mockReturnValue(of(response));

        const stars = fixture.nativeElement.querySelectorAll(
            'button[role="radio"]'
        );
        stars[3].click();

        expect(setRating).toHaveBeenCalledWith(42, 4);
        expect(ratingChange).toHaveBeenCalledWith(response);
        expect(snackBarOpen).toHaveBeenCalledWith(
            'Twoja ocena została zapisana',
            'OK',
            { duration: 3000 }
        );
    });

    it('wycofuje ocenę po kliknięciu aktualnej gwiazdki', () => {
        fixture.componentRef.setInput('myRating', 5);
        fixture.detectChanges();
        setRating.mockReturnValue(
            of({
                recipe_id: 42,
                my_rating: null,
                average_rating: null,
                ratings_count: 0,
            })
        );

        fixture.nativeElement
            .querySelectorAll('button[role="radio"]')[4]
            .click();

        expect(setRating).toHaveBeenCalledWith(42, null);
        expect(snackBarOpen).toHaveBeenCalledWith(
            'Twoja ocena została usunięta',
            'OK',
            { duration: 3000 }
        );
    });

    it('cofa ocenę i przekierowuje do logowania po błędzie 401', () => {
        const sessionExpired = vi.fn();
        component.sessionExpired.subscribe(sessionExpired);
        setRating.mockReturnValue(
            throwError(() => ({ status: 401 }))
        );

        fixture.nativeElement
            .querySelectorAll('button[role="radio"]')[2]
            .click();

        expect(sessionExpired).toHaveBeenCalledOnce();
        expect(snackBarOpen).toHaveBeenCalledWith(
            'Sesja wygasła. Zaloguj się ponownie.',
            'OK',
            { duration: 5000 }
        );
    });

    it('blokuje drugi zapis w trakcie oczekiwania na odpowiedź', () => {
        const response$ = new Subject<RecipeRatingDto>();
        setRating.mockReturnValue(response$);
        const star = fixture.nativeElement.querySelectorAll(
            'button[role="radio"]'
        )[1];

        star.click();
        star.click();

        expect(setRating).toHaveBeenCalledOnce();
    });

    it('renderuje dla gościa tylko stan do odczytu oraz akcję logowania', () => {
        const loginRequested = vi.fn();
        component.loginRequested.subscribe(loginRequested);
        fixture.componentRef.setInput('isAuthenticated', false);
        fixture.componentRef.setInput('averageRating', 4.3);
        fixture.componentRef.setInput('ratingsCount', 27);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelectorAll('button[role="radio"]')
        ).toHaveLength(0);
        expect(
            fixture.nativeElement.querySelector('[role="img"]').getAttribute(
                'aria-label'
            )
        ).toContain('Średnia ocena 4,3');

        fixture.nativeElement
            .querySelector('button[mat-button]')
            .click();
        expect(loginRequested).toHaveBeenCalledOnce();
    });
});
