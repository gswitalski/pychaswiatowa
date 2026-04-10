import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
    selector: 'pych-admin-users-page-header',
    standalone: true,
    templateUrl: './admin-users-page-header.component.html',
    styleUrl: './admin-users-page-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersPageHeaderComponent {
    readonly title = input.required<string>();
    readonly description = input.required<string>();
}
