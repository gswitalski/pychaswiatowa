import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NavigationTileViewModel } from '../../dashboard-page.component';

@Component({
    selector: 'pych-navigation-tile',
    standalone: true,
    imports: [RouterLink, MatCardModule, MatIconModule],
    templateUrl: './navigation-tile.component.html',
    styleUrl: './navigation-tile.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationTileComponent {
    @Input({ required: true }) tileData!: NavigationTileViewModel;
}


