import 'zone.js';
import 'zone.js/testing';
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { render, screen } from '@testing-library/angular';
import { RecipeHeaderComponent } from './recipe-header.component';
import type {
    ProfileDto,
    PublicRecipeDetailDto,
    RecipeDetailDto,
} from '../../../../../../../shared/contracts/types';

function makeRecipe(overrides: Partial<RecipeDetailDto> = {}): RecipeDetailDto {
    return {
        id: 1,
        user_id: 'user-abc',
        name: 'Testowy Przepis',
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
        author: { id: 'user-abc', username: 'jan.kowalski' },
        ...overrides,
    } as RecipeDetailDto;
}

function makePublicRecipe(overrides: Partial<PublicRecipeDetailDto> = {}): PublicRecipeDetailDto {
    return {
        id: 2,
        name: 'Publiczny Przepis',
        description: null,
        image_path: null,
        visibility: 'PUBLIC',
        category: null,
        ingredients: [],
        steps: [],
        tips: [],
        tags: [],
        author: { id: 'user-xyz', username: 'anna.nowak' },
        created_at: '2026-01-01T00:00:00Z',
        is_owner: false,
        in_my_plan: false,
        collection_ids: [],
        servings: null,
        is_termorobot: false,
        prep_time_minutes: null,
        total_time_minutes: null,
        diet_type: null,
        cuisine: null,
        difficulty: null,
        is_grill: false,
        average_rating: null,
        ratings_count: 0,
        ...overrides,
    };
}

async function setupHeader(recipe: RecipeDetailDto | PublicRecipeDetailDto, isPublic = false) {
    return render(RecipeHeaderComponent, {
        imports: [NoopAnimationsModule],
        providers: [provideRouter([])],
        componentInputs: { recipe, isPublic },
    });
}

describe('RecipeHeaderComponent — sekcja autora', () => {
    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    it('T1: wyświetla "Autor: jan.kowalski" gdy author.username jest ustawiony', async () => {
        await setupHeader(makeRecipe());

        expect(screen.getByText('Autor: jan.kowalski')).toBeTruthy();
    });

    it('T2: wyświetla ikonę person z aria-label="Autor"', async () => {
        const { container } = await setupHeader(makeRecipe());

        const icon = container.querySelector('.recipe-author mat-icon[aria-label="Autor"]');
        expect(icon).toBeTruthy();
        expect(icon?.textContent?.trim()).toBe('person');
    });

    it('T3: nie renderuje sekcji autora gdy author.username jest null', async () => {
        const author = { id: 'user-abc', username: null } as unknown as ProfileDto;
        const { container } = await setupHeader(makeRecipe({ author }));

        expect(screen.queryByText(/Autor:/)).toBeNull();
        expect(container.querySelector('.recipe-author')).toBeNull();
    });

    it('T3b: nie renderuje sekcji autora gdy author.username jest pusty lub z samych spacji', async () => {
        const author = { id: 'user-abc', username: '   ' } as ProfileDto;
        const { container } = await setupHeader(makeRecipe({ author }));

        expect(container.querySelector('.recipe-author')).toBeNull();
    });

    it('T4: nie renderuje sekcji autora gdy author jest null', async () => {
        const author = null as unknown as ProfileDto;
        const { container } = await setupHeader(makeRecipe({ author }));

        expect(screen.queryByText(/Autor:/)).toBeNull();
        expect(container.querySelector('.recipe-author')).toBeNull();
    });

    it('T4b: nie renderuje sekcji autora gdy author jest undefined', async () => {
        const author = undefined as unknown as ProfileDto;
        const { container } = await setupHeader(makeRecipe({ author }));

        expect(container.querySelector('.recipe-author')).toBeNull();
    });

    it('T5: username nie jest linkiem — brak <a> w .recipe-author', async () => {
        const { container } = await setupHeader(makeRecipe());

        const authorSection = container.querySelector('.recipe-author');
        expect(authorSection).toBeTruthy();
        expect(authorSection?.querySelector('a')).toBeNull();
    });

    it('T6: wyświetla autora dla własnego przepisu (RecipeDetailDto)', async () => {
        await setupHeader(makeRecipe({ visibility: 'PRIVATE' }));

        expect(screen.getByText('Autor: jan.kowalski')).toBeTruthy();
    });

    it('T7: wyświetla autora dla cudzego publicznego przepisu (PublicRecipeDetailDto)', async () => {
        await setupHeader(makePublicRecipe(), true);

        expect(screen.getByText('Autor: anna.nowak')).toBeTruthy();
    });

    it('T8: sekcja autora jest po porcjach i przed opisem', async () => {
        const { container } = await setupHeader(
            makeRecipe({ servings: 4, description: 'Opis przepisu' }),
        );

        const servings = container.querySelector('.recipe-servings');
        const author = container.querySelector('.recipe-author');
        const description = container.querySelector('.recipe-description');

        expect(servings).toBeTruthy();
        expect(author).toBeTruthy();
        expect(description).toBeTruthy();
        expect(
            servings!.compareDocumentPosition(author!) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
            author!.compareDocumentPosition(description!) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });
});
