import 'zone.js';
import 'zone.js/testing';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { FormArray, FormBuilder, FormControl } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { EditableListComponent } from './editable-list.component';

describe('EditableListComponent', () => {
    let fb: FormBuilder;

    // Inicjalizacja środowiska testowego Angular
    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        fb = new FormBuilder();
    });

    /**
     * Funkcja pomocnicza do renderowania komponentu z konfiguracją
     */
    async function setupComponent(componentProperties: {
        formArray?: FormArray<FormControl<string>>;
        label?: string;
        placeholder?: string;
    } = {}) {
        const user = userEvent.setup();

        // Domyślne wartości
        const defaultFormArray = fb.array([
            fb.control('Element 1', { nonNullable: true }),
            fb.control('Element 2', { nonNullable: true }),
        ]);

        const defaultProperties = {
            formArray: defaultFormArray,
            label: 'Element',
            placeholder: 'Dodaj nowy element',
        };

        const rendered = await render(EditableListComponent, {
            imports: [NoopAnimationsModule],
            componentProperties: {
                ...defaultProperties,
                ...componentProperties,
            },
        });

        return { ...rendered, user };
    }

    describe('Inicjalizacja i renderowanie', () => {
        it('powinien wyrenderować wszystkie elementy z FormArray', async () => {
            // Arrange & Act
            const formArray = fb.array([
                fb.control('Pierwszy element', { nonNullable: true }),
                fb.control('Drugi element', { nonNullable: true }),
                fb.control('Trzeci element', { nonNullable: true }),
            ]);
            await setupComponent({ formArray });

            // Assert
            // Jeśli getByText znajdzie element, oznacza że jest w dokumencie
            expect(screen.getByText('Pierwszy element')).toBeTruthy();
            expect(screen.getByText('Drugi element')).toBeTruthy();
            expect(screen.getByText('Trzeci element')).toBeTruthy();
        });

        it('powinien wyrenderować komunikat o pustej liście gdy FormArray jest pusty', async () => {
            // Arrange & Act
            const formArray = fb.array<FormControl<string>>([]);
            await setupComponent({ formArray });

            // Assert
            expect(
                screen.getByText(/Brak elementów. Dodaj pierwszy element./i)
            ).toBeTruthy();
        });

        it('powinien wyrenderować nagłówki innym stylem (wartości z # na początku)', async () => {
            // Arrange & Act
            const formArray = fb.array([
                fb.control('# Nagłówek sekcji', { nonNullable: true }),
                fb.control('Zwykły element', { nonNullable: true }),
            ]);
            await setupComponent({ formArray });

            // Assert
            // Nagłówek powinien być wyświetlony bez znaku #
            expect(screen.getByText('Nagłówek sekcji')).toBeTruthy();
            expect(screen.getByText('Zwykły element')).toBeTruthy();

            // Sprawdź, czy nagłówek ma specjalną klasę
            const headerItem = screen
                .getByText('Nagłówek sekcji')
                .closest('.list-item');
            expect(headerItem?.classList.contains('is-header')).toBe(true);
        });

        it('powinien wyrenderować przycisk dodawania z customowym labelem', async () => {
            // Arrange & Act
            await setupComponent({
                formArray: fb.array<FormControl<string>>([]),
                label: 'Składnik',
            });

            // Assert
            expect(screen.getByLabelText('Składnik')).toBeTruthy();
        });
    });

    describe('Dodawanie elementu', () => {
        it('powinien mieć wyłączony przycisk "Dodaj" gdy pole jest puste', async () => {
            // Arrange & Act
            await setupComponent({ formArray: fb.array<FormControl<string>>([]) });

            // Assert
            const addButton = screen.getByRole('button', { name: /Dodaj/i });
            expect(addButton.hasAttribute('disabled')).toBe(true);
        });

        it('powinien aktywować przycisk "Dodaj" po wpisaniu tekstu', async () => {
            // Arrange
            const { user } = await setupComponent({ formArray: fb.array<FormControl<string>>([]) });

            // Act
            const input = screen.getByPlaceholderText('Dodaj nowy element');
            await user.type(input, 'Nowy element');

            // Assert
            const addButton = screen.getByRole('button', { name: /Dodaj/i });
            expect(addButton.hasAttribute('disabled')).toBe(false);
        });

        it('powinien dodać nowy element do FormArray po kliknięciu "Dodaj"', async () => {
            // Arrange
            const formArray = fb.array<FormControl<string>>([]);
            const { user } = await setupComponent({ formArray });

            // Act
            const input = screen.getByPlaceholderText('Dodaj nowy element');
            await user.type(input, 'Nowy element testowy');

            const addButton = screen.getByRole('button', { name: /Dodaj/i });
            await user.click(addButton);

            // Assert
            expect(formArray.length).toBe(1);
            expect(formArray.at(0).value).toBe('Nowy element testowy');
            expect(
                screen.getByText('Nowy element testowy')
            ).toBeTruthy();
        });

        it('powinien wyczyścić pole tekstowe po dodaniu elementu', async () => {
            // Arrange
            const formArray = fb.array<FormControl<string>>([]);
            const { user } = await setupComponent({ formArray });

            // Act
            const input = screen.getByPlaceholderText(
                'Dodaj nowy element'
            ) as HTMLInputElement;
            await user.type(input, 'Nowy element');

            const addButton = screen.getByRole('button', { name: /Dodaj/i });
            await user.click(addButton);

            // Assert
            expect(input.value).toBe('');
        });

        it('powinien dodać element po naciśnięciu Enter w polu tekstowym', async () => {
            // Arrange
            const formArray = fb.array<FormControl<string>>([]);
            const { user } = await setupComponent({ formArray });

            // Act
            const input = screen.getByPlaceholderText('Dodaj nowy element');
            await user.type(input, 'Element z Enter{Enter}');

            // Assert
            expect(formArray.length).toBe(1);
            expect(formArray.at(0).value).toBe('Element z Enter');
        });

        it('nie powinien dodać elementu jeśli zawiera tylko białe znaki', async () => {
            // Arrange
            const formArray = fb.array<FormControl<string>>([]);
            const { user } = await setupComponent({ formArray });

            // Act
            const input = screen.getByPlaceholderText('Dodaj nowy element');
            await user.type(input, '   ');

            // Assert
            // Przycisk powinien być disabled gdy input zawiera tylko białe znaki
            const addButton = screen.getByRole('button', { name: /Dodaj/i });
            expect(addButton.hasAttribute('disabled')).toBe(true);
            expect(formArray.length).toBe(0);
        });

        it('powinien przyciąć białe znaki z początku i końca przy dodawaniu', async () => {
            // Arrange
            const formArray = fb.array<FormControl<string>>([]);
            const { user } = await setupComponent({ formArray });

            // Act
            const input = screen.getByPlaceholderText('Dodaj nowy element');
            await user.type(input, '  Element z spacjami  ');

            const addButton = screen.getByRole('button', { name: /Dodaj/i });
            await user.click(addButton);

            // Assert
            expect(formArray.at(0).value).toBe('Element z spacjami');
        });
    });

    describe('Edycja elementu', () => {
        it('powinien przełączyć element w tryb edycji po kliknięciu przycisku edycji', async () => {
            // Arrange
            const { user } = await setupComponent();

            // Act
            const editButtons = screen.getAllByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButtons[0]);

            // Assert
            // Pole edycji powinno być widoczne
            const editInput = screen.getByDisplayValue('Element 1');
            expect(editInput).toBeTruthy();

            // Przyciski zapisz i anuluj powinny być widoczne
            expect(
                screen.getByRole('button', { name: /Zapisz/i })
            ).toBeTruthy();
            expect(
                screen.getByRole('button', { name: /Anuluj/i })
            ).toBeTruthy();
        });

        it('powinien zapisać zmiany i wyjść z trybu edycji po kliknięciu "Zapisz"', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Stara wartość', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act
            // Wejdź w tryb edycji
            const editButton = screen.getByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButton);

            // Zmień wartość
            const editInput = screen.getByDisplayValue('Stara wartość');
            await user.clear(editInput);
            await user.type(editInput, 'Nowa wartość');

            // Zapisz
            const saveButton = screen.getByRole('button', { name: /Zapisz/i });
            await user.click(saveButton);

            // Assert
            expect(formArray.at(0).value).toBe('Nowa wartość');
            expect(screen.getByText('Nowa wartość')).toBeTruthy();
            // Pole edycji nie powinno być już widoczne
            expect(screen.queryByDisplayValue('Nowa wartość')).toBeNull();
        });

        it('powinien anulować edycję i przywrócić oryginalną wartość po kliknięciu "Anuluj"', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Oryginalna wartość', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act
            // Wejdź w tryb edycji
            const editButton = screen.getByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButton);

            // Zmień wartość
            const editInput = screen.getByDisplayValue('Oryginalna wartość');
            await user.clear(editInput);
            await user.type(editInput, 'Zmieniona wartość');

            // Anuluj
            const cancelButton = screen.getByRole('button', {
                name: /Anuluj/i,
            });
            await user.click(cancelButton);

            // Assert
            // Wartość powinna pozostać niezmieniona
            expect(formArray.at(0).value).toBe('Oryginalna wartość');
            expect(
                screen.getByText('Oryginalna wartość')
            ).toBeTruthy();
            // Pole edycji nie powinno być widoczne
            expect(
                screen.queryByDisplayValue('Zmieniona wartość')
            ).toBeNull();
        });

        it('powinien zapisać zmiany po naciśnięciu Enter w polu edycji', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Wartość początkowa', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act
            const editButton = screen.getByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButton);

            const editInput = screen.getByDisplayValue('Wartość początkowa');
            await user.clear(editInput);
            await user.type(editInput, 'Wartość z Enter{Enter}');

            // Assert
            expect(formArray.at(0).value).toBe('Wartość z Enter');
        });

        it('powinien anulować edycję po naciśnięciu Escape w polu edycji', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Wartość początkowa', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act
            const editButton = screen.getByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButton);

            const editInput = screen.getByDisplayValue('Wartość początkowa');
            await user.clear(editInput);
            await user.type(editInput, 'Zmieniona wartość{Escape}');

            // Assert
            expect(formArray.at(0).value).toBe('Wartość początkowa');
            expect(
                screen.getByText('Wartość początkowa')
            ).toBeTruthy();
        });

        it('nie powinien zapisać pustej wartości (tylko białe znaki)', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Wartość oryginalna', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act
            const editButton = screen.getByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButton);

            const editInput = screen.getByDisplayValue('Wartość oryginalna');
            await user.clear(editInput);
            await user.type(editInput, '   ');

            const saveButton = screen.getByRole('button', { name: /Zapisz/i });
            await user.click(saveButton);

            // Assert
            // Wartość powinna pozostać niezmieniona
            expect(formArray.at(0).value).toBe('Wartość oryginalna');
        });

        it('powinien przyciąć białe znaki podczas zapisywania edycji', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Stara wartość', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act
            const editButton = screen.getByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButton);

            const editInput = screen.getByDisplayValue('Stara wartość');
            await user.clear(editInput);
            await user.type(editInput, '  Nowa wartość  ');

            const saveButton = screen.getByRole('button', { name: /Zapisz/i });
            await user.click(saveButton);

            // Assert
            expect(formArray.at(0).value).toBe('Nowa wartość');
        });
    });

    describe('Usuwanie elementu', () => {
        it('powinien usunąć element z FormArray po kliknięciu przycisku usuwania', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Element do usunięcia', { nonNullable: true }),
                fb.control('Element do zachowania', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act
            const deleteButtons = screen.getAllByRole('button', {
                name: /Usuń Element/i,
            });
            await user.click(deleteButtons[0]);

            // Assert
            expect(formArray.length).toBe(1);
            expect(formArray.at(0).value).toBe('Element do zachowania');
            expect(
                screen.queryByText('Element do usunięcia')
            ).toBeNull();
            expect(
                screen.getByText('Element do zachowania')
            ).toBeTruthy();
        });

        it('powinien anulować tryb edycji gdy usunięto edytowany element', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Element edytowany', { nonNullable: true }),
                fb.control('Inny element', { nonNullable: true }),
            ]);
            const { user, fixture } = await setupComponent({ formArray });

            // Act
            // Wejdź w tryb edycji pierwszego elementu
            const editButtons = screen.getAllByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButtons[0]);

            // Upewnij się, że jesteśmy w trybie edycji
            expect(
                screen.getByDisplayValue('Element edytowany')
            ).toBeTruthy();

            // Usuń edytowany element bezpośrednio przez komponent
            // (w trybie edycji przycisk delete nie jest widoczny)
            const component = fixture.componentInstance;
            component.removeItem(0);
            fixture.detectChanges();

            // Assert
            expect(formArray.length).toBe(1);
            expect(formArray.at(0).value).toBe('Inny element');
            // Pole edycji nie powinno być już widoczne
            expect(
                screen.queryByDisplayValue('Element edytowany')
            ).toBeNull();
        });

        it('powinien dostosować indeks edycji po usunięciu elementu przed edytowanym', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Element 1', { nonNullable: true }),
                fb.control('Element 2', { nonNullable: true }),
                fb.control('Element 3 - edytowany', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act
            // Edytuj trzeci element
            const editButtons = screen.getAllByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButtons[2]);

            // Upewnij się, że edytujemy trzeci element
            expect(
                screen.getByDisplayValue('Element 3 - edytowany')
            ).toBeTruthy();

            // Usuń pierwszy element
            const deleteButtons = screen.getAllByRole('button', {
                name: /Usuń Element/i,
            });
            await user.click(deleteButtons[0]);

            // Assert
            expect(formArray.length).toBe(2);
            // Tryb edycji powinien być nadal aktywny dla tego samego elementu
            expect(
                screen.getByDisplayValue('Element 3 - edytowany')
            ).toBeTruthy();
        });
    });

    describe('Drag & Drop', () => {
        it('powinien mieć handle do przeciągania dla każdego elementu', async () => {
            // Arrange & Act
            await setupComponent();

            // Assert
            const dragHandles = screen.getAllByText('drag_indicator');
            expect(dragHandles).toHaveLength(2);
        });

        it('powinien zmienić kolejność elementów w FormArray po przeciągnięciu', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Element A', { nonNullable: true }),
                fb.control('Element B', { nonNullable: true }),
                fb.control('Element C', { nonNullable: true }),
            ]);
            const { fixture } = await setupComponent({ formArray });

            // Act
            const component = fixture.componentInstance;

            // Symuluj przeciągnięcie pierwszego elementu na trzecią pozycję
            component.drop({
                previousIndex: 0,
                currentIndex: 2,
                isPointerOverContainer: true,
                distance: { x: 0, y: 0 },
                dropPoint: { x: 0, y: 0 },
                event: new MouseEvent('mouseup'),
            } as CdkDragDrop<string[]>);

            fixture.detectChanges();

            // Assert
            expect(formArray.length).toBe(3);
            expect(formArray.at(0).value).toBe('Element B');
            expect(formArray.at(1).value).toBe('Element C');
            expect(formArray.at(2).value).toBe('Element A');
        });

        it('nie powinien modyfikować FormArray jeśli element został upuszczony na tę samą pozycję', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Element A', { nonNullable: true }),
                fb.control('Element B', { nonNullable: true }),
            ]);
            const { fixture } = await setupComponent({ formArray });

            // Act
            const component = fixture.componentInstance;
            const originalLength = formArray.length;

            // Symuluj przeciągnięcie elementu na tę samą pozycję
            component.drop({
                previousIndex: 0,
                currentIndex: 0,
                isPointerOverContainer: true,
                distance: { x: 0, y: 0 },
                dropPoint: { x: 0, y: 0 },
                event: new MouseEvent('mouseup'),
            } as CdkDragDrop<string[]>);

            // Assert
            expect(formArray.length).toBe(originalLength);
            expect(formArray.at(0).value).toBe('Element A');
            expect(formArray.at(1).value).toBe('Element B');
        });

        it('powinien dostosować indeks edycji po przeciągnięciu edytowanego elementu', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Element A', { nonNullable: true }),
                fb.control('Element B - edytowany', { nonNullable: true }),
                fb.control('Element C', { nonNullable: true }),
            ]);
            const { user, fixture } = await setupComponent({ formArray });

            // Act
            // Edytuj drugi element
            const editButtons = screen.getAllByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButtons[1]);

            expect(
                screen.getByDisplayValue('Element B - edytowany')
            ).toBeTruthy();

            // Przeciągnij edytowany element na pierwszą pozycję
            const component = fixture.componentInstance;
            component.drop({
                previousIndex: 1,
                currentIndex: 0,
                isPointerOverContainer: true,
                distance: { x: 0, y: 0 },
                dropPoint: { x: 0, y: 0 },
                event: new MouseEvent('mouseup'),
            } as CdkDragDrop<string[]>);

            fixture.detectChanges();

            // Assert
            // Element powinien być teraz na pierwszej pozycji
            expect(formArray.at(0).value).toBe('Element B - edytowany');
            // Tryb edycji powinien być nadal aktywny
            expect(
                screen.getByDisplayValue('Element B - edytowany')
            ).toBeTruthy();
        });
    });

    describe('Funkcje pomocnicze', () => {
        it('isHeader() powinien rozpoznać wartość zaczynającą się od #', async () => {
            // Arrange
            const { fixture } = await setupComponent();
            const component = fixture.componentInstance;

            // Act & Assert
            expect(component.isHeader('# Nagłówek')).toBe(true);
            expect(component.isHeader('#Nagłówek')).toBe(true);
            expect(component.isHeader('Zwykły tekst')).toBe(false);
            expect(component.isHeader(' # Nie nagłówek')).toBe(false);
        });

        it('getDisplayValue() powinien usunąć # z nagłówków', async () => {
            // Arrange
            const { fixture } = await setupComponent();
            const component = fixture.componentInstance;

            // Act & Assert
            expect(component.getDisplayValue('# Nagłówek')).toBe('Nagłówek');
            expect(component.getDisplayValue('#Nagłówek')).toBe('Nagłówek');
            expect(component.getDisplayValue('Zwykły tekst')).toBe(
                'Zwykły tekst'
            );
        });
    });

    describe('Interakcje z klawiaturą', () => {
        it('powinien zapobiec domyślnej akcji Enter przy dodawaniu elementu', async () => {
            // Arrange
            const formArray = fb.array<FormControl<string>>([]);
            const { user } = await setupComponent({ formArray });

            // Act
            const input = screen.getByPlaceholderText('Dodaj nowy element');
            await user.type(input, 'Test{Enter}');

            // Assert
            // Element powinien zostać dodany (domyślna akcja została zapobiegła)
            expect(formArray.length).toBe(1);
            expect(formArray.at(0).value).toBe('Test');
        });

        it('powinien zapobiec domyślnej akcji Enter przy edycji elementu', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Wartość', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act
            const editButton = screen.getByRole('button', {
                name: /Edytuj Element/i,
            });
            await user.click(editButton);

            const editInput = screen.getByDisplayValue('Wartość');
            await user.clear(editInput);
            await user.type(editInput, 'Nowa{Enter}');

            // Assert
            expect(formArray.at(0).value).toBe('Nowa');
        });
    });

    describe('Numerowanie elementów', () => {
        it('powinien wyświetlić poprawne numery dla wszystkich elementów', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Pierwszy', { nonNullable: true }),
                fb.control('Drugi', { nonNullable: true }),
                fb.control('Trzeci', { nonNullable: true }),
            ]);
            await setupComponent({ formArray });

            // Assert
            expect(screen.getByText('1.')).toBeTruthy();
            expect(screen.getByText('2.')).toBeTruthy();
            expect(screen.getByText('3.')).toBeTruthy();
        });

        it('powinien zaktualizować numery po usunięciu elementu', async () => {
            // Arrange
            const formArray = fb.array([
                fb.control('Pierwszy', { nonNullable: true }),
                fb.control('Drugi', { nonNullable: true }),
                fb.control('Trzeci', { nonNullable: true }),
            ]);
            const { user } = await setupComponent({ formArray });

            // Act - usuń pierwszy element
            const deleteButtons = screen.getAllByRole('button', {
                name: /Usuń Element/i,
            });
            await user.click(deleteButtons[0]);

            // Assert
            // Sprawdź czy pozostałe elementy mają zaktualizowane numery
            const indices = screen.getAllByText(/\d+\./);
            expect(indices).toHaveLength(2);
            expect(screen.getByText('1.')).toBeTruthy();
            expect(screen.getByText('2.')).toBeTruthy();
            expect(screen.queryByText('3.')).toBeNull();
        });
    });
});

