import {
    assertEquals,
    assertInstanceOf,
    assertRejects,
} from "jsr:@std/assert@1";
import { ApplicationError } from "../_shared/errors.ts";
import {
    type AdminRecipesRpcClient,
    getAdminRecipes,
} from "./admin-recipes.service.ts";

function clientFor(
    data: unknown[],
    capture: Record<string, unknown>,
): AdminRecipesRpcClient {
    return {
        rpc: async (name, args) => {
            capture.name = name;
            capture.args = args;
            return { data: data as never[], error: null };
        },
    };
}

Deno.test("maps RPC sentinel and forwards defaults and all four arguments", async () => {
    const capture: Record<string, unknown> = {};
    const result = await getAdminRecipes({
        query: { page: 3000000000, page_size: 25 },
        client: clientFor([{ id: null, total_items: "61" }], capture),
    });
    assertEquals(capture.name, "admin_get_recipes_page");
    assertEquals(capture.args, {
        p_page_number: 3000000000,
        p_page_size: 25,
        p_sort_by: "created_at",
        p_sort_dir: "desc",
    });
    assertEquals(result.pagination, {
        currentPage: 3000000000,
        pageSize: 25,
        totalPages: 3,
        totalItems: 61,
    });
    assertEquals(result.data, []);
});

Deno.test("maps recipe fields, normalizes values, and rounds ratings", async () => {
    const result = await getAdminRecipes({
        query: {},
        client: clientFor([{
            id: "42",
            name: "Szarlotka",
            author_id: "00000000-0000-0000-0000-000000000001",
            author_username: " Kasia ",
            author_email: null,
            category_name: null,
            created_at: "2026-05-03T10:15:00Z",
            average_rating: "4.5",
            ratings_count: "2.9",
            is_grill: true,
            is_termorobot: null,
            total_items: "1",
        }], {}),
    });
    assertEquals(result.data[0], {
        id: 42,
        name: "Szarlotka",
        author_id: "00000000-0000-0000-0000-000000000001",
        author_username: "Kasia",
        author_email: null,
        category_name: null,
        created_at: "2026-05-03T10:15:00Z",
        average_rating: 4.5,
        ratings_count: 2,
        is_grill: true,
        is_termorobot: false,
    });
    assertEquals(result.sorting, { sort_by: "created_at", sort_dir: "desc" });
    const noRating = await getAdminRecipes({
        query: { sort_by: "average_rating", sort_dir: "asc" },
        client: clientFor([{
            id: 43,
            name: "Bez ocen",
            author_id: "00000000-0000-0000-0000-000000000002",
            author_username: null,
            author_email: null,
            category_name: null,
            created_at: "2026-05-03T10:15:00Z",
            average_rating: null,
            ratings_count: 0,
            is_grill: false,
            is_termorobot: false,
            total_items: 1,
        }], {}),
    });
    assertEquals(noRating.data[0].average_rating, null);
    assertEquals(noRating.data[0].author_username, null);
    assertEquals(noRating.data[0].author_email, null);
});

Deno.test("handles empty rows and non-finite values", async () => {
    const empty = await getAdminRecipes({
        query: {},
        client: clientFor([], {}),
    });
    assertEquals(empty.pagination.totalItems, 0);
    assertEquals(empty.pagination.totalPages, 0);

    const result = await getAdminRecipes({
        query: { page: Number.MAX_SAFE_INTEGER, page_size: 100 },
        client: clientFor([{
            id: "1",
            name: "x",
            author_id: "00000000-0000-0000-0000-000000000001",
            author_username: "",
            author_email: " ",
            category_name: "",
            created_at: "2026-01-01T00:00:00Z",
            average_rating: Number.NaN,
            ratings_count: Number.POSITIVE_INFINITY,
            is_grill: null,
            is_termorobot: false,
            total_items: "61",
        }], {}),
    });
    assertEquals(result.data[0].average_rating, null);
    assertEquals(result.data[0].ratings_count, 0);
    assertEquals(result.pagination.totalPages, 1);
});

Deno.test("calculates out-of-range and zero totals", async () => {
    const result = await getAdminRecipes({
        query: { page: 9 },
        client: clientFor([{ id: null, total_items: 61 }], {}),
    });
    assertEquals(result.pagination, {
        currentPage: 9,
        pageSize: 25,
        totalPages: 3,
        totalItems: 61,
    });
    const zero = await getAdminRecipes({
        query: { page_size: 50 },
        client: clientFor([{ id: null, total_items: 0 }], {}),
    });
    assertEquals(zero.pagination.totalPages, 0);
});

Deno.test("rejects malformed rows and missing total_items with coded errors", async () => {
    for (
        const data of [
            [{ id: 1, name: null, created_at: "2026-01-01", author_id: "id" }],
            [{ id: 1, name: "x", created_at: null, author_id: "id" }],
            [{ id: 1, name: "x", created_at: "2026-01-01", author_id: null }],
            [{ id: null, total_items: null }],
        ]
    ) {
        const error = await assertRejects(() =>
            getAdminRecipes({
                query: {},
                client: clientFor(data, {}),
            })
        );
        assertInstanceOf(error, ApplicationError);
        assertEquals(error.code, "INTERNAL_ERROR");
    }
});

Deno.test("maps RPC errors to coded internal error", async () => {
    const client: AdminRecipesRpcClient = {
        rpc: async () => ({
            data: null,
            error: { message: "database unavailable" },
        }),
    };
    const error = await assertRejects(
        () => getAdminRecipes({ query: {}, client }),
        Error,
        "Failed to fetch admin recipes",
    );
    assertInstanceOf(error, ApplicationError);
    assertEquals(error.code, "INTERNAL_ERROR");
});
