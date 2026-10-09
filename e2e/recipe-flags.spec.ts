import { expect, test } from './fixtures';

const hasAuthenticatedUser =
    Boolean(process.env.TEST_USER_EMAIL) &&
    Boolean(process.env.TEST_USER_PASSWORD);

test.describe('Osobiste flagi przepisu', () => {
    test.skip(
        !hasAuthenticatedUser,
        'Wymagane zmienne TEST_USER_EMAIL i TEST_USER_PASSWORD'
    );

    test('zapisuje flagi, zachowuje je po odświeżeniu i pokazuje serce na kafelku', async ({
        authenticatedPage: page,
    }) => {
        await page.goto('/my-recipies');

        const firstCardLink = page.locator('pych-recipe-card a').first();
        await expect(firstCardLink).toBeVisible();
        await firstCardLink.click();

        const detailUrl = new URL(page.url());
        const favoriteButton = page.getByRole('button', {
            name: 'Ulubiony przepis',
        });
        const wantToTryButton = page.getByRole('button', {
            name: 'Chcę wypróbować ten przepis',
        });

        await expect(favoriteButton).toBeVisible();
        await expect(wantToTryButton).toBeVisible();

        const initialFavorite =
            (await favoriteButton.getAttribute('aria-pressed')) === 'true';
        const initialWantToTry =
            (await wantToTryButton.getAttribute('aria-pressed')) === 'true';

        try {
            if (!initialFavorite) {
                await favoriteButton.click();
                await expect(favoriteButton).toBeEnabled();
            }

            await wantToTryButton.click();
            await expect(wantToTryButton).toBeEnabled();
            const expectedWantToTry = String(!initialWantToTry);

            await page.reload();

            await expect(favoriteButton).toHaveAttribute(
                'aria-pressed',
                'true'
            );
            await expect(wantToTryButton).toHaveAttribute(
                'aria-pressed',
                expectedWantToTry
            );

            await page.goto('/my-recipies');

            const cardLink = page.locator(
                `pych-recipe-card a[href="${detailUrl.pathname}"]`
            );
            const favoriteIndicator = cardLink.getByRole('img', {
                name: 'Ulubiony przepis',
            });

            await expect(favoriteIndicator).toBeVisible();

            const cardBox = await cardLink.boundingBox();
            const indicatorBox = await favoriteIndicator.boundingBox();
            expect(cardBox).not.toBeNull();
            expect(indicatorBox).not.toBeNull();

            await cardLink.click({
                position: {
                    x:
                        indicatorBox!.x -
                        cardBox!.x +
                        indicatorBox!.width / 2,
                    y:
                        indicatorBox!.y -
                        cardBox!.y +
                        indicatorBox!.height / 2,
                },
            });
            await expect(page).toHaveURL(detailUrl.toString());
        } finally {
            if (page.url() !== detailUrl.toString()) {
                await page.goto(detailUrl.toString());
            }

            const currentFavorite =
                (await favoriteButton.getAttribute('aria-pressed')) === 'true';
            const currentWantToTry =
                (await wantToTryButton.getAttribute('aria-pressed')) === 'true';

            if (currentFavorite !== initialFavorite) {
                await favoriteButton.click();
                await expect(favoriteButton).toBeEnabled();
            }

            if (currentWantToTry !== initialWantToTry) {
                await wantToTryButton.click();
                await expect(wantToTryButton).toBeEnabled();
            }
        }
    });
});

test.describe('Flagi przepisu dla gościa', () => {
    test.skip(
        !process.env.TEST_PUBLIC_RECIPE_URL,
        'Wymagana zmienna TEST_PUBLIC_RECIPE_URL'
    );

    test('nie pokazuje przełączników na publicznych szczegółach', async ({
        page,
    }) => {
        await page.goto(process.env.TEST_PUBLIC_RECIPE_URL!);

        await expect(
            page.getByRole('button', { name: 'Ulubiony przepis' })
        ).toHaveCount(0);
        await expect(
            page.getByRole('button', {
                name: 'Chcę wypróbować ten przepis',
            })
        ).toHaveCount(0);
    });
});
