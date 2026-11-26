import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MeApiService } from '../../../../../core/services/me-api.service';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import {
    ConfirmDialogComponent,
    type ConfirmDialogData,
    type ConfirmDialogResult,
} from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
    TextInputDialogComponent,
    type TextInputDialogData,
} from '../../../../../shared/components/text-input-dialog/text-input-dialog.component';
import { RecipesService } from '../../../services/recipes.service';
import type { RecipeUsageDto, RecipeVariantSummaryDto } from '../../../../../../../shared/contracts/types';

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
    private readonly dialog = inject(MatDialog);
    private readonly supabase = inject(SupabaseService);

    readonly enabled = signal(false);
    readonly loading = signal(true);
    readonly busy = signal(false);
    readonly variants = signal<RecipeVariantSummaryDto[]>([]);
    readonly error = signal<string | null>(null);
    readonly imageWarning = signal<string | null>(null);
    private latestRequestId = 0;

    readonly recipeId = input.required<number>();
    /** ID wariantu aktualnie edytowanego w formularzu powyżej. */
    readonly editingRecipeId = input.required<number>();
    /** Bieżąca wartość pola „Wariant” — synchronizacja z listą. */
    readonly editingVariantName = input<string>('');
    readonly variantsCountChange = output<number>();
    readonly variantsLoaded = output<RecipeVariantSummaryDto[]>();
    readonly editVariantRequest = output<RecipeVariantSummaryDto>();
    readonly aiVariantRequest = output<void>();

    private loadedVariantsForRecipeId: number | null = null;
    private pendingCreatedVariant: { recipe_id: number; variant_name: string } | null = null;

    constructor() {
        effect(() => {
            const editingId = this.editingRecipeId();
            if (!this.enabled() || editingId == null) {
                return;
            }
            if (this.loadedVariantsForRecipeId === editingId) {
                return;
            }
            this.loadedVariantsForRecipeId = editingId;
            this.loadVariants();
        });
    }

    ngOnInit(): void {
        this.refreshFeatureAndVariants();
    }

    displayVariantName(variant: RecipeVariantSummaryDto): string {
        if (variant.recipe_id !== this.editingRecipeId()) {
            return variant.variant_name;
        }
        const live = this.editingVariantName().trim();
        return live.length > 0 ? live : variant.variant_name;
    }

    isEditingVariant(variant: RecipeVariantSummaryDto): boolean {
        return variant.recipe_id === this.editingRecipeId();
    }

    /**
     * Publiczny URL miniatury. Pusta ścieżka zostaje placeholderem,
     * pełny http(s) bez zmian, ścieżka bucketa recipe-images przez getPublicUrl.
     */
    variantImageUrl(imagePath: string | null): string | null {
        const path = imagePath?.trim() ?? '';
        if (!path) {
            return null;
        }
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        const { data } = this.supabase.storage
            .from('recipe-images')
            .getPublicUrl(path);
        return data?.publicUrl || null;
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
                this.variantsCountChange.emit(variants.length);
                this.variantsLoaded.emit(variants);
                this.loadedVariantsForRecipeId = this.editingRecipeId();
                this.error.set(null);
                this.loading.set(false);
                this.completeCreatedVariantNavigation(variants);
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
        this.promptVariantName({
            title: 'Dodaj pusty wariant',
            label: 'Nazwa wariantu',
            confirmText: 'Dodaj',
        }, (name) => this.create({ variant_name: name }));
    }

    copyVariant(): void {
        const sourceId = this.editingRecipeId();
        const current = this.variants().find((v) => v.recipe_id === sourceId);
        const baseName = this.editingVariantName().trim() || current?.variant_name || 'Wariant';
        this.promptVariantName(
            {
                title: 'Utwórz kopię wariantu',
                label: 'Nazwa kopii',
                initialValue: `${baseName} (kopia)`,
                confirmText: 'Utwórz kopię',
            },
            (name) => this.create({ variant_name: name, source_recipe_id: sourceId }),
        );
    }

    addAiVariant(): void {
        if (this.loading() || this.busy() || this.variants().length >= 10) {
            this.error.set(
                this.variants().length >= 10
                    ? 'Osiągnięto maksymalną liczbę wariantów (10).'
                    : null,
            );
            return;
        }
        this.aiVariantRequest.emit();
    }

    editVariant(variant: RecipeVariantSummaryDto): void {
        if (variant.recipe_id === this.editingRecipeId()) {
            return;
        }
        this.editVariantRequest.emit(variant);
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
            next: (usage) => this.confirmRemoveVariant(variant, usage),
            error: (error: Error) => this.error.set(this.messageFor(error)),
        });
    }

    private confirmRemoveVariant(
        variant: RecipeVariantSummaryDto,
        usage: RecipeUsageDto,
    ): void {
        const data: ConfirmDialogData = {
            title: 'Usuń wariant',
            message: `„${variant.variant_name}” jest użyty w planie (${usage.plan}), kolekcjach (${usage.collections}) i na liście zakupów (${usage.shopping_list}). Usunąć ten wariant?`,
            confirmText: 'Usuń',
            cancelText: 'Anuluj',
            confirmColor: 'warn',
        };
        this.dialog
            .open<ConfirmDialogComponent, ConfirmDialogData, ConfirmDialogResult>(ConfirmDialogComponent, {
                width: '420px',
                data,
            })
            .afterClosed()
            .subscribe((confirmed) => {
                if (confirmed !== true) return;
                const remaining = this.variants().filter((item) => item.recipe_id !== variant.recipe_id);
                const nextVariant = variant.recipe_id === this.editingRecipeId()
                    ? remaining.find((item) => item.is_default) ?? remaining[0]
                    : undefined;
                this.mutate(this.recipes.deleteRecipeVariant(this.recipeId(), variant.recipe_id), () => {
                    if (nextVariant) {
                        this.editVariantRequest.emit(nextVariant);
                    }
                });
            });
    }

    private promptVariantName(data: TextInputDialogData, onConfirm: (name: string) => void): void {
        const dialogRef = this.dialog.open(TextInputDialogComponent, {
            data,
            width: '400px',
        });
        dialogRef.afterClosed().subscribe((name) => {
            if (!name?.trim()) {
                return;
            }
            onConfirm(name.trim());
        });
    }

    private create(command: { variant_name: string; source_recipe_id?: number }): void {
        this.mutate(
            this.recipes.createRecipeVariant(this.recipeId(), command),
            (result: { recipe_id: number; image_warning?: string | null }) => {
                this.imageWarning.set(result.image_warning ?? null);
                this.pendingCreatedVariant = {
                    recipe_id: result.recipe_id,
                    variant_name: command.variant_name,
                };
            },
        );
    }

    private completeCreatedVariantNavigation(variants: RecipeVariantSummaryDto[]): void {
        const pending = this.pendingCreatedVariant;
        if (!pending) {
            return;
        }
        this.pendingCreatedVariant = null;
        const created =
            variants.find((variant) => variant.recipe_id === pending.recipe_id) ??
            ({
                recipe_id: pending.recipe_id,
                variant_name: pending.variant_name,
                is_default: false,
                sort_order: variants.length,
                image_path: null,
                chips: {
                    diet_type: null,
                    difficulty: null,
                    servings: null,
                    is_termorobot: false,
                    is_grill: false,
                },
            } satisfies RecipeVariantSummaryDto);
        this.editVariantRequest.emit(created);
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
