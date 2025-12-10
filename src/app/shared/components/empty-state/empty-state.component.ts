import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Empty state component displayed when a list (e.g., recipes) is empty.
 * Shows an icon, description text, and a slot for action button.
 */
@Component({
    selector: 'pych-empty-state',
    standalone: true,
    imports: [MatIconModule],
    templateUrl: './empty-state.component.html',
    styleUrl: './empty-state.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
    /** Material icon name to display */
    icon = input<string>('inbox');

    /** Main title text */
    title = input.required<string>();

    /** Optional description text */
    description = input<string>();
}

