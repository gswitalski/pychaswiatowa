import { assertEquals } from "jsr:@std/assert@1";
import { evaluateLocalDbGuard } from "./admin-recipes.rpc-guard.ts";

Deno.test("accepts only local HTTP(S) database URLs", () => {
    const local = evaluateLocalDbGuard(
        "http://localhost:54331/path?x=1",
        "key",
    );
    assertEquals(local.allowed, true);
    assertEquals(local.origin, "http://localhost:54331");
    assertEquals(
        evaluateLocalDbGuard("http://127.0.0.1:54331", "key").allowed,
        true,
    );
    for (
        const url of [
            "ftp://localhost:54331",
            "http://[::1]:54331",
            "http://0.0.0.0:54331",
            "https://abcd.supabase.co",
            "http://localhost.evil.com",
            "http://127.0.0.1.nip.io",
            "http://localhost@evil.com",
            "http://evil.com/?h=localhost",
            "not a url",
        ]
    ) {
        const result = evaluateLocalDbGuard(url, "key");
        assertEquals(result.allowed, false);
        assertEquals(result.reason.length > 0, true);
    }
    assertEquals(evaluateLocalDbGuard(undefined, "key").allowed, false);
    assertEquals(
        evaluateLocalDbGuard("http://localhost:54331", undefined).allowed,
        false,
    );
    assertEquals(
        evaluateLocalDbGuard("http://localhost:54331", "").allowed,
        false,
    );
});

Deno.test("returns exact reasons for rejected database guards", () => {
    const cases = [
        ["ftp://localhost:54331", "Only HTTP(S) URLs are allowed"],
        [
            "http://user:pass@localhost:54331",
            "Credentials in URL are not allowed",
        ],
        ["http://0.0.0.0:54331", "Only localhost and 127.0.0.1 are allowed"],
        ["", "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"],
        ["not a url", "Invalid SUPABASE_URL"],
        [
            "http://localhost:54331",
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
        ],
    ] as const;
    for (const [url, expectedReason] of cases) {
        const key = expectedReason.includes("SERVICE_ROLE") ? undefined : "key";
        assertEquals(evaluateLocalDbGuard(url, key).reason, expectedReason);
    }
    assertEquals(
        evaluateLocalDbGuard("http://LOCALHOST:54331", "key").allowed,
        true,
    );
});
