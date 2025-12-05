import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeroComponent } from './components/hero/hero.component';

@Component({
    selector: 'stbo-landing-page',
    standalone: true,
    imports: [HeroComponent],
    templateUrl: './landing-page.component.html',
    styleUrl: './landing-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent {}

