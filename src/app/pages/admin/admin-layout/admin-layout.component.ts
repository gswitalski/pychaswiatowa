import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminAsideNavComponent } from '../components/admin-aside-nav/admin-aside-nav.component';
import { ADMIN_NAV_ITEMS } from './admin-navigation.config';

@Component({
    selector: 'pych-admin-layout',
    standalone: true,
    imports: [RouterOutlet, AdminAsideNavComponent],
    templateUrl: './admin-layout.component.html',
    styleUrl: './admin-layout.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent {
    readonly navItems = ADMIN_NAV_ITEMS;
}
