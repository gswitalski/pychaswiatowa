import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { take } from 'rxjs';
import {
    ApiError,
    RecipeDetailDto,
    RecipeFlagsDto,
    RecipeNoteResponseDto,
    RecipeRatingDto,
} from '../../../../../shared/contracts/types';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { RecipeHeaderComponent } from '../../../pages/recipes/recipe-detail/components/recipe-header/recipe-header.component';
import { RecipeImageComponent } from '../../../pages/recipes/recipe-detail/components/recipe-image/recipe-image.component';
import { RecipeContentListComponent } from '../../../pages/recipes/recipe-detail/components/recipe-content-list/recipe-content-list.component';
import { RecipeFlagTogglesComponent } from '../recipe-flag-toggles/recipe-flag-toggles.component';
import { RecipeRatingComponent } from '../recipe-rating/recipe-rating.component';
import { RecipeNoteComponent } from '../recipe-note/recipe-note.component';

export type RecipeDetailHeaderMode = 'guest' | 'addToCollection' | 'ownerActions';

@Component({
    selector: 'pych-recipe-detail-view',
    standalone: true,
    imports: [
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatFormFieldModule,
        MatTooltipModule,
        PageHeaderComponent,
        RecipeHeaderComponent,
        RecipeImageComponent,
        RecipeContentListComponent,
        RecipeFlagTogglesComponent,
        RecipeRatingComponent,
        RecipeNoteComponent,
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
    readonly isAddingToPlan = input<boolean>(false);
    readonly variantSelected = output<number>();
    readonly dismissVariantResolution = output<void>();
    private readonly pendingVariant = signal<number | null>(null);
    private readonly noteComponent = viewChild(RecipeNoteComponent);

    readonly addToCollection = output<void>();
    readonly edit = output<void>();
    readonly delete = output<void>();
    readonly back = output<void>();
    readonly login = output<void>();
    readonly register = output<void>();
    readonly addToPlan = output<void>();
    readonly openPlan = output<void>();
    readonly flagsChange = output<RecipeFlagsDto>();
    readonly flagsSessionExpired = output<void>();
    readonly ratingChange = output<RecipeRatingDto>();
    readonly ratingSessionExpired = output<void>();
    readonly noteChange = output<RecipeNoteResponseDto>();
    readonly noteSessionExpired = output<void>();

    readonly hasRecipe = computed(() => this.recipe() !== null);
    protected readonly showRating = computed(() => {
        const recipe = this.recipe();

        if (recipe === null || recipe.id === null) {
            return false;
        }

        if (recipe.visibility !== 'PUBLIC') {
            return false;
        }

        return recipe.ratings_count !== null && recipe.ratings_count !== undefined;
    });
    protected readonly showNote = computed(() => {
        const recipe = this.recipe();
        if (!this.isAuthenticated() || recipe === null || recipe.id === null) {
            return false;
        }
        return recipe.my_note !== undefined;
    });
    protected readonly variants = computed(() => this.recipe()?.variants ?? []);
    protected readonly hasVariantSwitcher = computed(() => this.variants().length > 1);
    protected readonly activeVariant = computed(() => {
        const recipe = this.recipe();
        return this.variants().find((variant) => variant.recipe_id === recipe?.id) ?? null;
    });
    protected readonly variantLabel = computed(() => this.activeVariant()?.variant_name ?? '');
    protected readonly showPersonalVariantState = computed(
        () => this.isAuthenticated() && this.variants().some((variant) => variant.user_action_state)
    );

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

    onAddToPlan(): void {
        this.addToPlan.emit();
    }

    onOpenPlan(): void {
        this.openPlan.emit();
    }

    protected selectVariant(variantId: number): void {
        if (
            this.pendingVariant() !== null ||
            variantId === this.recipe()?.id ||
            !this.hasVariantSwitcher()
        ) {
            return;
        }

        this.pendingVariant.set(variantId);
        const noteComponent = this.noteComponent();
        if (!noteComponent) {
            this.pendingVariant.set(null);
            this.variantSelected.emit(variantId);
            return;
        }
        noteComponent.prepareForVariantChange().pipe(take(1)).subscribe((decision) => {
            this.pendingVariant.set(null);
            if (decision === 'proceed') {
                this.variantSelected.emit(variantId);
            }
        });
    }
}

