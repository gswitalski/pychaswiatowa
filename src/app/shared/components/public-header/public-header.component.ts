import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MainNavigationComponent } from '../main-navigation/main-navigation.component';

/**
 * Public header component for guest users.
 * Displays logo, main navigation, and auth CTAs.
 */
@Component({
    selector: 'pych-public-header',
    standalone: true,
    imports: [
        RouterLink,
        MatToolbarModule,
        MatButtonModule,
        MainNavigationComponent,
    ],
    templateUrl: './public-header.component.html',
    styleUrl: './public-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicHeaderComponent {}


