import { ChangeDetectionStrategy, Component, computed, input, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../../../../core/services/supabase.service';

@Component({
    selector: 'pych-recipe-image',
    standalone: true,
    imports: [MatIconModule],
    templateUrl: './recipe-image.component.html',
    styleUrl: './recipe-image.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeImageComponent {
    private readonly supabase = inject(SupabaseService);

    readonly imageUrl = input<string | null>(null);
    readonly recipeName = input<string>('');

    /**
     * Computed property that returns full public URL for the image
     * If imageUrl is already a full URL (starts with http), return as is
     * Otherwise, construct public URL using Supabase storage
     */
    readonly fullImageUrl = computed(() => {
        const url = this.imageUrl();

        if (!url) {
            return null;
        }

        // If already a full URL, return as is
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // Otherwise, construct public URL from storage path
        const { data } = this.supabase.storage
            .from('recipe-images')
            .getPublicUrl(url);

        return data?.publicUrl || null;
    });
}

