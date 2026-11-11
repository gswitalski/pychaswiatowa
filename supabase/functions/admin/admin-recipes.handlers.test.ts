import { assertEquals } from "jsr:@std/assert@1";
import { ApplicationError } from "../_shared/errors.ts";
import { handleGetAdminRecipes } from "./admin-recipes.handlers.ts";
import { adminRouter } from "./admin.handlers.ts";

const response = {
    data: [],
    pagination: { currentPage: 1, pageSize: 25, totalPages: 0, totalItems: 0 },
    sorting: { sort_by: "created_at" as const, sort_dir: "desc" as const },
};

Deno.test("authorizes before validating and does not call service on denial", async () => {
    let called = false;
    const result = await handleGetAdminRecipes(
        new Request("http://localhost/admin/recipes?page_size=0"),
        {
            requireAdmin: async () => {
                throw new ApplicationError(
                    "FORBIDDEN",
                    "Admin role is required",
                );
            },
            getRecipes: async () => {
                called = true;
                return response;
            },
        },
    );
    assertEquals(result.status, 403);
    assertEquals((await result.json()).code, "FORBIDDEN");
    assertEquals(called, false);
});

Deno.test("returns unauthorized before validating malformed query", async () => {
    let called = false;
    const result = await handleGetAdminRecipes(
        new Request("http://localhost/admin/recipes?page_size=0"),
        {
            requireAdmin: async () => {
                throw new ApplicationError(
                    "UNAUTHORIZED",
                    "Authentication required",
                );
            },
            getRecipes: async () => {
                called = true;
                return response;
            },
        },
    );
    assertEquals(result.status, 401);
    assertEquals((await result.json()).code, "UNAUTHORIZED");
    assertEquals(called, false);
});

Deno.test("returns bad request and skips service after authorized validation failure", async () => {
    let called = false;
    const result = await handleGetAdminRecipes(
        new Request("http://localhost/admin/recipes?page_size=0"),
        {
            requireAdmin: async () => ({ userId: "admin-id" }),
            getRecipes: async () => {
                called = true;
                return response;
            },
        },
    );
    assertEquals(result.status, 400);
    assertEquals(called, false);
    assertEquals((await result.json()).code, "VALIDATION_ERROR");
});

Deno.test("returns service response for an authorized admin", async () => {
    let received: unknown;
    const result = await handleGetAdminRecipes(
        new Request("http://localhost/admin/recipes?sort_by=name&sort_dir=asc"),
        {
            requireAdmin: async () => ({ userId: "admin-id" }),
            getRecipes: async ({ query }) => {
                received = query;
                return response;
            },
        },
    );
    assertEquals(result.status, 200);
    assertEquals(received, { sort_by: "name", sort_dir: "asc" });
    assertEquals(await result.json(), response);
});

Deno.test("maps service failure to 500", async () => {
    const result = await handleGetAdminRecipes(
        new Request("http://localhost/admin/recipes"),
        {
            requireAdmin: async () => ({ userId: "admin-id" }),
            getRecipes: async () => {
                throw new ApplicationError("INTERNAL_ERROR", "failure");
            },
        },
    );
    assertEquals(result.status, 500);
    assertEquals((await result.json()).code, "INTERNAL_ERROR");
});

Deno.test("router returns method and path errors and missing-token 401", async () => {
    const method = await adminRouter(
        new Request("http://localhost/admin/recipes", { method: "POST" }),
    );
    assertEquals(method.status, 405);
    assertEquals(method.headers.get("Allow"), "GET, OPTIONS");
    assertEquals((await method.json()).code, "METHOD_NOT_ALLOWED");

    const child = await adminRouter(
        new Request("http://localhost/admin/recipes/1"),
    );
    assertEquals(child.status, 404);
    assertEquals((await child.json()).code, "NOT_FOUND");
    const trailing = await adminRouter(
        new Request("http://localhost/admin/recipes/"),
    );
    assertEquals(trailing.status, 404);
    assertEquals((await trailing.json()).code, "NOT_FOUND");
    const unauthorized = await adminRouter(
        new Request("http://localhost/admin/recipes"),
    );
    assertEquals(unauthorized.status, 401);
    assertEquals((await unauthorized.json()).code, "UNAUTHORIZED");
});
