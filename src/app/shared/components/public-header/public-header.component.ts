import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'stbo-public-header',
    standalone: true,
    imports: [RouterLink, MatToolbarModule, MatButtonModule],
    templateUrl: './public-header.component.html',
    styleUrl: './public-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicHeaderComponent {}

