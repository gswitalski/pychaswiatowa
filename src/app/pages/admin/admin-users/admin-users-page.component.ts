import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import {
    AdminUserListItemDto,
    AppRole,
    GetAdminUsersQueryDto,
    GetAdminUsersResponseDto,
    UpdateAdminUserRoleResponseDto,
} from '../../../../../shared/contracts/types';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { AdminUsersPageHeaderComponent } from './admin-users-page-header.component';
import { AdminUsersTableComponent } from './admin-users-table.component';
import {
    ChangeUserRoleDialogCloseResult,
    ChangeUserRoleDialogComponent,
} from './change-user-role-dialog.component';
import {
    AdminUsersPageChangeEvent,
    AdminUsersSortChangeEvent,
    AdminUsersTableRowVm,
    AdminUsersTableStateVm,
} from './admin-users.models';

@Component({
    selector: 'pych-admin-users-page',
    standalone: true,
    imports: [
        AdminUsersPageHeaderComponent,
        AdminUsersTableComponent,
        MatDialogModule,
        MatSnackBarModule,
    ],
    templateUrl: './admin-users-page.component.html',
    styleUrl: './admin-users-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersPageComponent implements OnInit {
    private readonly adminApi = inject(AdminApiService);
    private readonly authService = inject(AuthService);
    private readonly dialog = inject(MatDialog);
    private readonly snackBar = inject(MatSnackBar);
    private readonly router = inject(Router);
    private latestRequestId = 0;

    readonly title = 'Użytkownicy';
    readonly description =
        'Przegląd kont w systemie. Administrator może zmieniać role użytkowników.';
    readonly displayedColumns: readonly string[] = [
        'id',
        'login',
        'username',
        'createdAt',
        'lastSignInAt',
        'recipesCount',
        'role',
        'actions',
    ];

    readonly currentAdminUserId = this.authService.userId;

    readonly query = signal<Required<GetAdminUsersQueryDto>>({
        page: 1,
        page_size: 25,
        sort_by: 'created_at',
        sort_dir: 'desc',
    });
    readonly rows = signal<AdminUsersTableRowVm[]>([]);
    readonly pagination = signal<GetAdminUsersResponseDto['pagination']>({
        currentPage: 1,
        pageSize: 25,
        totalPages: 0,
        totalItems: 0,
    });
    readonly sorting = signal<GetAdminUsersResponseDto['sorting']>({
        sort_by: 'created_at',
        sort_dir: 'desc',
    });
    readonly isInitialLoading = signal<boolean>(true);
    readonly isRefreshing = signal<boolean>(false);
    readonly errorMessage = signal<string | null>(null);

    readonly isEmpty = computed(
        () =>
            !this.isInitialLoading() &&
            !this.isRefreshing() &&
            !this.errorMessage() &&
            this.rows().length === 0
    );
    readonly tableState = computed<AdminUsersTableStateVm>(() => ({
        isInitialLoading: this.isInitialLoading(),
        isRefreshing: this.isRefreshing(),
        isEmpty: this.isEmpty(),
        hasError: this.errorMessage() !== null,
        errorMessage: this.errorMessage(),
    }));

    ngOnInit(): void {
        this.loadUsers(this.query());
    }

    onRetry(): void {
        this.loadUsers(this.query());
    }

    onSortChange(event: AdminUsersSortChangeEvent): void {
        const currentQuery = this.query();
        const nextQuery: Required<GetAdminUsersQueryDto> = {
            ...currentQuery,
            sort_by: event.sort_by,
            sort_dir: event.sort_dir,
            page: 1,
        };

        const isSameSorting =
            currentQuery.sort_by === nextQuery.sort_by &&
            currentQuery.sort_dir === nextQuery.sort_dir;
        const isOnFirstPage = currentQuery.page === 1;
        if (isSameSorting && isOnFirstPage) {
            return;
        }

        this.query.set(nextQuery);
        this.loadUsers(nextQuery);
    }

    onPageChange(event: AdminUsersPageChangeEvent): void {
        const currentQuery = this.query();
        const nextPage = Math.max(1, event.page);
        const nextQuery: Required<GetAdminUsersQueryDto> = {
            ...currentQuery,
            page: nextPage,
            page_size: event.page_size,
        };

        const isSamePage =
            currentQuery.page === nextQuery.page &&
            currentQuery.page_size === nextQuery.page_size;
        if (isSamePage) {
            return;
        }

        this.query.set(nextQuery);
        this.loadUsers(nextQuery);
    }

    onEditRole(row: AdminUsersTableRowVm): void {
        this.dialog
            .open(ChangeUserRoleDialogComponent, {
                width: '440px',
                maxWidth: '95vw',
                data: {
                    user: row,
                    updateUserRole: (userId: string, appRole: AppRole) =>
                        this.adminApi.updateUserRole(userId, appRole),
                },
            })
            .afterClosed()
            .subscribe(
                (result: ChangeUserRoleDialogCloseResult | UpdateAdminUserRoleResponseDto | undefined) => {
                    if (!result) {
                        return;
                    }

                    if (result === 'USER_NOT_FOUND') {
                        this.snackBar.open(
                            'Użytkownik nie jest już dostępny. Lista została odświeżona.',
                            'Zamknij',
                            { duration: 5000 }
                        );
                        this.loadUsers(this.query());
                        return;
                    }

                    this.applyUpdatedUser(result.user);
                    this.snackBar.open('Rola użytkownika została zmieniona.', 'Zamknij', {
                        duration: 3000,
                    });
                }
            );
    }

    private applyUpdatedUser(user: AdminUserListItemDto): void {
        this.rows.update((rows) =>
            rows.map((row) => (row.id === user.id ? this.mapUserToRow(user) : row))
        );
    }

    private loadUsers(query: Required<GetAdminUsersQueryDto>): void {
        const hasExistingRows = this.rows().length > 0;
        const requestId = ++this.latestRequestId;

        this.errorMessage.set(null);
        this.isRefreshing.set(hasExistingRows);
        this.isInitialLoading.set(!hasExistingRows);

        this.adminApi.getUsers(query).subscribe({
            next: (response) => {
                if (requestId !== this.latestRequestId) {
                    return;
                }

                this.rows.set(this.mapUsersToRows(response.data));
                this.pagination.set(response.pagination);
                this.sorting.set(response.sorting);
                this.query.set({
                    page: response.pagination.currentPage,
                    page_size: response.pagination.pageSize,
                    sort_by: response.sorting.sort_by,
                    sort_dir: response.sorting.sort_dir,
                });
                this.errorMessage.set(null);
                this.isInitialLoading.set(false);
                this.isRefreshing.set(false);
            },
            error: (error: Error & { status?: number }) => {
                if (requestId !== this.latestRequestId) {
                    return;
                }

                this.isInitialLoading.set(false);
                this.isRefreshing.set(false);

                if (error.status === 401) {
                    this.router.navigate(['/login'], {
                        queryParams: { returnUrl: '/admin/users' },
                    });
                    return;
                }

                if (error.status === 403) {
                    this.router.navigate(['/forbidden']);
                    return;
                }

                this.errorMessage.set(
                    'Nie udało się pobrać listy użytkowników. Odśwież widok lub spróbuj ponownie.'
                );
            },
        });
    }

    private mapUsersToRows(users: AdminUserListItemDto[]): AdminUsersTableRowVm[] {
        return users.map((user) => this.mapUserToRow(user));
    }

    private mapUserToRow(user: AdminUserListItemDto): AdminUsersTableRowVm {
        const safeUserName = user.username?.trim() || 'Brak nazwy użytkownika';
        const createdAtLabel = this.formatDateLabel(user.created_at, 'Brak daty');
        const lastSignInAtLabel = user.last_sign_in_at
            ? this.formatDateLabel(user.last_sign_in_at, 'Nigdy')
            : 'Nigdy';

        return {
            id: user.id,
            displayId: this.buildDisplayId(user.id),
            login: user.login,
            username: safeUserName,
            createdAt: user.created_at,
            createdAtLabel,
            lastSignInAt: user.last_sign_in_at,
            lastSignInAtLabel,
            recipesCount: Number.isFinite(user.recipes_count) ? user.recipes_count : 0,
            role: user.role,
            roleLabel: this.mapRoleLabel(user.role),
            roleTone: this.mapRoleTone(user.role),
        };
    }

    private buildDisplayId(id: string): string {
        if (!id || id.length <= 12) {
            return id;
        }

        return `${id.slice(0, 8)}...${id.slice(-4)}`;
    }

    private formatDateLabel(value: string, fallback: string): string {
        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
            return fallback;
        }

        return parsedDate.toLocaleString('pl-PL', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    }

    private mapRoleLabel(role: AppRole): string {
        if (role === 'admin') return 'Admin';
        if (role === 'premium') return 'Premium';
        return 'User';
    }

    private mapRoleTone(role: AppRole): 'default' | 'accent' | 'warn' | 'neutral' {
        if (role === 'admin') return 'warn';
        if (role === 'premium') return 'accent';
        return 'neutral';
    }
}
