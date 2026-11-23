import 'zone.js';
import 'zone.js/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { describe, expect, it, beforeAll, vi } from 'vitest';
import { render } from '@testing-library/angular';
import { RecipeDetailViewComponent } from './recipe-detail-view.component';
import type { RecipeDetailDto } from '../../../../../shared/contracts/types';
import { RecipeNoteService } from '../../../core/services/recipe-note.service';
import { UnsavedChangesService } from '../../../core/services/unsaved-changes.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

function recipe(overrides: Partial<RecipeDetailDto> = {}): RecipeDetailDto {
    return {
        id: 1,
        user_id: 'user-1',
        name: 'Zupa',
        description: null,
        image_path: null,
        visibility: 'PUBLIC',
        category_id: null,
        category_name: null,
        ingredients: [],
        steps: [],
        tips: [],
        tags: [],
        servings: 4,
        is_termorobot: false,
        prep_time_minutes: 10,
        total_time_minutes: 20,
        diet_type: null,
        cuisine: null,
        difficulty: null,
        is_grill: false,
        in_my_plan: false,
        collection_ids: [],
        normalized_ingredients_status: 'PENDING',
        normalized_ingredients_updated_at: null,
        average_rating: null,
        ratings_count: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        author: { id: 'user-1', username: 'autor' },
        variant_name: 'Klasyczna',
        active_variant_count: 1,
        ...overrides,
    } as RecipeDetailDto;
}

async function setup(current: RecipeDetailDto) {
    const rendered = await render(RecipeDetailViewComponent, {
        imports: [NoopAnimationsModule],
        providers: [
            { provide: RecipeNoteService, useValue: { setNote: vi.fn() } },
            { provide: UnsavedChangesService, useValue: { setDirty: vi.fn(), clear: vi.fn() } },
            { provide: MatDialog, useValue: { open: vi.fn() } },
            { provide: MatSnackBar, useValue: { open: vi.fn() } },
        ],
        componentInputs: {
            recipe: current,
            isLoading: false,
            error: null,
            isAuthenticated: false,
            isOwner: false,
            headerMode: 'guest',
            pageTitle: 'Zupa',
            showPageHeader: false,
        },
    });
    return rendered;
}

describe('RecipeDetailViewComponent — przełącznik wariantów', () => {
    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    it('ukrywa przełącznik dla jednego wariantu', async () => {
        const { container } = await setup(recipe());

        expect(container.querySelector('.variant-switcher')).toBeNull();
    });

    it('renderuje zakładki dla 2–3 wariantów i wyróżnia aktywny', async () => {
        const { container } = await setup(recipe({
            active_variant_count: 2,
            variants: [
                { recipe_id: 1, variant_name: 'Klasyczna', is_default: true, sort_order: 0, image_path: null, chips: { diet_type: null, is_termorobot: false, is_grill: false, difficulty: null, servings: null } },
                { recipe_id: 2, variant_name: 'Wegańska', is_default: false, sort_order: 1, image_path: null, chips: { diet_type: 'VEGAN', is_termorobot: false, is_grill: false, difficulty: null, servings: null } },
            ],
        }));

        expect(container.querySelectorAll('[role="tab"]').length).toBe(2);
        expect(container.querySelector('[role="tab"][aria-selected="true"]')).toBeTruthy();
    });

    it('renderuje listę rozwijaną dla co najmniej 4 wariantów', async () => {
        const { container } = await setup(recipe({
            active_variant_count: 4,
            variants: Array.from({ length: 4 }, (_, index) => ({
                recipe_id: index + 1,
                variant_name: `Wariant ${index + 1}`,
                is_default: index === 0,
                sort_order: index,
                image_path: null,
                chips: { diet_type: null, is_termorobot: false, is_grill: false, difficulty: null, servings: null },
            })),
        }));

        expect(container.querySelector('mat-select')).toBeTruthy();
        expect(container.querySelectorAll('mat-option').length).toBe(0);
        expect(container.querySelector('mat-select[aria-label="Wariant przepisu"]')).toBeTruthy();
    });

    it('pokazuje baner ratunku z powodem odpowiedzi API', async () => {
        const { container } = await setup(recipe({
            active_variant_count: 2,
            variant_resolution: {
                reason: 'VARIANT_DELETED',
                message: 'Ten wariant został usunięty',
            },
            variants: [
                { recipe_id: 1, variant_name: 'Klasyczna', is_default: true, sort_order: 0, image_path: null, chips: { diet_type: null, is_termorobot: false, is_grill: false, difficulty: null, servings: null } },
                { recipe_id: 2, variant_name: 'Wegańska', is_default: false, sort_order: 1, image_path: null, chips: { diet_type: 'VEGAN', is_termorobot: false, is_grill: false, difficulty: null, servings: null } },
            ],
        }));

        expect(container.querySelector('.variant-resolution')?.textContent).toContain('usunięty');
    });
});
