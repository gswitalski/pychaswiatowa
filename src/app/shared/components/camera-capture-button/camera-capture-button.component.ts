import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    input,
    output,
    viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'pych-camera-capture-button',
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
    templateUrl: './camera-capture-button.component.html',
    styleUrl: './camera-capture-button.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CameraCaptureButtonComponent {
    readonly disabled = input(false);
    readonly buttonClass = input('');

    readonly fileSelected = output<File>();

    private readonly cameraInput =
        viewChild.required<ElementRef<HTMLInputElement>>('cameraInput');

    public onButtonClick(event: MouseEvent): void {
        event.stopPropagation();
        if (this.disabled()) {
            return;
        }
        this.cameraInput().nativeElement.click();
    }

    public onInputChange(event: Event): void {
        const inputEl = event.target as HTMLInputElement;
        const file = inputEl.files?.[0];
        inputEl.value = '';
        if (!file) {
            return;
        }
        this.fileSelected.emit(file);
    }
}
