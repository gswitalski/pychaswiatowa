import {
    ChangeDetectionStrategy,
    Component,
    Input,
    inject,
    signal,
} from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import {
    CdkDragDrop,
    DragDropModule,
    moveItemInArray,
} from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
    selector: 'pych-editable-list',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        DragDropModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
    ],
    templateUrl: './editable-list.component.html',
    styleUrl: './editable-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditableListComponent {
    private readonly fb = inject(FormBuilder);

    @Input({ required: true }) formArray!: FormArray<FormControl<string>>;
    @Input() label = 'Element';
    @Input() placeholder = 'Dodaj nowy element';

    /** Input control for new items */
    readonly newItemControl = this.fb.control('', { nonNullable: true });

    /** Index of currently edited item (-1 if none) */
    readonly editingIndex = signal<number>(-1);

    /** Temporary value during editing */
    readonly editValue = signal<string>('');

    addItem(): void {
        const value = this.newItemControl.value.trim();

        if (value) {
            this.formArray.push(this.fb.control(value, { nonNullable: true }));
            this.newItemControl.reset();
        }
    }

    removeItem(index: number): void {
        this.formArray.removeAt(index);

        // Cancel editing if we removed the item being edited
        if (this.editingIndex() === index) {
            this.cancelEdit();
        } else if (this.editingIndex() > index) {
            // Adjust editing index if it was after the removed item
            this.editingIndex.update((i) => i - 1);
        }
    }

    startEdit(index: number): void {
        this.editingIndex.set(index);
        this.editValue.set(this.formArray.at(index).value);
    }

    saveEdit(index: number): void {
        const value = this.editValue().trim();

        if (value) {
            this.formArray.at(index).setValue(value);
        }

        this.cancelEdit();
    }

    cancelEdit(): void {
        this.editingIndex.set(-1);
        this.editValue.set('');
    }

    onEditValueChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.editValue.set(input.value);
    }

    onEditKeydown(event: KeyboardEvent, index: number): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.saveEdit(index);
        } else if (event.key === 'Escape') {
            this.cancelEdit();
        }
    }

    onNewItemKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.addItem();
        }
    }

    drop(event: CdkDragDrop<string[]>): void {
        if (event.previousIndex === event.currentIndex) {
            return;
        }

        // Get current values
        const values = this.formArray.controls.map((c) => c.value);

        // Reorder
        moveItemInArray(values, event.previousIndex, event.currentIndex);

        // Update form array
        this.formArray.clear();
        values.forEach((value) => {
            this.formArray.push(this.fb.control(value, { nonNullable: true }));
        });

        // Adjust editing index if needed
        if (this.editingIndex() >= 0) {
            if (this.editingIndex() === event.previousIndex) {
                this.editingIndex.set(event.currentIndex);
            } else if (
                event.previousIndex < this.editingIndex() &&
                event.currentIndex >= this.editingIndex()
            ) {
                this.editingIndex.update((i) => i - 1);
            } else if (
                event.previousIndex > this.editingIndex() &&
                event.currentIndex <= this.editingIndex()
            ) {
                this.editingIndex.update((i) => i + 1);
            }
        }
    }

    isHeader(value: string): boolean {
        return value.startsWith('#');
    }

    getDisplayValue(value: string): string {
        if (this.isHeader(value)) {
            return value.substring(1).trim();
        }
        return value;
    }
}

