/**
 * Backend grouping for recipe list candidates.
 *
 * The function is deliberately independent from Supabase so list endpoints can
 * apply their own visibility and filter predicates before grouping.
 */

export interface RecipeListCandidate {
    id: number;
    name: string;
    recipe_family_id: string | null;
    variant_name: string | null;
    is_default: boolean;
    sort_order: number;
    created_at: string;
    matches: boolean;
    relevance_score?: number;
}

export interface GroupedRecipeListItem {
    representative: RecipeListCandidate;
    family_id: string;
    active_variant_count: number;
    matching_variant_count: number;
    matching_variant_names: string[];
    matching_variant_overflow: number;
}

const TECHNICAL_VARIANT_NAMES = new Set(['wariant podstawowy', 'podstawowa']);

export function isTechnicalVariantName(value: string | null): boolean {
    return value !== null && TECHNICAL_VARIANT_NAMES.has(value.trim().toLocaleLowerCase('pl-PL'));
}

/**
 * Returns the display text used by list/search matching.
 * Technical default names must not make a group match by themselves.
 */
export function getRecipeVariantSearchText(candidate: Pick<RecipeListCandidate, 'name' | 'variant_name'>): string {
    const variantName = candidate.variant_name?.trim();
    if (!variantName || isTechnicalVariantName(variantName)) {
        return candidate.name;
    }
    return `${candidate.name} ${variantName}`;
}

function compareCandidates(left: RecipeListCandidate, right: RecipeListCandidate): number {
    if (left.is_default !== right.is_default) {
        return left.is_default ? -1 : 1;
    }
    if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
    }
    return left.id - right.id;
}

/**
 * Groups only candidates visible to the caller. A group is returned when at
 * least one candidate matches all endpoint filters.
 */
export function groupRecipeListCandidates(candidates: RecipeListCandidate[]): GroupedRecipeListItem[] {
    const groups = new Map<string, RecipeListCandidate[]>();

    for (const candidate of candidates) {
        if (!candidate.recipe_family_id) {
            const key = `recipe:${candidate.id}`;
            groups.set(key, [...(groups.get(key) ?? []), candidate]);
            continue;
        }
        groups.set(candidate.recipe_family_id, [...(groups.get(candidate.recipe_family_id) ?? []), candidate]);
    }

    return [...groups.entries()]
        .map(([familyId, rows]) => {
            const matching = rows.filter((row) => row.matches);
            if (matching.length === 0) {
                return null;
            }

            const orderedMatching = [...matching].sort((left, right) => {
                const leftRelevance = left.relevance_score ?? 0;
                const rightRelevance = right.relevance_score ?? 0;
                if (leftRelevance !== rightRelevance) {
                    return rightRelevance - leftRelevance;
                }
                return compareCandidates(left, right);
            });
            const representative = orderedMatching[0];
            const names = matching
                .map((row) => row.variant_name?.trim())
                .filter((name): name is string => Boolean(name))
                .slice(0, 3);

            return {
                representative,
                family_id: familyId,
                active_variant_count: rows.length,
                matching_variant_count: matching.length,
                matching_variant_names: names,
                matching_variant_overflow: Math.max(0, matching.length - names.length),
            };
        })
        .filter((group): group is GroupedRecipeListItem => group !== null);
}
