import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'pych-email-confirmed-page',
    standalone: true,
    imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
    templateUrl: './email-confirmed-page.component.html',
    styleUrl: './email-confirmed-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailConfirmedPageComponent {}



