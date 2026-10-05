import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';

@Component({
    selector: 'pych-checkout-consents',
    standalone: true,
    imports: [MatCheckboxModule],
    templateUrl: './checkout-consents.component.html',
    styleUrl: './checkout-consents.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutConsentsComponent {
    readonly acceptedTerms = model.required<boolean>();
    readonly acceptedDigitalWaiver = model.required<boolean>();
    readonly highlightMissing = input(false);
    readonly disabled = input(false);

    protected updateTerms(event: MatCheckboxChange): void {
        this.acceptedTerms.set(event.checked);
    }

    protected updateDigitalWaiver(event: MatCheckboxChange): void {
        this.acceptedDigitalWaiver.set(event.checked);
    }
}
