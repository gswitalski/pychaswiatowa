import {
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    output,
} from '@angular/core';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Reusable page header component for dashboard views.
 * Displays a sticky header with title, optional subtitle, back button, and slot for action buttons.
 */
@Component({
    selector: 'pych-page-header',
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
    templateUrl: './page-header.component.html',
    styleUrl: './page-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
    private readonly location = inject(Location);

    /** Main title of the page */
    title = input.required<string>();

    /** Optional subtitle/description */
    subtitle = input<string>();

    /** Show back button (default: false) */
    showBackButton = input<boolean>(false);

    /** Emits when back button is clicked (if not handled, uses Location.back()) */
    backClick = output<void>();

    /**
     * Handle back button click.
     * Navigates back using Location service and emits backClick event.
     */
    onBackClick(): void {
        this.backClick.emit();
        this.location.back();
    }
}

