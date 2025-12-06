import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'pych-recipe-image-upload',
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
    templateUrl: './recipe-image-upload.component.html',
    styleUrl: './recipe-image-upload.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeImageUploadComponent {
    @Input() currentImageUrl: string | null = null;
    @Output() imageChange = new EventEmitter<File | null>();

    readonly previewUrl = signal<string | null>(null);
    readonly fileName = signal<string | null>(null);
    readonly error = signal<string | null>(null);

    private readonly acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    private readonly maxSizeBytes = 5 * 1024 * 1024; // 5MB

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) {
            return;
        }

        this.error.set(null);

        // Validate file type
        if (!this.acceptedTypes.includes(file.type)) {
            this.error.set('Dozwolone formaty: JPG, PNG, WebP');
            input.value = '';
            return;
        }

        // Validate file size
        if (file.size > this.maxSizeBytes) {
            this.error.set('Maksymalny rozmiar pliku to 5MB');
            input.value = '';
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = () => {
            this.previewUrl.set(reader.result as string);
        };
        reader.readAsDataURL(file);

        this.fileName.set(file.name);
        this.imageChange.emit(file);
    }

    removeImage(): void {
        this.previewUrl.set(null);
        this.fileName.set(null);
        this.error.set(null);
        this.imageChange.emit(null);
    }

    get displayImageUrl(): string | null {
        return this.previewUrl() || this.currentImageUrl;
    }

    get hasImage(): boolean {
        return !!(this.previewUrl() || this.currentImageUrl);
    }
}

