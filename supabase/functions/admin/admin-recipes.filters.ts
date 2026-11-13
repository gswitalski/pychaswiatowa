import { ApplicationError } from "../_shared/errors.ts";

export interface AdminRecipesFilters {
    recipe_id?: number;
    name?: string;
    author?: string;
    category_ids?: number[];
    include_uncategorized?: boolean;
    created_from?: string;
    created_to?: string;
    rating_min?: number;
    rating_max?: number;
    ratings_count_min?: number;
    ratings_count_max?: number;
    is_grill?: boolean;
    is_termorobot?: boolean;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validationError(message: string): ApplicationError {
    return new ApplicationError("VALIDATION_ERROR", message);
}

function parsePositiveInteger(value: string | null, field: string): number | undefined {
    if (value === null || value.trim() === "") {
        return undefined;
    }
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
        throw validationError(`Parametr ${field} musi być dodatnią liczbą całkowitą.`);
    }
    return Number(value);
}

function parseText(value: string | null, field: string): string | undefined {
    const normalized = value?.trim() ?? "";
    if (!normalized) {
        return undefined;
    }
    if ([...normalized].length > 100) {
        throw validationError(`Parametr ${field} nie może mieć więcej niż 100 znaków.`);
    }
    return normalized;
}

function parseDate(value: string | null, field: string): string | undefined {
    if (value === null || value === "") {
        return undefined;
    }
    if (!DATE_PATTERN.test(value)) {
        throw validationError(`Parametr ${field} musi być datą w formacie YYYY-MM-DD.`);
    }
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw validationError(`Parametr ${field} musi być poprawną datą.`);
    }
    return value;
}

function parseDecimal(value: string | null, field: string, min: number, max: number): number | undefined {
    if (value === null || value === "") {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        throw validationError(`Parametr ${field} ma nieprawidłową wartość.`);
    }
    return parsed;
}

function parseNonNegativeInteger(value: string | null, field: string): number | undefined {
    if (value === null || value === "") {
        return undefined;
    }
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw validationError(`Parametr ${field} musi być liczbą całkowitą nieujemną.`);
    }
    return Number(value);
}

function parseBoolean(value: string | null, field: string): boolean | undefined {
    if (value === null) {
        return undefined;
    }
    if (value !== "true") {
        throw validationError(`Parametr ${field} może mieć wyłącznie wartość true.`);
    }
    return true;
}

function assertRange(from: number | string | undefined, to: number | string | undefined, field: string): void {
    if (from !== undefined && to !== undefined && from > to) {
        throw validationError(`Zakres ${field} jest odwrócony.`);
    }
}

export function parseAdminRecipesFilters(params: URLSearchParams): AdminRecipesFilters {
    const categoryValues = params.getAll("category_id");
    const categoryIds = [...new Set(categoryValues.map((value) => {
        const parsed = parsePositiveInteger(value, "category_id");
        if (parsed === undefined) {
            throw validationError("Parametr category_id jest wymagany.");
        }
        return parsed;
    }))];
    const filters: AdminRecipesFilters = {
        recipe_id: parsePositiveInteger(params.get("id"), "id"),
        name: parseText(params.get("name"), "name"),
        author: parseText(params.get("author"), "author"),
        category_ids: categoryIds.length > 0 ? categoryIds : undefined,
        include_uncategorized: parseBoolean(params.get("uncategorized"), "uncategorized"),
        created_from: parseDate(params.get("created_from"), "created_from"),
        created_to: parseDate(params.get("created_to"), "created_to"),
        rating_min: parseDecimal(params.get("rating_min"), "rating_min", 1, 5),
        rating_max: parseDecimal(params.get("rating_max"), "rating_max", 1, 5),
        ratings_count_min: parseNonNegativeInteger(params.get("ratings_count_min"), "ratings_count_min"),
        ratings_count_max: parseNonNegativeInteger(params.get("ratings_count_max"), "ratings_count_max"),
        is_grill: parseBoolean(params.get("is_grill"), "is_grill"),
        is_termorobot: parseBoolean(params.get("is_termorobot"), "is_termorobot"),
    };
    assertRange(filters.created_from, filters.created_to, "dat");
    assertRange(filters.rating_min, filters.rating_max, "oceny");
    assertRange(filters.ratings_count_min, filters.ratings_count_max, "liczby ocen");
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== undefined),
    ) as AdminRecipesFilters;
}
