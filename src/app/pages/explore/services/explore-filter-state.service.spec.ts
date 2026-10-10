import { describe, expect, it } from 'vitest';

import { EXPLORE_FILTERS_DEFAULT } from '../models/explore-filters.model';
import { ExploreFilterStateService } from './explore-filter-state.service';

describe('ExploreFilterStateService', () => {
    const service = new ExploreFilterStateService();

    it('parsuje aktywne filtry z parametrów URL', () => {
        expect(
            service.fromQueryParams({
                termorobot: 'true',
                diet: 'vege_plus',
                want_to_try: 'true',
            })
        ).toEqual({
            termorobot: true,
            grill: false,
            diet: 'vege_plus',
            favorite: false,
            wantToTry: true,
        });
    });

    it('pomija domyślne wartości przy budowaniu parametrów URL', () => {
        expect(service.toQueryParams(EXPLORE_FILTERS_DEFAULT)).toEqual({});
    });

    it('buduje parametry API dla aktywnych filtrów', () => {
        expect(
            service.toApiParams({
                ...EXPLORE_FILTERS_DEFAULT,
                wantToTry: true,
                diet: 'vegan',
            })
        ).toEqual({ diet: 'vegan', want_to_try: 'true' });
    });

    it('rozpoznaje aktywne filtry i toleruje nieznaną dietę', () => {
        expect(service.hasActiveFilters(EXPLORE_FILTERS_DEFAULT)).toBe(false);
        expect(service.hasActiveFilters({ ...EXPLORE_FILTERS_DEFAULT, grill: true })).toBe(true);
        expect(service.fromQueryParams({ diet: 'xyz' }).diet).toBeNull();
    });
});
