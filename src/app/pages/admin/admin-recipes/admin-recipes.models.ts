import {
    AdminRecipesSortBy,
    GetAdminRecipesResponseDto,
    SortDirection,
} from '../../../../../shared/contracts/types';

export interface AdminRecipesFiltersVm {
    readonly id: number | null;
    readonly name: string;
    readonly author: string;
    readonly categoryIds: readonly number[];
    readonly includeUncategorized: boolean;
    readonly createdFrom: string;
    readonly createdTo: string;
    readonly ratingMin: number | null;
    readonly ratingMax: number | null;
    readonly ratingsCountMin: number | null;
    readonly ratingsCountMax: number | null;
    readonly isGrill: boolean;
    readonly isTermorobot: boolean;
}

export const EMPTY_ADMIN_RECIPES_FILTERS: AdminRecipesFiltersVm = {
    id: null,
    name: '',
    author: '',
    categoryIds: [],
    includeUncategorized: false,
    createdFrom: '',
    createdTo: '',
    ratingMin: null,
    ratingMax: null,
    ratingsCountMin: null,
    ratingsCountMax: null,
    isGrill: false,
    isTermorobot: false,
};

export function countActiveAdminRecipeFilters(filters: AdminRecipesFiltersVm): number {
    let count = 0;
    count += filters.id !== null ? 1 : 0;
    count += filters.name.trim() ? 1 : 0;
    count += filters.author.trim() ? 1 : 0;
    count += filters.categoryIds.length + (filters.includeUncategorized ? 1 : 0);
    count += filters.createdFrom || filters.createdTo ? 1 : 0;
    count += filters.ratingMin !== null || filters.ratingMax !== null ? 1 : 0;
    count += filters.ratingsCountMin !== null || filters.ratingsCountMax !== null ? 1 : 0;
    count += filters.isGrill ? 1 : 0;
    count += filters.isTermorobot ? 1 : 0;
    return count;
}

export interface AdminRecipesTableRowVm {
    readonly id: number;
    readonly name: string;
    readonly authorId: string;
    readonly authorPrimaryLabel: string;
    readonly authorSecondaryLabel: string | null;
    readonly categoryLabel: string;
    readonly createdAtLabel: string;
    readonly averageRatingLabel: string;
    readonly ratingsCount: number;
    readonly isGrill: boolean;
    readonly isTermorobot: boolean;
    readonly recipeUrl: string;
    readonly openAriaLabel: string;
}

export interface AdminRecipesTableStateVm {
    readonly isInitialLoading: boolean;
    readonly isRefreshing: boolean;
    readonly isEmpty: boolean;
    readonly hasNoRowsOnPage: boolean;
    readonly hasError: boolean;
    readonly errorMessage: string | null;
    readonly hasActiveFilters?: boolean;
}

export interface AdminRecipesSortChangeEvent {
    readonly sort_by: AdminRecipesSortBy;
    readonly sort_dir: SortDirection;
}

export interface AdminRecipesPageChangeEvent {
    readonly page: number;
    readonly page_size: number;
}

export type AdminRecipesPaginationVm = GetAdminRecipesResponseDto['pagination'];
export type AdminRecipesSortingVm = GetAdminRecipesResponseDto['sorting'];
export type AdminRecipesQueryState = Parameters<
    (query: import('../../../../../shared/contracts/types').GetAdminRecipesQueryDto) => void
>[0] & {
    page: number;
    page_size: number;
};

export const ADMIN_RECIPES_PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100];

export function buildAuthorDisplayId(id: string): string {
    if (!id || id.length <= 12) {
        return id;
    }

    return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
