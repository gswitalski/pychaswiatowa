import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { ShoppingListService } from './shopping-list.service';
import { SupabaseService } from './supabase.service';
import {
    GetShoppingListResponseDto,
    ShoppingListItemManualDto,
    ShoppingListItemRecipeDto,
    AddManualShoppingListItemCommand,
} from '../../../../shared/contracts/types';
import { firstValueFrom } from 'rxjs';

interface MockSupabaseService {
    functions: {
        invoke: ReturnType<typeof vi.fn>;
    };
}

describe('ShoppingListService', () => {
    let service: ShoppingListService;
    let mockSupabaseService: MockSupabaseService;

    // Inicjalizacja środowiska testowego Angular
    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        // Przygotowanie mocka SupabaseService
        mockSupabaseService = {
            functions: {
                invoke: vi.fn(),
            },
        };

        // Konfiguracja TestBed
        await TestBed.configureTestingModule({
            providers: [
                ShoppingListService,
                { provide: SupabaseService, useValue: mockSupabaseService },
            ],
        }).compileComponents();

        service = TestBed.inject(ShoppingListService);
        vi.clearAllMocks();
    });

    describe('getShoppingList()', () => {
        it('powinien pobrać listę zakupów z API', async () => {
            // Arrange
            const mockResponse: GetShoppingListResponseDto = {
                data: [
                    {
                        id: 1,
                        user_id: 'user-123',
                        kind: 'RECIPE',
                        name: 'cukier',
                        amount: 250,
                        unit: 'g',
                        is_owned: false,
                        created_at: '2024-01-01T00:00:00Z',
                        updated_at: '2024-01-01T00:00:00Z',
                    } as ShoppingListItemRecipeDto,
                    {
                        id: 2,
                        user_id: 'user-123',
                        kind: 'MANUAL',
                        text: 'papier toaletowy',
                        is_owned: false,
                        created_at: '2024-01-01T00:00:00Z',
                        updated_at: '2024-01-01T00:00:00Z',
                    } as ShoppingListItemManualDto,
                ],
                meta: {
                    total: 2,
                    recipe_items: 1,
                    manual_items: 1,
                },
            };

            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: mockResponse,
                error: null,
            });

            // Act
            const result = await firstValueFrom(service.getShoppingList());

            // Assert
            expect(result).toEqual(mockResponse);
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
                'shopping-list',
                { method: 'GET' }
            );
        });

        it('powinien zwrócić pustą listę gdy brak danych', async () => {
            // Arrange
            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: null,
            });

            // Act
            const result = await firstValueFrom(service.getShoppingList());

            // Assert
            expect(result.data).toEqual([]);
            expect(result.meta.total).toBe(0);
        });

        it('powinien obsłużyć błąd API', async () => {
            // Arrange
            const mockError = { message: 'Unauthorized' };
            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: mockError,
            });

            // Act & Assert
            await expect(firstValueFrom(service.getShoppingList())).rejects.toMatchObject({
                message: 'Wystąpił błąd. Spróbuj ponownie.',
                status: 500,
            });
        });
    });

    describe('addManualItem()', () => {
        it('powinien dodać ręczną pozycję do listy', async () => {
            // Arrange
            const command: AddManualShoppingListItemCommand = {
                text: 'papier toaletowy',
            };

            const mockNewItem: ShoppingListItemManualDto = {
                id: 3,
                user_id: 'user-123',
                kind: 'MANUAL',
                text: 'papier toaletowy',
                is_owned: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: mockNewItem,
                error: null,
            });

            // Ustaw początkowy stan
            service.state.set({
                data: [],
                meta: { total: 0, recipe_items: 0, manual_items: 0 },
                isLoading: false,
                isRefreshing: false,
                error: null,
                lastLoadedAt: Date.now(),
            });

            // Act
            const result = await firstValueFrom(service.addManualItem(command));

            // Assert
            expect(result).toEqual(mockNewItem);
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
                'shopping-list/items',
                {
                    method: 'POST',
                    body: command,
                }
            );

            // Sprawdź aktualizację stanu lokalnego
            const state = service.state();
            expect(state.data).toHaveLength(1);
            expect(state.data[0]).toEqual(mockNewItem);
            expect(state.meta.total).toBe(1);
            expect(state.meta.manual_items).toBe(1);
        });

        it('powinien odrzucić pusty tekst', async () => {
            // Arrange
            const command: AddManualShoppingListItemCommand = {
                text: '   ',
            };

            // Act & Assert
            await expect(firstValueFrom(service.addManualItem(command))).rejects.toMatchObject({
                message: 'Wpisz nazwę pozycji.',
                status: 400,
            });

            expect(mockSupabaseService.functions.invoke).not.toHaveBeenCalled();
        });

        it('powinien obsłużyć błąd 400', async () => {
            // Arrange
            const command: AddManualShoppingListItemCommand = {
                text: 'test',
            };

            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Invalid input', status: 400 },
            });

            // Act & Assert
            await expect(firstValueFrom(service.addManualItem(command))).rejects.toMatchObject({
                message: 'Invalid input',
                status: 400,
            });
        });
    });

    describe('toggleOwnedGroup()', () => {
        it('powinien zaktualizować stan "posiadane" dla grupy', async () => {
            // Arrange
            const itemId = 1;
            const isOwned = true;
            const groupKey = 'cukier||g||0';

            const existingItem: ShoppingListItemRecipeDto = {
                id: itemId,
                user_id: 'user-123',
                kind: 'RECIPE',
                name: 'cukier',
                amount: 250,
                unit: 'g',
                is_owned: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const updatedItem: ShoppingListItemRecipeDto = {
                ...existingItem,
                is_owned: true,
            };

            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: updatedItem,
                error: null,
            });

            // Ustaw początkowy stan
            service.state.set({
                data: [existingItem],
                meta: { total: 1, recipe_items: 1, manual_items: 0 },
                isLoading: false,
                isRefreshing: false,
                error: null,
                lastLoadedAt: Date.now(),
            });

            // Act
            const result = await firstValueFrom(service.toggleOwnedGroup(groupKey, isOwned));

            // Assert
            expect(result).toEqual([updatedItem]);
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
                `shopping-list/items/${itemId}`,
                {
                    method: 'PATCH',
                    body: { is_owned: isOwned },
                }
            );

            // Sprawdź aktualizację stanu lokalnego
            const state = service.state();
            expect(state.data[0].is_owned).toBe(true);
        });

        it('powinien cofnąć optymistyczną zmianę przy błędzie', async () => {
            // Arrange
            const itemId = 1;
            const isOwned = true;
            const groupKey = 'cukier||g||0';

            const existingItem: ShoppingListItemRecipeDto = {
                id: itemId,
                user_id: 'user-123',
                kind: 'RECIPE',
                name: 'cukier',
                amount: 250,
                unit: 'g',
                is_owned: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Not found', status: 404 },
            });

            // Ustaw początkowy stan
            service.state.set({
                data: [existingItem],
                meta: { total: 1, recipe_items: 1, manual_items: 0 },
                isLoading: false,
                isRefreshing: false,
                error: null,
                lastLoadedAt: Date.now(),
            });

            // Act & Assert
            await expect(
                firstValueFrom(service.toggleOwnedGroup(groupKey, isOwned))
            ).rejects.toMatchObject({
                message: 'Nie znaleziono pozycji listy (mogła zostać już usunięta).',
                status: 404,
            });

            // Sprawdź rollback stanu lokalnego
            const state = service.state();
            expect(state.data[0].is_owned).toBe(false);
        });

        it('powinien odrzucić nieprawidłowy klucz grupy', async () => {
            // Arrange
            const isOwned = true;
            const groupKey = '';

            // Act & Assert
            await expect(
                firstValueFrom(service.toggleOwnedGroup(groupKey, isOwned))
            ).rejects.toMatchObject({
                message: 'Nieprawidłowa pozycja listy.',
                status: 400,
            });

            expect(mockSupabaseService.functions.invoke).not.toHaveBeenCalled();
        });
    });

    describe('deleteManualItem()', () => {
        it('powinien usunąć ręczną pozycję z listy', async () => {
            // Arrange
            const itemId = 2;

            const manualItem: ShoppingListItemManualDto = {
                id: itemId,
                user_id: 'user-123',
                kind: 'MANUAL',
                text: 'papier toaletowy',
                is_owned: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: null,
            });

            // Ustaw początkowy stan
            service.state.set({
                data: [manualItem],
                meta: { total: 1, recipe_items: 0, manual_items: 1 },
                isLoading: false,
                isRefreshing: false,
                error: null,
                lastLoadedAt: Date.now(),
            });

            // Act
            await firstValueFrom(service.deleteManualItem(itemId));

            // Assert
            expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
                `shopping-list/items/${itemId}`,
                { method: 'DELETE' }
            );

            // Sprawdź aktualizację stanu lokalnego
            const state = service.state();
            expect(state.data).toHaveLength(0);
            expect(state.meta.total).toBe(0);
            expect(state.meta.manual_items).toBe(0);
        });

        it('powinien obsłużyć błąd 403 (próba usunięcia pozycji z przepisu)', async () => {
            // Arrange
            const itemId = 1;

            mockSupabaseService.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Forbidden', status: 403 },
            });

            // Act & Assert
            await expect(
                firstValueFrom(service.deleteManualItem(itemId))
            ).rejects.toMatchObject({
                message: 'Nie można usuwać pozycji pochodzących z przepisów.',
                status: 403,
            });
        });

        it('powinien odrzucić nieprawidłowe ID', async () => {
            // Arrange
            const itemId = -1;

            // Act & Assert
            await expect(
                firstValueFrom(service.deleteManualItem(itemId))
            ).rejects.toMatchObject({
                message: 'Nieprawidłowa pozycja listy.',
                status: 400,
            });

            expect(mockSupabaseService.functions.invoke).not.toHaveBeenCalled();
        });
    });

    describe('groupedItemsSorted computed', () => {
        it('powinien sortować pozycje: is_owned=false na górze, alfabetycznie', () => {
            // Arrange
            const items: ShoppingListItemRecipeDto[] = [
                {
                    id: 1,
                    user_id: 'user-123',
                    kind: 'RECIPE',
                    name: 'ziemniaki',
                    amount: 1,
                    unit: 'kg',
                    is_owned: false,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                },
                {
                    id: 2,
                    user_id: 'user-123',
                    kind: 'RECIPE',
                    name: 'cukier',
                    amount: 250,
                    unit: 'g',
                    is_owned: true,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                },
                {
                    id: 3,
                    user_id: 'user-123',
                    kind: 'RECIPE',
                    name: 'mąka',
                    amount: 500,
                    unit: 'g',
                    is_owned: false,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                },
            ];

            service.state.set({
                data: items,
                meta: { total: 3, recipe_items: 3, manual_items: 0 },
                isLoading: false,
                isRefreshing: false,
                error: null,
                lastLoadedAt: Date.now(),
            });

            // Act
            const sorted = service.groupedItemsSorted();

            // Assert
            expect(sorted).toHaveLength(3);
            // Najpierw is_owned=false, alfabetycznie
            expect(sorted[0].primaryText).toBe('mąka');
            expect(sorted[0].isOwned).toBe(false);
            expect(sorted[1].primaryText).toBe('ziemniaki');
            expect(sorted[1].isOwned).toBe(false);
            // Potem is_owned=true
            expect(sorted[2].primaryText).toBe('cukier');
            expect(sorted[2].isOwned).toBe(true);
        });
    });

    describe('mapowanie DTO na ViewModel', () => {
        it('powinien poprawnie zmapować pozycję RECIPE', () => {
            // Arrange
            const recipeItem: ShoppingListItemRecipeDto = {
                id: 1,
                user_id: 'user-123',
                kind: 'RECIPE',
                name: 'cukier',
                amount: 250,
                unit: 'g',
                is_owned: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            service.state.set({
                data: [recipeItem],
                meta: { total: 1, recipe_items: 1, manual_items: 0 },
                isLoading: false,
                isRefreshing: false,
                error: null,
                lastLoadedAt: Date.now(),
            });

            // Act
            const vm = service.groupedItems()[0];

            // Assert
            expect(vm.kind).toBe('RECIPE');
            expect(vm.primaryText).toBe('cukier');
            expect(vm.secondaryText).toBe('250 g');
            expect(vm.canDelete).toBe(true);
            expect(vm.isOwned).toBe(false);
            expect(vm.rowIds).toEqual([1]);
        });

        it('powinien poprawnie zmapować pozycję MANUAL', () => {
            // Arrange
            const manualItem: ShoppingListItemManualDto = {
                id: 2,
                user_id: 'user-123',
                kind: 'MANUAL',
                text: 'papier toaletowy',
                is_owned: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            service.state.set({
                data: [manualItem],
                meta: { total: 1, recipe_items: 0, manual_items: 1 },
                isLoading: false,
                isRefreshing: false,
                error: null,
                lastLoadedAt: Date.now(),
            });

            // Act
            const vm = service.groupedItems()[0];

            // Assert
            expect(vm.id).toBe(2);
            expect(vm.kind).toBe('MANUAL');
            expect(vm.primaryText).toBe('papier toaletowy');
            expect(vm.secondaryText).toBe(null);
            expect(vm.canDelete).toBe(true);
            expect(vm.isOwned).toBe(false);
            expect(vm.rowIds).toEqual([2]);
        });
    });

    describe('resetState()', () => {
        it('powinien zresetować cały stan', () => {
            // Arrange
            service.state.set({
                data: [
                    {
                        id: 1,
                        user_id: 'user-123',
                        kind: 'MANUAL',
                        text: 'test',
                        is_owned: false,
                        created_at: '2024-01-01T00:00:00Z',
                        updated_at: '2024-01-01T00:00:00Z',
                    } as ShoppingListItemManualDto,
                ],
                meta: { total: 1, recipe_items: 0, manual_items: 1 },
                isLoading: false,
                isRefreshing: false,
                error: null,
                lastLoadedAt: Date.now(),
            });

            // Act
            service.resetState();

            // Assert
            const state = service.state();
            expect(state.data).toEqual([]);
            expect(state.meta.total).toBe(0);
            expect(state.isLoading).toBe(false);
            expect(state.error).toBe(null);
            expect(state.lastLoadedAt).toBe(null);
        });
    });
});
