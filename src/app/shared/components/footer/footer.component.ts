import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type LegalLinkVm = {
    label: string;
    path: string;
    ariaLabel?: string;
};

/**
 * Global footer component with legal navigation links.
 */
@Component({
    selector: 'pych-footer',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
    readonly currentYear = new Date().getFullYear();

    readonly legalLinks: LegalLinkVm[] = [
        { label: 'O nas', path: '#' },
        { label: 'FAQ', path: '#' },
        { label: 'Kontakt', path: '#' },
        { label: 'Warunki korzystania', path: '/legal/terms' },
        { label: 'Wyłączenie odpowiedzialności', path: '#' },
        { label: 'Polityka prywatności', path: '/legal/privacy' },
        { label: 'Wydawca serwisu', path: '/legal/publisher' },
    ];
}
