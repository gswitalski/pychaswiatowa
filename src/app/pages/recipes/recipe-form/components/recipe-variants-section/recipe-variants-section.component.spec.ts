import 'zone.js';
import 'zone.js/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeAll, describe, expect, it, beforeEach, vi } from 'vitest';
import { Subject, of } from 'rxjs';
import { MeApiService } from '../../../../../core/services/me-api.service';
import { RecipesService } from '../../../services/recipes.service';
import type { RecipeVariantSummaryDto } from '../../../../../../../shared/contracts/types';
import { RecipeVariantsSectionComponent } from './recipe-variants-section.component';

describe('RecipeVariantsSectionComponent', () => {
    let fixture: ComponentFixture<RecipeVariantsSectionComponent>;
    let meApi: { getMe: ReturnType<typeof vi.fn> };
    let recipes: { getRecipeVariants: ReturnType<typeof vi.fn> };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        meApi = { getMe: vi.fn() };
        recipes = { getRecipeVariants: vi.fn() };
        await TestBed.configureTestingModule({
            imports: [RecipeVariantsSectionComponent, NoopAnimationsModule],
            providers: [
                { provide: MeApiService, useValue: meApi },
                { provide: RecipesService, useValue: recipes },
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
});
