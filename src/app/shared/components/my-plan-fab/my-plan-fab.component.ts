import {
    ChangeDetectionStrategy,
    Component,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MyPlanService } from '../../../core/services/my-plan.service';

/**
 * Pływający przycisk FAB "Mój plan".
 * Widoczny gdy plan ma co najmniej 1 element.
 * Otwiera drawer z listą przepisów.
 */
@Component({
    selector: 'pych-my-plan-fab',
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatBadgeModule,
        MatTooltipModule,
    ],
    templateUrl: './my-plan-fab.component.html',
    styleUrl: './my-plan-fab.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPlanFabComponent {
    private readonly myPlanService = inject(MyPlanService);

    /** Liczba elementów w planie */
    readonly planTotal = this.myPlanService.planTotal;

    /** Czy plan ma elementy */
    readonly hasItems = this.myPlanService.hasItems;

    /** Czy drawer "Mój plan" jest aktualnie otwarty */
    readonly isDrawerOpen = this.myPlanService.isDrawerOpen;

    /**
     * Otwiera drawer "Mój plan"
     */
    onOpenDrawer(): void {
        this.myPlanService.openDrawer();
    }
}

