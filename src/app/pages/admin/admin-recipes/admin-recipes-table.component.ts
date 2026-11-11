import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule, Sort, SortDirection as MatSortDirection } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { AdminRecipesSortBy, SortDirection } from '../../../../../shared/contracts/types';
import {
    ADMIN_RECIPES_PAGE_SIZE_OPTIONS,
    AdminRecipesPageChangeEvent,
    AdminRecipesSortChangeEvent,
    AdminRecipesPaginationVm,
    AdminRecipesSortingVm,
    AdminRecipesTableRowVm,
    AdminRecipesTableStateVm,
} from './admin-recipes.models';

const COLUMN_TO_SORT_BY_MAP: Readonly<Record<string, AdminRecipesSortBy>> = {
    name: 'name',
    author: 'author',
    category: 'category',
    createdAt: 'created_at',
    averageRating: 'average_rating',
    ratingsCount: 'ratings_count',
};

const SORT_BY_TO_COLUMN_MAP: Readonly<Record<AdminRecipesSortBy, string>> = {
    name: 'name',
    author: 'author',
    category: 'category',
    created_at: 'createdAt',
    average_rating: 'averageRating',
    ratings_count: 'ratingsCount',
};

@Component({
    selector: 'pych-admin-recipes-table',
    standalone: true,
    imports: [
        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './admin-recipes-table.component.html',
    styleUrl: './admin-recipes-table.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRecipesTableComponent {
    readonly rows = input.required<AdminRecipesTableRowVm[]>();
    readonly state = input.required<AdminRecipesTableStateVm>();
    readonly pagination = input.required<AdminRecipesPaginationVm>();
    readonly sorting = input.required<AdminRecipesSortingVm>();
    readonly displayedColumns = input.required<readonly string[]>();

    readonly sortChange = output<AdminRecipesSortChangeEvent>();
    readonly pageChange = output<AdminRecipesPageChangeEvent>();
    readonly retry = output<void>();

    readonly pageSizeOptions = ADMIN_RECIPES_PAGE_SIZE_OPTIONS;
    readonly hasRows = computed(() => this.rows().length > 0);
    readonly activeSortColumn = computed(() => SORT_BY_TO_COLUMN_MAP[this.sorting().sort_by]);
    readonly paginatorPageIndex = computed(() => Math.max(this.pagination().currentPage - 1, 0));

    onMatSortChange(event: Sort): void {
        const sortBy = COLUMN_TO_SORT_BY_MAP[event.active];
        if (!sortBy) {
            return;
        }

        this.sortChange.emit({
            sort_by: sortBy,
            sort_dir: this.normalizeMatSortDirection(event.direction),
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

    trackByRowId(_: number, row: AdminRecipesTableRowVm): number {
        return row.id;
    }

    private normalizeMatSortDirection(direction: MatSortDirection): SortDirection {
        return direction === 'asc' ? 'asc' : 'desc';
    }
}
