import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { MeApiService } from '../../../../../core/services/me-api.service';
import { RecipesService } from '../../../services/recipes.service';
import type { RecipeVariantSummaryDto, RecipeVisibility } from '../../../../../../../shared/contracts/types';

@Component({
    selector: 'pych-recipe-variants-section',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressSpinnerModule],
    templateUrl: './recipe-variants-section.component.html',
    styleUrl: './recipe-variants-section.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeVariantsSectionComponent implements OnInit {
    private readonly meApi = inject(MeApiService);
    private readonly recipes = inject(RecipesService);
    private readonly router = inject(Router);

    readonly enabled = signal(false);
    readonly loading = signal(true);
    readonly busy = signal(false);
    readonly variants = signal<RecipeVariantSummaryDto[]>([]);
    readonly error = signal<string | null>(null);
    readonly imageWarning = signal<string | null>(null);
    private latestRequestId = 0;

    readonly recipeId = input.required<number>();

    ngOnInit(): void {
        this.refreshFeatureAndVariants();
    }

    refreshFeatureAndVariants(): void {
        this.loading.set(true);
        this.meApi.getMe().subscribe({
            next: (me) => {
                this.enabled.set(me.features.recipe_variants.enabled);
                if (!me.features.recipe_variants.enabled) {
                    this.loading.set(false);
                    return;
                }
                this.loadVariants();
            },
            error: () => this.loading.set(false),
        });
    }

    loadVariants(): void {
        const requestId = ++this.latestRequestId;
        this.recipes.getRecipeVariants(this.recipeId()).subscribe({
            next: (variants) => {
                if (requestId !== this.latestRequestId) return;
                this.variants.set(variants);
                this.error.set(null);
                this.loading.set(false);
            },
            error: (error: Error & { status?: number }) => {
                if (requestId !== this.latestRequestId) return;
                this.error.set(error.status === 404 ? null : this.messageFor(error));
                this.enabled.set(error.status !== 404 && this.enabled());
                this.loading.set(false);
            },
        });
    }

    addEmpty(): void {
        const name = window.prompt('Nazwa nowego wariantu');
        if (!name?.trim()) return;
        this.create({ variant_name: name.trim() });
    }

    copyVariant(): void {
        const source = window.prompt('ID wariantu źródłowego');
        const name = window.prompt('Nazwa kopii');
        const sourceId = Number(source);
        if (!name?.trim() || !Number.isInteger(sourceId)) return;
        this.create({ variant_name: name.trim(), source_recipe_id: sourceId });
    }

    renameFamily(): void {
        const name = window.prompt('Nowa nazwa grupy (zmieni wszystkie warianty)');
        if (!name?.trim()) return;
        this.mutate(this.recipes.updateRecipeFamily(this.recipeId(), { name: name.trim() }));
    }

    changeVisibility(): void {
        const visibility = window.prompt('Widoczność grupy: PRIVATE, PUBLIC lub SHARED')?.trim().toUpperCase();
        if (!visibility || !['PRIVATE', 'PUBLIC', 'SHARED'].includes(visibility)) return;
        this.mutate(this.recipes.updateRecipeFamily(this.recipeId(), { visibility: visibility as RecipeVisibility }));
    }

    editVariant(variant: RecipeVariantSummaryDto): void {
        void this.router.navigate(['/recipes', `${variant.recipe_id}/edit`]);
    }

    setDefault(variant: RecipeVariantSummaryDto): void {
        if (variant.is_default || !window.confirm(`Ustawić „${variant.variant_name}” jako domyślny wariant?`)) return;
        this.mutate(this.recipes.setDefaultVariant(variant.recipe_id));
    }

    move(variant: RecipeVariantSummaryDto, direction: -1 | 1): void {
        const current = [...this.variants()];
        const index = current.findIndex((item) => item.recipe_id === variant.recipe_id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= current.length) return;
        [current[index], current[target]] = [current[target], current[index]];
        this.mutate(this.recipes.reorderRecipeVariants(this.recipeId(), {
            recipe_ids: current.map((item) => item.recipe_id),
        }));
    }

    removeVariant(variant: RecipeVariantSummaryDto): void {
        if (this.variants().length < 2) return;
        this.recipes.getRecipeUsage(variant.recipe_id).subscribe({
            next: (usage) => {
                const warning = `Plan: ${usage.plan}, kolekcje: ${usage.collections}, lista zakupów: ${usage.shopping_list}. Usunąć wariant?`;
                if (window.confirm(warning)) this.mutate(this.recipes.deleteRecipeVariant(this.recipeId(), variant.recipe_id));
            },
            error: (error: Error) => this.error.set(this.messageFor(error)),
        });
    }

    removeFamily(): void {
        if (!window.confirm('Usunąć całą grupę wariantów? Tej operacji nie można cofnąć.')) return;
        this.mutate(this.recipes.deleteRecipeFamily(this.recipeId()), () => {
            void this.router.navigate(['/my-recipies']);
        });
    }

    private create(command: { variant_name: string; source_recipe_id?: number }): void {
        this.mutate(this.recipes.createRecipeVariant(this.recipeId(), command), (result) => {
            this.imageWarning.set(result.image_warning ?? null);
        });
    }

    private mutate<T>(request: import('rxjs').Observable<T>, after?: (result: T) => void): void {
        this.busy.set(true);
        request.subscribe({
            next: (result) => {
                after?.(result);
                this.loadVariants();
                this.busy.set(false);
            },
            error: (error: Error) => {
                this.error.set(this.messageFor(error));
                this.busy.set(false);
            },
        });
    }

    private messageFor(error: Error & { status?: number }): string {
        if (error.status === 409) return error.message || 'Operacja odrzucona przez reguły wariantów.';
        if (error.status === 404) return 'Wariant nie istnieje lub nie należy do Ciebie.';
        return error.message || 'Nie udało się wykonać operacji wariantu.';
    }
}
