import 'zone.js';
import 'zone.js/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeAll, describe, expect, it, beforeEach, vi } from 'vitest';
import { Subject, of } from 'rxjs';
import { MeApiService } from '../../../../../core/services/me-api.service';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { RecipesService } from '../../../services/recipes.service';
import type { RecipeVariantSummaryDto } from '../../../../../../../shared/contracts/types';
import { RecipeVariantsSectionComponent } from './recipe-variants-section.component';

describe('RecipeVariantsSectionComponent', () => {
    let fixture: ComponentFixture<RecipeVariantsSectionComponent>;
    let meApi: { getMe: ReturnType<typeof vi.fn> };
    let recipes: {
        getRecipeVariants: ReturnType<typeof vi.fn>;
        getRecipeUsage: ReturnType<typeof vi.fn>;
        deleteRecipeVariant: ReturnType<typeof vi.fn>;
    };
    let dialog: { open: ReturnType<typeof vi.fn> };
    let storageFrom: ReturnType<typeof vi.fn>;
    let getPublicUrl: ReturnType<typeof vi.fn>;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        meApi = { getMe: vi.fn() };
        recipes = {
            getRecipeVariants: vi.fn(),
            getRecipeUsage: vi.fn(),
            deleteRecipeVariant: vi.fn(),
        };
        dialog = { open: vi.fn() };
        getPublicUrl = vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.test/recipe-images/${path}` },
        }));
        storageFrom = vi.fn().mockReturnValue({ getPublicUrl });
        await TestBed.configureTestingModule({
            imports: [RecipeVariantsSectionComponent, NoopAnimationsModule],
            providers: [
                { provide: MeApiService, useValue: meApi },
                { provide: RecipesService, useValue: recipes },
                { provide: MatDialog, useValue: dialog },
                {
                    provide: SupabaseService,
                    useValue: { storage: { from: storageFrom } },
                },
            ],
        }).compileComponents();
    });

    function create(enabled: boolean) {
        meApi.getMe.mockReturnValue(of({
            features: { recipe_variants: { enabled, mode: enabled ? 'admin' : 'disabled' } },
        }));
        recipes.getRecipeVariants.mockReturnValue(of([]));
        fixture = TestBed.createComponent(RecipeVariantsSectionComponent);
        fixture.componentRef.setInput('recipeId', 7);
        fixture.componentRef.setInput('editingRecipeId', 7);
        fixture.detectChanges();
    }

    it('ukrywa sekcję, gdy flaga jest wyłączona', () => {
        create(false);
        expect(fixture.nativeElement.querySelector('.variants-section')).toBeNull();
        expect(recipes.getRecipeVariants).not.toHaveBeenCalled();
    });

    it('ładuje warianty po odświeżeniu flagi', () => {
        create(true);
        expect(meApi.getMe).toHaveBeenCalledTimes(1);
        expect(recipes.getRecipeVariants).toHaveBeenCalledWith(7);
        expect(fixture.nativeElement.querySelector('.variants-section')).toBeTruthy();
    });

    it('ukrywa listę przy jednym wariancie i pokazuje wiersze przy dwóch', () => {
        meApi.getMe.mockReturnValue(of({
            features: { recipe_variants: { enabled: true, mode: 'admin' } },
        }));
        recipes.getRecipeVariants.mockReturnValue(of([variant(1, 'Klasyczny')]));
        fixture = TestBed.createComponent(RecipeVariantsSectionComponent);
        fixture.componentRef.setInput('recipeId', 7);
        fixture.componentRef.setInput('editingRecipeId', 1);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('.variant-list')).toBeNull();
        expect(fixture.nativeElement.querySelector('.variant-row')).toBeNull();
        expect(fixture.nativeElement.querySelector('.variants-section')).toBeTruthy();

        fixture.componentInstance.variants.set([variant(1, 'Klasyczny'), variant(2, 'Ostry')]);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelectorAll('.variant-row').length).toBe(2);
    });

    it('ignoruje spóźnioną odpowiedź poprzedniego żądania', () => {
        const first = new Subject<RecipeVariantSummaryDto[]>();
        const second = new Subject<RecipeVariantSummaryDto[]>();
        meApi.getMe.mockReturnValue(of({
            features: { recipe_variants: { enabled: true, mode: 'admin' } },
        }));
        recipes.getRecipeVariants
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        fixture = TestBed.createComponent(RecipeVariantsSectionComponent);
        fixture.componentRef.setInput('recipeId', 7);
        fixture.componentRef.setInput('editingRecipeId', 7);
        fixture.detectChanges();
        fixture.componentInstance.loadVariants();
        second.next([{ recipe_id: 2, variant_name: 'Nowszy', is_default: true, sort_order: 0, image_path: null, chips: { diet_type: null, is_termorobot: false, is_grill: false, difficulty: null, servings: null } }]);
        first.next([{ recipe_id: 1, variant_name: 'Starszy', is_default: true, sort_order: 0, image_path: null, chips: { diet_type: null, is_termorobot: false, is_grill: false, difficulty: null, servings: null } }]);
        expect(fixture.componentInstance.variants()[0].recipe_id).toBe(2);
    });

    it('pyta o usunięcie wariantu dialogiem Angular Material i usuwa po potwierdzeniu', () => {
        const variants = [variant(1, 'Klasyczny'), variant(2, 'Ostry')];
        meApi.getMe.mockReturnValue(of({
            features: { recipe_variants: { enabled: true, mode: 'admin' } },
        }));
        recipes.getRecipeVariants.mockReturnValue(of(variants));
        recipes.getRecipeUsage.mockReturnValue(of({ plan: 2, collections: 1, shopping_list: 0 }));
        recipes.deleteRecipeVariant.mockReturnValue(of(undefined));
        dialog.open.mockReturnValue({ afterClosed: () => of(true) });
        fixture = TestBed.createComponent(RecipeVariantsSectionComponent);
        fixture.componentRef.setInput('recipeId', 7);
        fixture.componentRef.setInput('editingRecipeId', 1);
        fixture.detectChanges();

        fixture.componentInstance.removeVariant(variants[1]);

        expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, expect.objectContaining({
            data: expect.objectContaining({
                title: 'Usuń wariant',
                confirmText: 'Usuń',
                confirmColor: 'warn',
            }),
        }));
        expect(recipes.deleteRecipeVariant).toHaveBeenCalledWith(7, 2);
    });

    it('po usunięciu edytowanego wariantu przechodzi do pozostałego', () => {
        const variants = [variant(1, 'Klasyczny'), variant(2, 'Ostry')];
        meApi.getMe.mockReturnValue(of({
            features: { recipe_variants: { enabled: true, mode: 'admin' } },
        }));
        recipes.getRecipeVariants.mockReturnValue(of([variants[0]]));
        recipes.getRecipeUsage.mockReturnValue(of({ plan: 0, collections: 0, shopping_list: 0 }));
        recipes.deleteRecipeVariant.mockReturnValue(of(undefined));
        dialog.open.mockReturnValue({ afterClosed: () => of(true) });
        fixture = TestBed.createComponent(RecipeVariantsSectionComponent);
        fixture.componentRef.setInput('recipeId', 7);
        fixture.componentRef.setInput('editingRecipeId', 2);
        fixture.detectChanges();
        fixture.componentInstance.variants.set(variants);
        const opened: number[] = [];
        fixture.componentInstance.editVariantRequest.subscribe((next) => opened.push(next.recipe_id));

        fixture.componentInstance.removeVariant(variants[1]);

        expect(opened).toEqual([1]);
    });

    it('pokazuje publiczny URL miniatury, a brak zdjęcia zostawia placeholder', () => {
        const withImage = {
            ...variant(1, 'Ze zdjęciem'),
            image_path: 'user-1/7/cover_a.webp',
        };
        const withoutImage = variant(2, 'Bez zdjęcia');
        meApi.getMe.mockReturnValue(of({
            features: { recipe_variants: { enabled: true, mode: 'admin' } },
        }));
        recipes.getRecipeVariants.mockReturnValue(of([withImage, withoutImage]));
        fixture = TestBed.createComponent(RecipeVariantsSectionComponent);
        fixture.componentRef.setInput('recipeId', 7);
        fixture.componentRef.setInput('editingRecipeId', 1);
        fixture.detectChanges();

        const rows = fixture.nativeElement.querySelectorAll('.variant-row');
        const image = rows[0].querySelector('img');
        expect(storageFrom).toHaveBeenCalledWith('recipe-images');
        expect(getPublicUrl).toHaveBeenCalledWith('user-1/7/cover_a.webp');
        expect(image?.getAttribute('src')).toBe('https://cdn.test/recipe-images/user-1/7/cover_a.webp');
        expect(rows[1].querySelector('img')).toBeNull();
        expect(rows[1].querySelector('.thumbnail-placeholder')).toBeTruthy();
    });

    it('nie usuwa wariantu, gdy dialog zostanie anulowany', () => {
        const variants = [variant(1, 'Klasyczny'), variant(2, 'Ostry')];
        meApi.getMe.mockReturnValue(of({
            features: { recipe_variants: { enabled: true, mode: 'admin' } },
        }));
        recipes.getRecipeVariants.mockReturnValue(of(variants));
        recipes.getRecipeUsage.mockReturnValue(of({ plan: 0, collections: 0, shopping_list: 0 }));
        dialog.open.mockReturnValue({ afterClosed: () => of(false) });
        fixture = TestBed.createComponent(RecipeVariantsSectionComponent);
        fixture.componentRef.setInput('recipeId', 7);
        fixture.componentRef.setInput('editingRecipeId', 1);
        fixture.detectChanges();

        fixture.componentInstance.removeVariant(variants[1]);

        expect(recipes.deleteRecipeVariant).not.toHaveBeenCalled();
    });

    it('emituje żądanie dodania wariantu przez AI', () => {
        const variants = [variant(1, 'Klasyczny')];
        meApi.getMe.mockReturnValue(of({
            features: { recipe_variants: { enabled: true, mode: 'admin' } },
        }));
        recipes.getRecipeVariants.mockReturnValue(of(variants));
        fixture = TestBed.createComponent(RecipeVariantsSectionComponent);
        fixture.componentRef.setInput('recipeId', 7);
        fixture.componentRef.setInput('editingRecipeId', 1);
        fixture.detectChanges();

        const emitted: unknown[] = [];
        fixture.componentInstance.aiVariantRequest.subscribe((value) => emitted.push(value));
        fixture.componentInstance.addAiVariant();

        expect(emitted).toEqual([undefined]);
    });

    it('blokuje dodanie AI przy limicie dziesięciu wariantów', () => {
        const variants = Array.from({ length: 10 }, (_, index) => variant(index + 1, `Wariant ${index + 1}`));
        meApi.getMe.mockReturnValue(of({
            features: { recipe_variants: { enabled: true, mode: 'admin' } },
        }));
        recipes.getRecipeVariants.mockReturnValue(of(variants));
        fixture = TestBed.createComponent(RecipeVariantsSectionComponent);
        fixture.componentRef.setInput('recipeId', 7);
        fixture.componentRef.setInput('editingRecipeId', 1);
        fixture.detectChanges();

        const emitted: unknown[] = [];
        fixture.componentInstance.aiVariantRequest.subscribe((value) => emitted.push(value));
        fixture.componentInstance.addAiVariant();

        expect(emitted).toEqual([]);
        expect(fixture.componentInstance.error()).toContain('10');
    });
});

function variant(recipeId: number, name: string): RecipeVariantSummaryDto {
    return {
        recipe_id: recipeId,
        variant_name: name,
        is_default: recipeId === 1,
        sort_order: recipeId,
        image_path: null,
        chips: {
            diet_type: null,
            difficulty: null,
            servings: null,
            is_termorobot: false,
            is_grill: false,
        },
    };
}
