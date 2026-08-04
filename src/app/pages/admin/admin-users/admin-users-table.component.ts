import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort, SortDirection as MatSortDirection } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminUsersSortBy, SortDirection } from '../../../../../shared/contracts/types';
import {
    AdminUsersPageChangeEvent,
    AdminUsersPaginationVm,
    AdminUsersSortChangeEvent,
    AdminUsersSortingVm,
    AdminUsersTableRowVm,
    AdminUsersTableStateVm,
} from './admin-users.models';

const COLUMN_TO_SORT_BY_MAP: Readonly<Record<string, AdminUsersSortBy>> = {
    login: 'login',
    createdAt: 'created_at',
    lastSignInAt: 'last_sign_in_at',
    recipesCount: 'recipes_count',
};

const SORT_BY_TO_COLUMN_MAP: Readonly<Record<AdminUsersSortBy, string>> = {
    created_at: 'createdAt',
    login: 'login',
    last_sign_in_at: 'lastSignInAt',
    recipes_count: 'recipesCount',
};

@Component({
    selector: 'pych-admin-users-table',
    standalone: true,
    imports: [
        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
    ],
    templateUrl: './admin-users-table.component.html',
    styleUrl: './admin-users-table.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersTableComponent {
    readonly rows = input.required<AdminUsersTableRowVm[]>();
    readonly state = input.required<AdminUsersTableStateVm>();
    readonly pagination = input.required<AdminUsersPaginationVm>();
    readonly sorting = input.required<AdminUsersSortingVm>();
    readonly displayedColumns = input.required<readonly string[]>();
    readonly currentAdminUserId = input<string | null>(null);

    readonly sortChange = output<AdminUsersSortChangeEvent>();
    readonly pageChange = output<AdminUsersPageChangeEvent>();
    readonly retry = output<void>();
    readonly editRole = output<AdminUsersTableRowVm>();

    readonly hasRows = computed(() => this.rows().length > 0);
    readonly activeSortColumn = computed(() => SORT_BY_TO_COLUMN_MAP[this.sorting().sort_by]);
    readonly paginatorPageIndex = computed(() => Math.max(this.pagination().currentPage - 1, 0));

    onMatSortChange(event: Sort): void {
        const sortBy = COLUMN_TO_SORT_BY_MAP[event.active];
        if (!sortBy) {
            return;
        }

        const sortDir = this.normalizeMatSortDirection(event.direction);
        this.sortChange.emit({
            sort_by: sortBy,
            sort_dir: sortDir,
        });
    }

    onMatPageChange(event: PageEvent): void {
        this.pageChange.emit({
            page: event.pageIndex + 1,
            page_size: event.pageSize,
        });
    }

    onRetryClick(): void {
        this.retry.emit();
    }

    isSelfRow(row: AdminUsersTableRowVm): boolean {
        const currentId = this.currentAdminUserId();
        if (!currentId) {
            return false;
        }

        return row.id === currentId;
    }

    onEditRoleClick(row: AdminUsersTableRowVm): void {
        if (this.isSelfRow(row)) {
            return;
        }

        this.editRole.emit(row);
    }

    buildEditRoleAriaLabel(row: AdminUsersTableRowVm): string {
        const identifier = row.username?.trim() || row.login?.trim() || row.displayId;
        return `Zmień rolę użytkownika ${identifier}`;
    }

    trackByRowId(_: number, row: AdminUsersTableRowVm): string {
        return row.id;
    }

    private normalizeMatSortDirection(direction: MatSortDirection): SortDirection {
        if (direction === 'asc') {
            return 'asc';
        }

        return 'desc';
    }
}
