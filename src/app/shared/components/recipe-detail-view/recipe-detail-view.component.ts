import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
} from '@angular/core';
import {
    ApiError,
    RecipeDetailDto,
} from '../../../../../shared/contracts/types';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { RecipeHeaderComponent } from '../../../pages/recipes/recipe-detail/components/recipe-header/recipe-header.component';
import { RecipeImageComponent } from '../../../pages/recipes/recipe-detail/components/recipe-image/recipe-image.component';
import { RecipeContentListComponent } from '../../../pages/recipes/recipe-detail/components/recipe-content-list/recipe-content-list.component';

export type RecipeDetailHeaderMode = 'guest' | 'addToCollection' | 'ownerActions';

@Component({
    selector: 'pych-recipe-detail-view',
    standalone: true,
    imports: [
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        PageHeaderComponent,
        RecipeHeaderComponent,
        RecipeImageComponent,
        RecipeContentListComponent,
    ],
    templateUrl: './recipe-detail-view.component.html',
    styleUrl: './recipe-detail-view.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDetailViewComponent {
    readonly recipe = input.required<RecipeDetailDto | null>();
    readonly isLoading = input.required<boolean>();
    readonly error = input.required<ApiError | null>();
    readonly isAuthenticated = input.required<boolean>();
    readonly isOwner = input.required<boolean>();
    readonly headerMode = input.required<RecipeDetailHeaderMode>();
    readonly pageTitle = input.required<string>();
    readonly isPublicView = input<boolean>(false);
    readonly showPageHeader = input<boolean>(true);
    readonly showGuestCta = input<boolean>(false);
    readonly showAuthCtaOnError = input<boolean>(false);
    readonly backLabel = input<string>('Wróć');

    readonly addToCollection = output<void>();
    readonly edit = output<void>();
    readonly delete = output<void>();
    readonly back = output<void>();
    readonly login = output<void>();
    readonly register = output<void>();

    readonly hasRecipe = computed(() => this.recipe() !== null);

    onAddToCollection(): void {
        this.addToCollection.emit();
    }

    onEdit(): void {
        this.edit.emit();
    }

    onDelete(): void {
        this.delete.emit();
    }

    onBack(): void {
        this.back.emit();
    }

    onLogin(): void {
        this.login.emit();
    }

    onRegister(): void {
        this.register.emit();
    }
}

