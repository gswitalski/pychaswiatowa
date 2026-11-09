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
import { RecipeNoteDto } from '../../../../../shared/contracts/types';
import { RecipeNoteService } from '../../../core/services/recipe-note.service';
import { RecipePersonalNoteComponent } from './recipe-personal-note.component';

describe('RecipePersonalNoteComponent', () => {
    const updateNote = vi.fn();
    const snackBarOpen = vi.fn();
    let fixture: ComponentFixture<RecipePersonalNoteComponent>;
    let component: RecipePersonalNoteComponent;

    const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const textarea = (): HTMLTextAreaElement =>
        element().querySelector('textarea') as HTMLTextAreaElement;
    const saveButton = (): HTMLButtonElement =>
        element().querySelector('button') as HTMLButtonElement;

    const typeNote = (value: string): void => {
        const field = textarea();
        field.value = value;
        field.dispatchEvent(new Event('input'));
        fixture.detectChanges();
    };

    const setMyNote = (note: string | null): void => {
        fixture.componentRef.setInput('myNote', note);
        fixture.detectChanges();
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        updateNote.mockReset();
        snackBarOpen.mockReset();

        await TestBed.configureTestingModule({
            imports: [RecipePersonalNoteComponent],
            providers: [
                { provide: RecipeNoteService, useValue: { updateNote } },
                { provide: MatSnackBar, useValue: { open: snackBarOpen } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RecipePersonalNoteComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('recipeId', 42);
        fixture.detectChanges();
    });

    describe('renderowanie', () => {
        it('renderuje nagłówek, podpowiedź prywatności, etykietę i licznik znaków', () => {
            expect(element().querySelector('h2')?.textContent).toContain(
                'Moja notatka'
            );
            expect(element().textContent).toContain('Widoczne tylko dla Ciebie.');
            expect(element().querySelector('mat-label')?.textContent).toContain(
                'Twoje uwagi do przepisu'
            );
            expect(element().textContent).toContain('0 / 2000');
        });

        it('pokazuje pustą notatkę i zablokowany przycisk zapisu bez zmian', () => {
            expect(textarea().value).toBe('');
            expect(saveButton().disabled).toBe(true);
            expect(saveButton().textContent?.trim()).toBe('Zapisz');
        });

        it('wypełnia pole zapisaną notatką i aktualizuje licznik', () => {
            setMyNote('Mniej soli');

            expect(textarea().value).toBe('Mniej soli');
            expect(element().textContent).toContain('10 / 2000');
            expect(saveButton().disabled).toBe(true);
        });

        it('ustawia limit znaków w atrybucie maxlength', () => {
            expect(textarea().getAttribute('maxlength')).toBe('2000');
        });

        it('resetuje szkic po zmianie zapisanej notatki z zewnątrz', () => {
            setMyNote('Pierwsza');
            typeNote('Edytowana');

            setMyNote('Druga');

            expect(textarea().value).toBe('Druga');
        });
    });

    describe('dostępność (WCAG 2.5.3 Label in Name)', () => {
        it('pole nie ma aria-label rozjeżdżającego się z widoczną etykietą', () => {
            expect(textarea().hasAttribute('aria-label')).toBe(false);
        });

        it('nazwa pola pochodzi z widocznej etykiety powiązanej przez for/id', () => {
            const label = element().querySelector('label') as HTMLLabelElement;

            expect(label).not.toBeNull();
            expect(label.textContent).toContain('Twoje uwagi do przepisu');
            expect(textarea().id).not.toBe('');
            expect(label.getAttribute('for')).toBe(textarea().id);
        });

        it('przycisk nie ma aria-label sprzecznego z widocznym tekstem', () => {
            expect(saveButton().hasAttribute('aria-label')).toBe(false);
            typeNote('Coś');
            expect(saveButton().textContent?.trim()).toBe('Zapisz');
        });

        it('sekcja jest nazwana nagłówkiem', () => {
            const section = element().querySelector('section') as HTMLElement;
            const heading = element().querySelector('h2') as HTMLElement;

            expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
        });
    });

    describe('edycja', () => {
        it('odblokowuje zapis po zmianie treści i aktualizuje licznik', () => {
            typeNote('Dodać chili');

            expect(saveButton().disabled).toBe(false);
            expect(element().textContent).toContain('11 / 2000');
        });

        it('nie odblokowuje zapisu, gdy zmieniły się tylko białe znaki na brzegach', () => {
            setMyNote('Notatka');
            typeNote('  Notatka  ');

            expect(saveButton().disabled).toBe(true);
        });

        it('nie odblokowuje zapisu dla samych białych znaków przy pustej notatce', () => {
            typeNote('   ');

            expect(saveButton().disabled).toBe(true);
        });

        it('blokuje zapis po przekroczeniu 2000 znaków (licznik pokazuje przekroczenie)', () => {
            // `mat-error` bez NgControl nie jest renderowany przez mat-form-field;
            // blokada zapisu i licznik to faktyczne zachowanie (znane Minor).
            typeNote('a'.repeat(2001));

            expect(element().textContent).toContain('2001 / 2000');
            expect(saveButton().disabled).toBe(true);

            saveButton().click();
            expect(updateNote).not.toHaveBeenCalled();
        });

        it('pozwala zapisać dokładnie 2000 znaków', () => {
            typeNote('a'.repeat(2000));

            expect(element().querySelector('mat-error')).toBeNull();
            expect(saveButton().disabled).toBe(false);
        });
    });

    describe('zapis', () => {
        it('zapisuje przyciętą notatkę, emituje odpowiedź API i pokazuje potwierdzenie', () => {
            const response: RecipeNoteDto = {
                recipe_id: 42,
                my_note: 'Dodać chili',
            };
            const noteChange = vi.fn();
            component.noteChange.subscribe(noteChange);
            updateNote.mockReturnValue(of(response));

            typeNote('  Dodać chili  ');
            saveButton().click();

            expect(updateNote).toHaveBeenCalledWith(42, 'Dodać chili');
            expect(noteChange).toHaveBeenCalledWith(response);
            expect(snackBarOpen).toHaveBeenCalledWith(
                'Notatka została zapisana',
                'OK',
                { duration: 3000 }
            );
        });

        it('po zapisie i odświeżeniu wejścia przycisk wraca do stanu zablokowanego', () => {
            updateNote.mockReturnValue(
                of({ recipe_id: 42, my_note: 'Nowa' } as RecipeNoteDto)
            );

            typeNote('Nowa');
            saveButton().click();
            setMyNote('Nowa');

            expect(saveButton().disabled).toBe(true);
            expect(textarea().value).toBe('Nowa');
        });
    });

    describe('usunięcie notatki', () => {
        it('wysyła null po wyczyszczeniu istniejącej notatki', () => {
            const response: RecipeNoteDto = { recipe_id: 42, my_note: null };
            const noteChange = vi.fn();
            component.noteChange.subscribe(noteChange);
            updateNote.mockReturnValue(of(response));
            setMyNote('Do usunięcia');

            typeNote('');
            expect(saveButton().disabled).toBe(false);
            saveButton().click();

            expect(updateNote).toHaveBeenCalledWith(42, null);
            expect(noteChange).toHaveBeenCalledWith(response);
            expect(snackBarOpen).toHaveBeenCalledWith(
                'Notatka została usunięta',
                'OK',
                { duration: 3000 }
            );
        });

        it('traktuje szkic z samych białych znaków jako usunięcie', () => {
            updateNote.mockReturnValue(
                of({ recipe_id: 42, my_note: null } as RecipeNoteDto)
            );
            setMyNote('Do usunięcia');

            typeNote('   ');
            saveButton().click();

            expect(updateNote).toHaveBeenCalledWith(42, null);
        });
    });

    describe('błędy API', () => {
        it('pokazuje komunikat błędu, zachowuje szkic i odblokowuje ponowną próbę', () => {
            const noteChange = vi.fn();
            const sessionExpired = vi.fn();
            component.noteChange.subscribe(noteChange);
            component.sessionExpired.subscribe(sessionExpired);
            updateNote.mockReturnValue(
                throwError(() => Object.assign(new Error('boom'), { status: 500 }))
            );

            typeNote('Ważna treść');
            saveButton().click();
            fixture.detectChanges();

            expect(snackBarOpen).toHaveBeenCalledWith(
                'Nie udało się zapisać notatki. Spróbuj ponownie.',
                'OK',
                { duration: 5000 }
            );
            expect(noteChange).not.toHaveBeenCalled();
            expect(sessionExpired).not.toHaveBeenCalled();
            expect(textarea().value).toBe('Ważna treść');
            expect(saveButton().disabled).toBe(false);
            expect(saveButton().textContent?.trim()).toBe('Zapisz');
        });

        it('emituje sessionExpired po 401 bez komunikatu błędu zapisu', () => {
            const sessionExpired = vi.fn();
            component.sessionExpired.subscribe(sessionExpired);
            updateNote.mockReturnValue(
                throwError(() => Object.assign(new Error('401'), { status: 401 }))
            );

            typeNote('Treść');
            saveButton().click();
            fixture.detectChanges();

            expect(sessionExpired).toHaveBeenCalledOnce();
            expect(snackBarOpen).not.toHaveBeenCalled();
            expect(textarea().value).toBe('Treść');
            expect(saveButton().disabled).toBe(false);
        });

        it('pozwala ponowić zapis po błędzie', () => {
            updateNote.mockReturnValueOnce(
                throwError(() => Object.assign(new Error('boom'), { status: 500 }))
            );
            updateNote.mockReturnValueOnce(
                of({ recipe_id: 42, my_note: 'Treść' } as RecipeNoteDto)
            );

            typeNote('Treść');
            saveButton().click();
            fixture.detectChanges();
            saveButton().click();

            expect(updateNote).toHaveBeenCalledTimes(2);
            expect(snackBarOpen).toHaveBeenLastCalledWith(
                'Notatka została zapisana',
                'OK',
                { duration: 3000 }
            );
        });
    });

    describe('błąd odczytu notatki (ochrona przed nadpisaniem)', () => {
        const alertText = (): string | undefined =>
            element().querySelector('[role="alert"]')?.textContent?.trim();

        it('przy noteUnavailable pokazuje alert, blokuje pole i zapis', () => {
            fixture.componentRef.setInput('noteUnavailable', true);
            fixture.detectChanges();

            expect(alertText()).toContain('Nie udało się wczytać Twojej notatki');
            expect(textarea().disabled).toBe(true);
            expect(saveButton().disabled).toBe(true);
        });

        it('nie wysyła zapisu mimo wymuszonej zmiany szkicu i kliknięcia', () => {
            fixture.componentRef.setInput('noteUnavailable', true);
            fixture.detectChanges();

            typeNote('Nadpisanie');
            saveButton().click();
            component['saveNote']();

            expect(updateNote).not.toHaveBeenCalled();
            expect(saveButton().disabled).toBe(true);
        });

        it('traktuje nieznaną wartość (undefined) jak niedostępną, nigdy jak brak notatki', () => {
            fixture.componentRef.setInput('myNote', undefined);
            fixture.detectChanges();

            expect(alertText()).toContain('Nie udało się wczytać Twojej notatki');
            expect(textarea().disabled).toBe(true);
            expect(saveButton().disabled).toBe(true);
        });

        it('null (brak notatki) NIE jest błędem: bez alertu, pole edytowalne', () => {
            setMyNote(null);

            expect(alertText()).toBeUndefined();
            expect(textarea().disabled).toBe(false);

            typeNote('Pierwsza notatka');
            expect(saveButton().disabled).toBe(false);
        });

        it('odblokowuje edycję, gdy kolejne dane zawierają poprawną notatkę', () => {
            fixture.componentRef.setInput('noteUnavailable', true);
            fixture.detectChanges();
            expect(textarea().disabled).toBe(true);

            fixture.componentRef.setInput('noteUnavailable', false);
            setMyNote('Zapisana');

            expect(alertText()).toBeUndefined();
            expect(textarea().disabled).toBe(false);
            expect(textarea().value).toBe('Zapisana');
        });
    });

    describe('stan ładowania', () => {
        it('w trakcie zapisu blokuje przycisk, pokazuje „Zapisywanie…” i aria-busy', () => {
            const response$ = new Subject<RecipeNoteDto>();
            updateNote.mockReturnValue(response$);

            typeNote('Treść');
            expect(saveButton().getAttribute('aria-busy')).toBe('false');

            saveButton().click();
            fixture.detectChanges();

            expect(saveButton().disabled).toBe(true);
            expect(saveButton().textContent?.trim()).toBe('Zapisywanie…');
            expect(saveButton().getAttribute('aria-busy')).toBe('true');
        });

        it('blokuje drugi zapis w trakcie oczekiwania na odpowiedź', () => {
            updateNote.mockReturnValue(new Subject<RecipeNoteDto>());

            typeNote('Treść');
            saveButton().click();
            fixture.detectChanges();
            saveButton().click();

            expect(updateNote).toHaveBeenCalledOnce();
        });

        it('po odpowiedzi API kończy ładowanie', () => {
            const response$ = new Subject<RecipeNoteDto>();
            updateNote.mockReturnValue(response$);

            typeNote('Treść');
            saveButton().click();
            response$.next({ recipe_id: 42, my_note: 'Treść' });
            response$.complete();
            setMyNote('Treść');

            expect(saveButton().textContent?.trim()).toBe('Zapisz');
            expect(saveButton().getAttribute('aria-busy')).toBe('false');
        });
    });
});
