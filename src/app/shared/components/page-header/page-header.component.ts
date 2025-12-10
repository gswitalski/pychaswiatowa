import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Reusable page header component for dashboard views.
 * Displays a sticky header with title, optional subtitle, and slot for action buttons.
 */
@Component({
    selector: 'pych-page-header',
    standalone: true,
    imports: [],
    templateUrl: './page-header.component.html',
    styleUrl: './page-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
    /** Main title of the page */
    title = input.required<string>();

    /** Optional subtitle/description */
    subtitle = input<string>();
}

