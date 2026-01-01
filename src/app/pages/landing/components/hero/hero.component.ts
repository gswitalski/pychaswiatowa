import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'pych-hero',
    standalone: true,
    imports: [RouterLink, MatButtonModule, NgOptimizedImage],
    templateUrl: './hero.component.html',
    styleUrl: './hero.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroComponent {
    /**
     * Określa czy użytkownik jest zalogowany.
     * Jeśli true, CTA przyciski login/register nie będą wyświetlane.
     */
    isAuthenticated = input<boolean>(false);
}


