import {
    AdminUsersSortBy,
    AppRole,
    GetAdminUsersResponseDto,
    SortDirection,
} from '../../../../../shared/contracts/types';

export interface AdminUsersTableRowVm {
    readonly id: string;
    readonly displayId: string;
    readonly login: string;
    readonly username: string;
    readonly createdAt: string;
    readonly createdAtLabel: string;
    readonly lastSignInAt: string | null;
    readonly lastSignInAtLabel: string;
    readonly recipesCount: number;
    readonly role: AppRole;
    readonly roleLabel: string;
    readonly roleTone: 'default' | 'accent' | 'warn' | 'neutral';
}

export interface AdminUsersTableStateVm {
    readonly isInitialLoading: boolean;
    readonly isRefreshing: boolean;
    readonly isEmpty: boolean;
    readonly hasError: boolean;
    readonly errorMessage: string | null;
}

export interface AdminUsersSortChangeEvent {
    readonly sort_by: AdminUsersSortBy;
    readonly sort_dir: SortDirection;
}

export interface AdminUsersPageChangeEvent {
    readonly page: number;
    readonly page_size: number;
}

export type AdminUsersPaginationVm = GetAdminUsersResponseDto['pagination'];
export type AdminUsersSortingVm = GetAdminUsersResponseDto['sorting'];
