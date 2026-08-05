import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
    selector: 'pych-oauth-google-button',
    standalone: true,
    imports: [MatButtonModule, MatProgressSpinnerModule],
    templateUrl: './oauth-google-button.component.html',
    styleUrl: './oauth-google-button.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OauthGoogleButtonComponent {
    @Input({ required: true }) public label = '';
    @Input() public isLoading = false;
    @Input() public ariaLabel?: string;

    @Output() public clicked = new EventEmitter<void>();

    public handleClick(): void {
        if (this.isLoading) {
            return;
        }

        this.clicked.emit();
    }
}
