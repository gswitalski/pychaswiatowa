import {
    CollectionListItemDto,
    CollectionRecipesPageInfoDto,
    RecipeSidebarListItemDto,
} from '../../../../../../../shared/contracts/types';

export type SidebarCollectionRecipesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SidebarCollectionRecipesState {
    status: SidebarCollectionRecipesStatus;
    items: RecipeSidebarListItemDto[];
    errorMessage: string | null;
    pageInfo: CollectionRecipesPageInfoDto | null;
}

export interface SidebarCollectionsTreeState {
    isCollectionsExpanded: boolean;
    collections: CollectionListItemDto[];
    collectionsLoading: boolean;
    collectionsError: string | null;
    expandedCollectionIds: Set<number>;
    recipesByCollectionId: Map<number, SidebarCollectionRecipesState>;
}
