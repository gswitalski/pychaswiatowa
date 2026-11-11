import {
    assertEquals,
    assertInstanceOf,
    assertThrows,
} from "jsr:@std/assert@1";
import { ApplicationError } from "../_shared/errors.ts";
import {
    ADMIN_RECIPES_SORT_FIELDS,
    validateAdminRecipesQuery,
} from "./admin-recipes.types.ts";

Deno.test("validates all supported recipes query values", () => {
    for (const sort_by of ADMIN_RECIPES_SORT_FIELDS) {
        assertEquals(
            validateAdminRecipesQuery(
                new URLSearchParams(`sort_by=${sort_by}`),
            ),
            { sort_by },
        );
    }
    assertEquals(
        validateAdminRecipesQuery(
            new URLSearchParams(
                "page=2&page_size=10&sort_by=name&sort_dir=asc",
            ),
        ),
        { page: 2, page_size: 10, sort_by: "name", sort_dir: "asc" },
    );
    assertEquals(validateAdminRecipesQuery(new URLSearchParams()), {});
    assertEquals(
        validateAdminRecipesQuery(new URLSearchParams("page=3000000000")),
        { page: 3000000000 },
    );
    assertEquals(
        validateAdminRecipesQuery(new URLSearchParams("page=9007199254740991")),
        { page: Number.MAX_SAFE_INTEGER },
    );
    for (const page_size of [1, 25, 50, 100]) {
        assertEquals(
            validateAdminRecipesQuery(
                new URLSearchParams(`page_size=${page_size}`),
            ),
            { page_size },
        );
    }
    assertEquals(validateAdminRecipesQuery(new URLSearchParams("foo=1")), {});
});

Deno.test("rejects unsafe and invalid recipes query values", () => {
    for (
        const query of [
            "page=",
            "page=0",
            "page=-1",
            "page=abc",
            "page=1.5",
            "page=1e3",
            "page=9007199254740992",
            `page=${"9".repeat(400)}`,
            "page_size=0",
            "page_size=101",
            "page_size=abc",
            "page_size=1.5",
            "page_size=-1",
            "sort_by=visibility",
            "sort_by=updated_at",
            "sort_by=created_at;drop",
            "sort_by=",
            "sort_dir=up",
            "sort_dir=",
            "sort_dir=ASC",
        ]
    ) {
        const error = assertThrows(() =>
            validateAdminRecipesQuery(new URLSearchParams(query))
        );
        assertInstanceOf(error, ApplicationError);
        assertEquals(error.code, "VALIDATION_ERROR");
    }
    assertEquals(
        validateAdminRecipesQuery(new URLSearchParams("page=2&page=3")),
        { page: 2 },
    );
});
