import { assert, assertEquals } from "jsr:@std/assert@1";
import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateLocalDbGuard } from "./admin-recipes.rpc-guard.ts";

const url = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const guard = evaluateLocalDbGuard(url, serviceRoleKey);
const localOrigin = guard.origin;
let reachable = false;
const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
const prefix = `ps204t-${runId}-`;
type RpcRecipeRow = {
    id: number | null;
    name: string | null;
    author_username: string | null;
    category_name: string | null;
    average_rating: number | null;
    ratings_count: number;
    total_items: number;
};

function assertLocal(): void {
    const current = evaluateLocalDbGuard(
        Deno.env.get("SUPABASE_URL"),
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );
    assert(current.allowed && current.origin === localOrigin, current.reason);
}

if (guard.allowed && localOrigin && serviceRoleKey) {
    try {
        const response = await fetch(new URL("/rest/v1/", localOrigin), {
            headers: { apikey: serviceRoleKey },
            signal: AbortSignal.timeout(2000),
        });
        reachable = response.status === 200 || response.status === 401;
        await response.body?.cancel();
    } catch (error) {
        console.warn(
            `[PS-204] pominięto test RPC: lokalna baza niedostępna (${error})`,
        );
    }
} else {
    console.warn(`[PS-204] pominięto test RPC: ${guard.reason}`);
}

