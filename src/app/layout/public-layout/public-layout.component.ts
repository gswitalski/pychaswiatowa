import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicHeaderComponent } from '../../shared/components/public-header/public-header.component';

@Component({
    selector: 'pych-public-layout',
    standalone: true,
    imports: [RouterOutlet, PublicHeaderComponent],
    templateUrl: './public-layout.component.html',
    styleUrl: './public-layout.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayoutComponent {}


