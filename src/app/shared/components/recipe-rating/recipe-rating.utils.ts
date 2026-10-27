export type RatingStar = 1 | 2 | 3 | 4 | 5;

export const RATING_STARS: readonly RatingStar[] = [1, 2, 3, 4, 5];

export function formatAverageRating(value: number): string {
    return new Intl.NumberFormat('pl-PL', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(value);
}

export function pluralizeRatings(count: number): string {
    if (count === 1) {
        return 'ocena';
    }

    if (
        [2, 3, 4].includes(count % 10) &&
        ![12, 13, 14].includes(count % 100)
    ) {
        return 'oceny';
    }

    return 'ocen';
}

export function buildRatingSummary(
    average: number | null,
    count: number
): string {
    if (count === 0) {
        return 'Brak ocen';
    }

    const countLabel = `${count} ${pluralizeRatings(count)}`;
    if (average === null) {
        return countLabel;
    }

    return `★ ${formatAverageRating(average)} / 5 · ${countLabel}`;
}

export function buildReadonlyAriaLabel(
    average: number | null,
    count: number
): string {
    if (count === 0) {
        return 'Brak ocen';
    }

    if (average === null) {
        return `${count} ${pluralizeRatings(count)}`;
    }

    return `Średnia ocena ${formatAverageRating(average)} na 5 na podstawie ${count} ${pluralizeRatings(count)}`;
}
