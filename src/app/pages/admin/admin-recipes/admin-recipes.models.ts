import {
    AdminRecipesSortBy,
    GetAdminRecipesResponseDto,
    SortDirection,
} from '../../../../../shared/contracts/types';

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

export const ADMIN_RECIPES_PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100];

export function buildAuthorDisplayId(id: string): string {
    if (!id || id.length <= 12) {
        return id;
    }

    return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
