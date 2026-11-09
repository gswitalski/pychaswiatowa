import { expect, test } from './fixtures';

const hasAuthenticatedUser =
    Boolean(process.env.TEST_USER_EMAIL) && Boolean(process.env.TEST_USER_PASSWORD);

test.describe('Osobista notatka przepisu', () => {
    test.skip(!hasAuthenticatedUser, 'Wymagane zmienne TEST_USER_EMAIL i TEST_USER_PASSWORD');

    test('pokazuje sekcję notatki na szczegółach własnego przepisu', async ({
        authenticatedPage: page,
    }) => {
        await page.goto('/my-recipies');
        const firstRecipe = page.locator('pych-recipe-card a').first();
        await expect(firstRecipe).toBeVisible();
        await firstRecipe.click();
        await expect(page.getByTestId('recipe-note')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Dodaj notatkę' })).toBeVisible();
    });
});
