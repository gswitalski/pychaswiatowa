import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ProfileDto } from '../../../../../../shared/contracts/types';

@Component({
    selector: 'pych-welcome-header',
    standalone: true,
    imports: [],
    templateUrl: './welcome-header.component.html',
    styleUrl: './welcome-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeHeaderComponent {
    @Input() profile: ProfileDto | null = null;

    get greeting(): string {
        if (this.profile?.username) {
            return `Witaj, ${this.profile.username}!`;
        }
        return 'Witaj!';
    }
}

