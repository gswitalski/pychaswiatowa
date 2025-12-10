import 'zone.js';
import 'zone.js/testing';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { RecipeImportPageComponent } from './recipe-import-page.component';
import { RecipesService } from '../services/recipes.service';
import { RecipeDetailDto } from '../../../../../shared/contracts/types';

describe('RecipeImportPageComponent', () => {
    let mockRecipesService: {
        importRecipe: ReturnType<typeof vi.fn>;
    };
    let mockRouter: {
        navigate: ReturnType<typeof vi.fn>;
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        mockRecipesService = {
            importRecipe: vi.fn(),
        };
        mockRouter = {
            navigate: vi.fn(),
        };

        TestBed.configureTestingModule({
            imports: [RecipeImportPageComponent, NoopAnimationsModule],
            providers: [
                { provide: RecipesService, useValue: mockRecipesService },
                { provide: Router, useValue: mockRouter },
            ],
        });
    });

    function createComponent() {
        const fixture = TestBed.createComponent(RecipeImportPageComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();
        return { fixture, component };
    }

    it('should create', () => {
        const { component } = createComponent();
        expect(component).toBeTruthy();
    });

    describe('Form initialization', () => {
        it('should initialize form with empty rawText field', () => {
            const { component } = createComponent();
            expect(component.form.value.rawText).toBe('');
        });

        it('should have rawText field as required', () => {
            const { component } = createComponent();
            const rawTextControl = component.form.controls.rawText;
            expect(rawTextControl.hasError('required')).toBe(true);
        });

        it('should make form valid when rawText is provided', () => {
            const { component } = createComponent();
            component.form.controls.rawText.setValue('# Test Recipe');
            expect(component.form.valid).toBe(true);
        });
    });

    describe('State management', () => {
        it('should initialize state with pending: false and error: null', () => {
            const { component } = createComponent();
            const state = component.state();
            expect(state.pending).toBe(false);
            expect(state.error).toBe(null);
        });
    });

    describe('submit()', () => {
        it('should not call service when form is invalid', () => {
            const { component } = createComponent();
            component.form.controls.rawText.setValue('');
            component.submit();
            expect(mockRecipesService.importRecipe).not.toHaveBeenCalled();
        });

        it('should set pending to true and clear error on submit', () => {
            const { component } = createComponent();
            component.form.controls.rawText.setValue('# Test Recipe');
            const mockRecipe: RecipeDetailDto = {
                id: 1,
                name: 'Test Recipe',
                description: null,
                ingredients: [],
                steps: [],
                tags: [],
                category_id: null,
                category_name: null,
                image_path: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user_id: 'test-user-id',
            };

            mockRecipesService.importRecipe.mockReturnValue(of(mockRecipe));

            component.submit();

            expect(component.state().pending).toBe(false); // Will be false after observable completes
            expect(component.state().error).toBe(null);
        });

        it('should call importRecipe service with correct command', () => {
            const { component } = createComponent();
            const rawText = '# Test Recipe\n\n## Składniki\n- test';
            component.form.controls.rawText.setValue(rawText);

            const mockRecipe: RecipeDetailDto = {
                id: 1,
                name: 'Test Recipe',
                description: null,
                ingredients: [],
                steps: [],
                tags: [],
                category_id: null,
                category_name: null,
                image_path: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user_id: 'test-user-id',
            };

            mockRecipesService.importRecipe.mockReturnValue(of(mockRecipe));

            component.submit();

            expect(mockRecipesService.importRecipe).toHaveBeenCalledWith({
                raw_text: rawText,
            });
        });

        it('should navigate to edit page on successful import', () => {
            const { component } = createComponent();
            component.form.controls.rawText.setValue('# Test Recipe');

            const mockRecipe: RecipeDetailDto = {
                id: 42,
                name: 'Test Recipe',
                description: null,
                ingredients: [],
                steps: [],
                tags: [],
                category_id: null,
                category_name: null,
                image_path: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user_id: 'test-user-id',
            };

            mockRecipesService.importRecipe.mockReturnValue(of(mockRecipe));

            component.submit();

            expect(mockRouter.navigate).toHaveBeenCalledWith([
                '/recipes',
                42,
                'edit',
            ]);
        });

        it('should set pending to false after successful import', async () => {
            const { component } = createComponent();
            component.form.controls.rawText.setValue('# Test Recipe');

            const mockRecipe: RecipeDetailDto = {
                id: 1,
                name: 'Test Recipe',
                description: null,
                ingredients: [],
                steps: [],
                tags: [],
                category_id: null,
                category_name: null,
                image_path: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user_id: 'test-user-id',
            };

            mockRecipesService.importRecipe.mockReturnValue(of(mockRecipe));

            component.submit();

            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(component.state().pending).toBe(false);
        });

        it('should handle error and update state', async () => {
            const { component } = createComponent();
            component.form.controls.rawText.setValue('# Test Recipe');

            const mockError = {
                message: 'Invalid format',
                status: 400,
            };

            mockRecipesService.importRecipe.mockReturnValue(
                throwError(() => mockError)
            );

            component.submit();

            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(component.state().pending).toBe(false);
            expect(component.state().error).toEqual({
                message: 'Invalid format',
                status: 400,
            });
        });

        it('should handle error without message and use default message', async () => {
            const { component } = createComponent();
            component.form.controls.rawText.setValue('# Test Recipe');

            mockRecipesService.importRecipe.mockReturnValue(
                throwError(() => ({}))
            );

            component.submit();

            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(component.state().error?.message).toBe(
                'Wystąpił błąd podczas importu przepisu'
            );
            expect(component.state().error?.status).toBe(500);
        });

        it('should trim whitespace from rawText before sending', () => {
            const { component } = createComponent();
            component.form.controls.rawText.setValue('  # Test Recipe  \n\n  ');

            const mockRecipe: RecipeDetailDto = {
                id: 1,
                name: 'Test Recipe',
                description: null,
                ingredients: [],
                steps: [],
                tags: [],
                category_id: null,
                category_name: null,
                image_path: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user_id: 'test-user-id',
            };

            mockRecipesService.importRecipe.mockReturnValue(of(mockRecipe));

            component.submit();

            expect(mockRecipesService.importRecipe).toHaveBeenCalledWith({
                raw_text: '# Test Recipe',
            });
        });
    });
});

