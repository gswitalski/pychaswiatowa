import { Injectable } from '@angular/core';
import { Params } from '@angular/router';

import {
    EXPLORE_FILTERS_DEFAULT,
    ExploreFilterDiet,
    ExploreFilters,
} from '../models/explore-filters.model';

@Injectable({ providedIn: 'root' })
export class ExploreFilterStateService {
    fromQueryParams(params: Params): ExploreFilters {
        return {
            termorobot: params['termorobot'] === 'true',
            grill: params['grill'] === 'true',
            diet: this.parseDiet(params['diet']),
            favorite: params['favorite'] === 'true',
            wantToTry: params['want_to_try'] === 'true',
        };
    }

    toQueryParams(filters: ExploreFilters): Params {
        const params: Params = {};

        if (filters.termorobot) params['termorobot'] = 'true';
        if (filters.grill) params['grill'] = 'true';
        if (filters.diet) params['diet'] = filters.diet;
        if (filters.favorite) params['favorite'] = 'true';
        if (filters.wantToTry) params['want_to_try'] = 'true';

        return params;
    }

    toApiParams(filters: ExploreFilters): Record<string, string> {
        const params: Record<string, string> = {};

        if (filters.termorobot) params['termorobot'] = 'true';
        if (filters.grill) params['grill'] = 'true';
        if (filters.diet) params['diet'] = filters.diet;
        if (filters.favorite) params['favorite'] = 'true';
        if (filters.wantToTry) params['want_to_try'] = 'true';

        return params;
    }

    hasActiveFilters(filters: ExploreFilters): boolean {
        return (
            filters.termorobot ||
            filters.grill ||
            filters.diet !== null ||
            filters.favorite ||
            filters.wantToTry
        );
    }

    reset(): ExploreFilters {
        return { ...EXPLORE_FILTERS_DEFAULT };
    }

    private parseDiet(value: unknown): ExploreFilterDiet {
        return value === 'vege_plus' || value === 'vegan' ? value : null;
    }
}
