import 'zone.js';
import 'zone.js/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeAll, vi } from 'vitest';
import { Subject } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeDetailPageComponent } from './recipe-detail-page.component';
import { RecipesService } from '../services/recipes.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MyPlanService } from '../../../core/services/my-plan.service';
import { SlugService } from '../../../shared/services/slug.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import type { RecipeDetailDto } from '../../../../../shared/contracts/types';

function recipe(id: number): RecipeDetailDto {
    return {
        id,
        user_id: 'user-1',
        name: 'Zupa',
        description: null,
        image_path: null,
        visibility: 'PRIVATE',
        category_id: null,
        category_name: null,
        ingredients: [],
        steps: [],
        tips: [],
        tags: [],
        servings: null,
        is_termorobot: false,
        prep_time_minutes: null,
        total_time_minutes: null,
        diet_type: null,
        cuisine: null,
        difficulty: null,
        is_grill: false,
        in_my_plan: false,
        collection_ids: [],
        normalized_ingredients_status: 'PENDING',
        normalized_ingredients_updated_at: null,
        average_rating: null,
        ratings_count: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        author: { id: 'user-1', username: 'autor' },
        variant_name: null,
        active_variant_count: 1,
    } as RecipeDetailDto;
}

describe('RecipeDetailPageComponent — ochrona przed spóźnioną odpowiedzią', () => {
    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    it('ignoruje odpowiedź starszego żądania po odpowiedzi nowszego', () => {
        const requests = new Map<number, Subject<RecipeDetailDto>>();
        const getRecipeById = vi.fn((id: number) => {
            const request = new Subject<RecipeDetailDto>();
            requests.set(id, request);
            return request.asObservable();
        });

        TestBed.configureTestingModule({
            imports: [RecipeDetailPageComponent],
            providers: [
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { queryParams: {}, paramMap: { get: () => null } },
                        paramMap: new Subject(),
                        queryParamMap: new Subject(),
                    },
                },
                { provide: Router, useValue: { createUrlTree: vi.fn(), navigateByUrl: vi.fn() } },
                { provide: RecipesService, useValue: { getRecipeById } },
                { provide: SupabaseService, useValue: { auth: { getSession: vi.fn() } } },
                { provide: MyPlanService, useValue: { planChanges: new Subject() } },
                { provide: SlugService, useValue: { slugify: () => 'zupa' } },
                { provide: MatSnackBar, useValue: { open: vi.fn() } },
                { provide: MatDialog, useValue: { open: vi.fn() } },
            ],
        });
        const fixture = TestBed.createComponent(RecipeDetailPageComponent);
        const component = fixture.componentInstance as unknown as {
            loadRecipe(id: number, slug?: string): void;
            recipe(): RecipeDetailDto | null;
        };

        component.loadRecipe(1, 'zupa');
        component.loadRecipe(2, 'zupa');
        requests.get(2)!.next(recipe(2));
        requests.get(1)!.next(recipe(1));

        expect(component.recipe()?.id).toBe(2);
    });
});
