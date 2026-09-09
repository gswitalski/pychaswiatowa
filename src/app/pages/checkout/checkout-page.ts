import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'pych-checkout-page',
    imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
    templateUrl: './checkout-page.html',
    styleUrl: './checkout-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent {}
