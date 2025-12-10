import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { RecipeImportPageComponent } from './recipe-import-page.component';
import { RecipesService } from '../services/recipes.service';
import { RecipeDetailDto } from '../../../../../shared/contracts/types';

describe('RecipeImportPageComponent', () => {
    let component: RecipeImportPageComponent;
    let fixture: ComponentFixture<RecipeImportPageComponent>;
    let mockRecipesService: jasmine.SpyObj<RecipesService>;
    let mockRouter: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        mockRecipesService = jasmine.createSpyObj('RecipesService', [
            'importRecipe',
        ]);
        mockRouter = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [
                RecipeImportPageComponent,
                ReactiveFormsModule,
                NoopAnimationsModule,
            ],
            providers: [
                { provide: RecipesService, useValue: mockRecipesService },
                { provide: Router, useValue: mockRouter },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(RecipeImportPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Form initialization', () => {
        it('should initialize form with empty rawText field', () => {
            expect(component.form.value.rawText).toBe('');
        });

        it('should have rawText field as required', () => {
            const rawTextControl = component.form.controls.rawText;
            expect(rawTextControl.hasError('required')).toBe(true);
        });

        it('should make form valid when rawText is provided', () => {
            component.form.controls.rawText.setValue('# Test Recipe');
            expect(component.form.valid).toBe(true);
        });
    });

    describe('State management', () => {
        it('should initialize state with pending: false and error: null', () => {
            const state = component.state();
            expect(state.pending).toBe(false);
            expect(state.error).toBe(null);
        });
    });

    describe('submit()', () => {
        it('should not call service when form is invalid', () => {
            component.form.controls.rawText.setValue('');
            component.submit();
            expect(mockRecipesService.importRecipe).not.toHaveBeenCalled();
        });

        it('should set pending to true and clear error on submit', () => {
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

            mockRecipesService.importRecipe.and.returnValue(of(mockRecipe));

            component.submit();

            expect(component.state().pending).toBe(false); // Will be false after observable completes
            expect(component.state().error).toBe(null);
        });

        it('should call importRecipe service with correct command', () => {
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

            mockRecipesService.importRecipe.and.returnValue(of(mockRecipe));

            component.submit();

            expect(mockRecipesService.importRecipe).toHaveBeenCalledWith({
                raw_text: rawText,
            });
        });

        it('should navigate to edit page on successful import', () => {
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

            mockRecipesService.importRecipe.and.returnValue(of(mockRecipe));

            component.submit();

            expect(mockRouter.navigate).toHaveBeenCalledWith([
                '/recipes',
                42,
                'edit',
            ]);
        });

        it('should set pending to false after successful import', (done) => {
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

            mockRecipesService.importRecipe.and.returnValue(of(mockRecipe));

            component.submit();

            setTimeout(() => {
                expect(component.state().pending).toBe(false);
                done();
            }, 0);
        });

        it('should handle error and update state', (done) => {
            component.form.controls.rawText.setValue('# Test Recipe');

            const mockError = {
                message: 'Invalid format',
                status: 400,
            };

            mockRecipesService.importRecipe.and.returnValue(
                throwError(() => mockError)
            );

            component.submit();

            setTimeout(() => {
                expect(component.state().pending).toBe(false);
                expect(component.state().error).toEqual({
                    message: 'Invalid format',
                    status: 400,
                });
                done();
            }, 0);
        });

        it('should handle error without message and use default message', (done) => {
            component.form.controls.rawText.setValue('# Test Recipe');

            mockRecipesService.importRecipe.and.returnValue(
                throwError(() => ({}))
            );

            component.submit();

            setTimeout(() => {
                expect(component.state().error?.message).toBe(
                    'Wystąpił błąd podczas importu przepisu'
                );
                expect(component.state().error?.status).toBe(500);
                done();
            }, 0);
        });

        it('should trim whitespace from rawText before sending', () => {
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

            mockRecipesService.importRecipe.and.returnValue(of(mockRecipe));

            component.submit();

            expect(mockRecipesService.importRecipe).toHaveBeenCalledWith({
                raw_text: '# Test Recipe',
            });
        });
    });
});

