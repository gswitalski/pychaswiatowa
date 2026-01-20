import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
    inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Formularz dodawania ręcznej pozycji do listy zakupów.
 * Implementacja jako Reactive Forms z walidacją.
 */
@Component({
    selector: 'pych-shopping-add-item-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
    ],
    templateUrl: './shopping-add-item-form.component.html',
    styleUrl: './shopping-add-item-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingAddItemFormComponent {
    /** Czy trwa wysyłanie formularza */
    isSubmitting = input<boolean>(false);

    /** Event emitowany po kliknięciu "Dodaj" */
    add = output<string>();

    /** Kontrolka formularza */
    readonly textControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required],
    });

    /**
     * Obsługuje submit formularza
     */
    onSubmit(): void {
        // Walidacja
        const text = this.textControl.value.trim();
        if (!text) {
            this.textControl.setErrors({ required: true });
            return;
        }

        // Emit eventu
        this.add.emit(text);

        // Wyczyść pole po sukcesie
        this.textControl.reset();
    }

    /**
     * Czy przycisk powinien być disabled
     */
    get isButtonDisabled(): boolean {
        return this.isSubmitting() || !this.textControl.value.trim();
    }
}