Deno.test({
    name: "local admin recipes RPC returns sentinel",
    ignore: !guard.allowed || !reachable,
    sanitizeOps: false,
    sanitizeResources: false,
    async fn() {
        if (!localOrigin || !serviceRoleKey) {
            throw new Error("Local Supabase credentials are required");
        }
        const serviceClient = createClient(localOrigin, serviceRoleKey);
        const createdUserIds: string[] = [];
        const testEmails: string[] = [];
        const testPasswords: string[] = [];
        let recipeIds: number[] = [];
        let originalTargetRole = "user";
        try {
            assertLocal();
            const leftovers = await serviceClient.auth.admin.listUsers({
                page: 1,
                perPage: 1000,
            });
            assertEquals(leftovers.error, null);
            for (
                const leftover of leftovers.data.users.filter((user) =>
                    user.email?.endsWith("@ps204-test.invalid")
                )
            ) {
                assertLocal();
                const cleanup = await serviceClient.from("recipes").delete().eq(
                    "user_id",
                    leftover.id,
                );
                if (cleanup.error) {
                    console.warn(
                        `[PS-204] Nie udało się posprzątać pozostałych przepisów: ${cleanup.error.message}`,
                    );
                }
                const deleted = await serviceClient.auth.admin.deleteUser(
                    leftover.id,
                );
                if (deleted.error) {
                    console.warn(
                        `[PS-204] Nie udało się posprzątać pozostałego użytkownika: ${deleted.error.message}`,
                    );
                }
            }
            for (
                const [index, username] of [`${prefix}ala`, `${prefix}lukasz`]
                    .entries()
            ) {
                assertLocal();
                const email = `${prefix}${index}@ps204-test.invalid`;
                const password = `PS204-${crypto.randomUUID()}-aA1!`;
                const created = await serviceClient.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: {
                        username,
                        marketing_consent_accepted: false,
                    },
                });
                assertEquals(created.error, null);
                assert(created.data.user?.id);
                createdUserIds.push(created.data.user.id);
                testEmails.push(email);
                testPasswords.push(password);
            }
            assertLocal();
            const names = [
                "Czosnek",
                "ćma",
                "lody",
                "Łosoś",
                "sałatka",
                "Śledź",
                "zupa",
                "Żurek",
                "Czosnek",
            ];
            const categories = await serviceClient.from("categories").select(
                "id",
            ).limit(1);
            assertEquals(categories.error, null);
            const categoryId = categories.data?.[0]?.id ?? null;
            const recipes = names.map((name, index) => ({
                user_id: createdUserIds[index % createdUserIds.length],
                name: `${prefix}${name}`,
                ingredients: [{ type: "item", content: "x" }],
                steps: [{ type: "item", content: "x" }],
                category_id: index === 0 ? categoryId : null,
                visibility: "PUBLIC",
            }));
            assertLocal();
            const inserted = await serviceClient.from("recipes").insert(recipes)
                .select("id");
            assertEquals(inserted.error, null);
            recipeIds = (inserted.data ?? []).map((row) => row.id);
            assertEquals(recipeIds.length, names.length);
            assertLocal();
            await serviceClient.from("recipes").update({
                created_at: "2026-01-01T00:00:00Z",
            }).in("id", recipeIds);
            assertLocal();
            await serviceClient.from("profiles").update({ username: null }).eq(
                "id",
                createdUserIds[1],
            );
            assertLocal();
            const rating = await serviceClient.from("recipe_ratings").insert({
                user_id: createdUserIds[0],
                recipe_id: recipeIds[1],
                rating: 5,
            });
            assertEquals(rating.error, null);
            assertLocal();
            const hidden = await serviceClient.from("recipes").insert({
                user_id: createdUserIds[0],
                name: `${prefix}private`,
                ingredients: [{ type: "item", content: "x" }],
                steps: [{ type: "item", content: "x" }],
                visibility: "PRIVATE",
            }).select("id").single();
            assertEquals(hidden.error, null);
            assert(hidden.data?.id);
            recipeIds.push(hidden.data.id);

            assertLocal();
            const fetchAll = async (sortBy: string, sortDir: string) => {
                const all: RpcRecipeRow[] = [];
                let totalItems = 0;
                for (let page = 1; page <= 200; page += 1) {
                    assertLocal();
                    const result = await serviceClient.rpc(
                        "admin_get_recipes_page",
                        {
                            p_page_number: page,
                            p_page_size: 100,
                            p_sort_by: sortBy,
                            p_sort_dir: sortDir,
                        },
                    );
                    assertEquals(result.error, null);
                    totalItems = Number(
                        result.data?.[0]?.total_items ?? totalItems,
                    );
                    all.push(
                        ...(result.data ?? []).filter((row: RpcRecipeRow) =>
                            row.name?.startsWith(prefix)
                        ),
                    );
                    if (page >= Math.max(1, Math.ceil(totalItems / 100))) {
                        break;
                    }
                }
                return { all, totalItems };
            };
            const nameAsc = await fetchAll("name", "asc");
            const nameDesc = await fetchAll("name", "desc");
            assertEquals(nameAsc.totalItems >= names.length, true);
            assertEquals(nameAsc.all.length, names.length);
            assertEquals(nameAsc.all.slice(0, 2).map((row) => row.name), [
                `${prefix}Czosnek`,
                `${prefix}Czosnek`,
            ]);
            const firstTieId = nameAsc.all[0].id;
            const secondTieId = nameAsc.all[1].id;
            assert(firstTieId !== null && secondTieId !== null);
            assertEquals(firstTieId < secondTieId, true);
            assertEquals(nameDesc.all.length, names.length);
            assertEquals(nameDesc.all[0].name, `${prefix}Żurek`);

            const averageAsc = await fetchAll("average_rating", "asc");
            const averageDesc = await fetchAll("average_rating", "desc");
            assertEquals(averageAsc.all.at(-1)?.average_rating, null);
            assertEquals(averageDesc.all.at(-1)?.average_rating, null);
            assertEquals(
                averageAsc.all.some((row) => row.ratings_count === 1),
                true,
            );
            assertEquals(
                typeof averageAsc.all.find((row) => row.ratings_count === 1)
                    ?.ratings_count,
                "number",
            );

            const authorAsc = await fetchAll("author", "asc");
            const authorDesc = await fetchAll("author", "desc");
            assertEquals(authorAsc.all.at(-1)?.author_username, null);
            assertEquals(authorDesc.all.at(-1)?.author_username, null);
            const categoryAsc = await fetchAll("category", "asc");
            const categoryDesc = await fetchAll("category", "desc");
            assertEquals(categoryAsc.all.at(-1)?.category_name, null);
            assertEquals(categoryDesc.all.at(-1)?.category_name, null);
            for (const sortBy of ["created_at", "ratings_count"]) {
                assertEquals(
                    (await fetchAll(sortBy, "asc")).all.length,
                    names.length,
                );
                assertEquals(
                    (await fetchAll(sortBy, "desc")).all.length,
                    names.length,
                );
            }

            assertLocal();
            const outOfRange = await serviceClient.rpc(
                "admin_get_recipes_page",
                {
                    p_page_number: 3000000000,
                    p_page_size: 100,
                    p_sort_by: "created_at",
                    p_sort_dir: "desc",
                },
            );
            assertEquals(outOfRange.error, null);
            assertEquals(outOfRange.data?.length, 1);
            assertEquals(outOfRange.data?.[0]?.id, null);

            assertLocal();
            const usersResult = await serviceClient.rpc(
                "admin_get_users_page",
                {
                    p_page_number: 1,
                    p_page_size: 1,
                    p_sort_by: "created_at",
                    p_sort_dir: "desc",
                },
            );
            assertEquals(usersResult.error, null);
            assertLocal();
            const beforeRole = await serviceClient.auth.admin.getUserById(
                createdUserIds[1],
            );
            assertEquals(beforeRole.error, null);
            originalTargetRole = beforeRole.data.user?.app_metadata?.app_role ??
                "user";
            const roleUpdate = await serviceClient.rpc(
                "admin_update_user_role",
                {
                    p_target_user_id: createdUserIds[1],
                    p_new_role: "premium",
                    p_actor_user_id: createdUserIds[0],
                },
            );
            assertEquals(roleUpdate.error, null);
            assertLocal();
            const roleRestore = await serviceClient.rpc(
                "admin_update_user_role",
                {
                    p_target_user_id: createdUserIds[1],
                    p_new_role: originalTargetRole,
                    p_actor_user_id: createdUserIds[0],
                },
            );
            assertEquals(roleRestore.error, null);
            if (anonKey) {
                const authenticatedClient = createClient(localOrigin, anonKey);
                const signedIn = await authenticatedClient.auth
                    .signInWithPassword({
                        email: testEmails[0],
                        password: testPasswords[0],
                    });
                assertEquals(signedIn.error, null);
                const authenticatedCalls = [
                    ["admin_get_recipes_page", {
                        p_page_number: 1,
                        p_page_size: 1,
                        p_sort_by: "name",
                        p_sort_dir: "asc",
                    }],
                    ["admin_get_users_page", {
                        p_page_number: 1,
                        p_page_size: 1,
                        p_sort_by: "created_at",
                        p_sort_dir: "desc",
                    }],
                    ["admin_update_user_role", {
                        p_target_user_id: createdUserIds[1],
                        p_new_role: "admin",
                        p_actor_user_id: createdUserIds[0],
                    }],
                ] as const;
                for (const [functionName, args] of authenticatedCalls) {
                    const denied = await authenticatedClient.rpc(
                        functionName,
                        args,
                    );
                    assertEquals(denied.data, null);
                    assert(
                        ["42501", "PGRST301"].includes(
                            denied.error?.code ?? "",
                        ),
                        `Unexpected authenticated RPC error: ${
                            denied.error?.code ?? "none"
                        }`,
                    );
                }
                const afterDeniedRole = await serviceClient.auth.admin
                    .getUserById(createdUserIds[1]);
                assertEquals(afterDeniedRole.error, null);
                assertEquals(
                    afterDeniedRole.data.user?.app_metadata?.app_role,
                    originalTargetRole,
                );
                await authenticatedClient.auth.signOut();
            }
        } finally {
            assertLocal();
            if (createdUserIds.length === 2) {
                assertLocal();
                const restored = await serviceClient.rpc(
                    "admin_update_user_role",
                    {
                        p_target_user_id: createdUserIds[1],
                        p_new_role: originalTargetRole,
                        p_actor_user_id: createdUserIds[0],
                    },
                );
                if (restored.error) {
                    console.warn(
                        `[PS-204] Nie udało się przywrócić roli testowej: ${restored.error.message}`,
                    );
                }
            }
            if (recipeIds.length > 0) {
                assertLocal();
                const cleanupRecipes = await serviceClient.from("recipes")
                    .delete().in("id", recipeIds);
                if (cleanupRecipes.error) {
                    console.warn(
                        `[PS-204] Nie udało się posprzątać przepisów: ${cleanupRecipes.error.message}`,
                    );
                }
            }
            for (const userId of createdUserIds) {
                assertLocal();
                const cleanupUser = await serviceClient.auth.admin.deleteUser(
                    userId,
                );
                if (cleanupUser.error) {
                    console.warn(
                        `[PS-204] Nie udało się posprzątać użytkownika: ${cleanupUser.error.message}`,
                    );
                }
            }
        }
    },
});

