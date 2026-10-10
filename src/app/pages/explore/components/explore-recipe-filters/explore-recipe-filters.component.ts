import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
    ExploreFilterDiet,
    ExploreFilters,
} from '../../models/explore-filters.model';

type ToggleFilter = 'termorobot' | 'grill' | 'favorite' | 'wantToTry';

@Component({
    selector: 'pych-explore-recipe-filters',
    standalone: true,
    imports: [MatButtonToggleModule, MatIconModule, MatTooltipModule],
    templateUrl: './explore-recipe-filters.component.html',
    styleUrl: './explore-recipe-filters.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreRecipeFiltersComponent {
    readonly filters = input.required<ExploreFilters>();
    readonly isAuthenticated = input<boolean>(false);
    readonly filtersChange = output<ExploreFilters>();

    toggle(field: ToggleFilter): void {
        this.filtersChange.emit({
            ...this.filters(),
            [field]: !this.filters()[field],
        });
    }

    onDietChange(event: MatButtonToggleChange): void {
        this.filtersChange.emit({
            ...this.filters(),
            diet: (event.value as ExploreFilterDiet | '') || null,
        });
    }
}
