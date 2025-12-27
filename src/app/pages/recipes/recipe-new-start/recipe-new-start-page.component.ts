import {
    ChangeDetectionStrategy,
    Component,
    inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { RecipeDraftStateService } from '../services/recipe-draft-state.service';

/**
 * View model for recipe creation mode option
 */
interface RecipeNewStartOptionVm {
    title: string;
    description: string;
    route: string;
    icon: string;
}

/**
 * Recipe creation wizard - Start page component.
 * Allows user to choose between:
 * - Empty form (manual recipe creation)
 * - AI-assisted creation (from text or image)
 */
@Component({
    selector: 'pych-recipe-new-start-page',
    standalone: true,
    imports: [
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        PageHeaderComponent,
    ],
    templateUrl: './recipe-new-start-page.component.html',
    styleUrl: './recipe-new-start-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeNewStartPageComponent {
    private readonly router = inject(Router);
    private readonly location = inject(Location);
    private readonly draftStateService = inject(RecipeDraftStateService);

    /** Available recipe creation options */
    readonly options: RecipeNewStartOptionVm[] = [
        {
            title: 'Pusty formularz',
            description: 'Rozpocznij od zera i wprowadź wszystkie dane ręcznie',
            route: '/recipes/new',
            icon: 'edit_note',
        },
        {
            title: 'Z tekstu lub zdjęcia (AI)',
            description: 'Wklej tekst przepisu lub zdjęcie, a AI pomoże Ci go zaimportować',
            route: '/recipes/new/assist',
            icon: 'auto_awesome',
        },
    ];

    /**
     * Navigate to selected option route.
     * For empty form, clears any existing draft.
     */
    selectOption(option: RecipeNewStartOptionVm): void {
        // Clear draft when choosing empty form to ensure clean state
        if (option.route === '/recipes/new') {
            this.draftStateService.clearDraft();
        }

        // Navigate to selected route
        this.router.navigate([option.route]);
    }

    /**
     * Handle cancel action - go back to previous page
     */
    onCancel(): void {
        this.location.back();
    }
}