Deno.test({
    name: "local admin recipes RPC rejects anon access",
    ignore: !guard.allowed || !reachable || !anonKey,
    sanitizeOps: false,
    sanitizeResources: false,
    async fn() {
        if (!localOrigin || !anonKey) {
            throw new Error("Local Supabase URL and anon key are required");
        }
        const anonClient = createClient(localOrigin, anonKey);
        const deniedCalls = [
            ["admin_get_recipes_page", {
                p_page_number: 1,
                p_page_size: 25,
                p_sort_by: "name",
                p_sort_dir: "asc",
            }],
            ["admin_get_users_page", {
                p_page_number: 1,
                p_page_size: 25,
                p_sort_by: "created_at",
                p_sort_dir: "desc",
            }],
            ["admin_update_user_role", {
                p_target_user_id: "00000000-0000-0000-0000-000000000001",
                p_new_role: "admin",
                p_actor_user_id: "00000000-0000-0000-0000-000000000002",
            }],
        ] as const;
        for (const [functionName, args] of deniedCalls) {
            const denied = await anonClient.rpc(functionName, args);
            assertEquals(denied.data, null);
            assert(
                ["42501", "PGRST301"].includes(denied.error?.code ?? ""),
                `Unexpected anon RPC error: ${denied.error?.code ?? "none"}`,
            );
        }
    },
});
