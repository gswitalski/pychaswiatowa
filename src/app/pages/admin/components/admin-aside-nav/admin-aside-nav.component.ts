import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { AdminNavItemVm } from '../../models/admin-navigation.models';

@Component({
    selector: 'pych-admin-aside-nav',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule],
    templateUrl: './admin-aside-nav.component.html',
    styleUrl: './admin-aside-nav.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAsideNavComponent {
    readonly sectionTitle = input<string>('Admin');
    readonly items = input.required<readonly AdminNavItemVm[]>();
}
