import {
    PublicRecipeListItemDto,
    RecipeListItemDto,
} from '../../../../../shared/contracts/types';
import { RecipeCardData } from './recipe-card';

type RecipeListVariantData = Pick<
    RecipeListItemDto,
    | 'id'
    | 'name'
    | 'image_path'
    | 'category_name'
    | 'is_termorobot'
    | 'is_grill'
    | 'is_favorite'
    | 'variant_name'
    | 'active_variant_count'
    | 'matching_variant_count'
    | 'matching_variant_names'
    | 'matching_variant_overflow'
>;

type PublicVariantData = Pick<
    PublicRecipeListItemDto,
    | 'id'
    | 'name'
    | 'image_path'
    | 'is_termorobot'
    | 'is_grill'
    | 'is_favorite'
    | 'variant_name'
    | 'active_variant_count'
    | 'matching_variant_count'
    | 'matching_variant_names'
    | 'matching_variant_overflow'
>;

export function mapRecipeListItemToCardData(
    item: RecipeListVariantData,
    categoryName = item.category_name ?? null,
    variantFilterActive = false,
    savedVariantCount?: number
): RecipeCardData {
    return {
        id: item.id,
        name: item.name,
        imageUrl: item.image_path,
        categoryName,
        isTermorobot: item.is_termorobot ?? false,
        isGrill: item.is_grill ?? false,
        isFavorite: item.is_favorite ?? false,
        variantName: item.variant_name ?? null,
        activeVariantCount: item.active_variant_count,
        matchingVariantCount: item.matching_variant_count,
        matchingVariantNames: item.matching_variant_names,
        matchingVariantOverflow: item.matching_variant_overflow,
        variantFilterActive,
        savedVariantCount,
    };
}

export function mapPublicRecipeToCardData(
    item: PublicVariantData,
    categoryName: string | null,
    variantFilterActive: boolean
): RecipeCardData {
    return mapRecipeListItemToCardData(
        {
            ...item,
            category_name: categoryName,
        },
        categoryName,
        variantFilterActive
    );
}
