import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { requireAdminContext } from './admin-auth.ts';
import { getAdminRecipes } from './admin-recipes.service.ts';
import { validateAdminRecipesQuery } from './admin-recipes.types.ts';

export interface AdminRecipesHandlerDeps {
    requireAdmin: (req: Request) => Promise<{ userId: string }>;
    getRecipes: typeof getAdminRecipes;
}

const defaultDeps: AdminRecipesHandlerDeps = {
    requireAdmin: requireAdminContext,
    getRecipes: getAdminRecipes,
};

function createSuccessResponse<T>(data: T): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function handleGetAdminRecipes(
    req: Request,
    deps: AdminRecipesHandlerDeps = defaultDeps,
): Promise<Response> {
    try {
        const { userId } = await deps.requireAdmin(req);
        const query = validateAdminRecipesQuery(new URL(req.url).searchParams);
        const response = await deps.getRecipes({ query });
        logger.info('[admin] GET /admin/recipes completed', {
            userId,
            query,
            totalItems: response.pagination.totalItems,
        });
        return createSuccessResponse(response);
    } catch (error) {
        return handleError(error);
    }
}
