# Testing Guide: AI Recipe Draft

## Endpoint
`POST /functions/v1/ai/recipes/draft`

## Change Summary
The draft supports optional `tips_raw` and always returns eight normalized recipe metadata fields: `servings`, `prep_time_minutes`, `total_time_minutes`, `diet_type`, `cuisine`, `difficulty`, `is_termorobot`, and `is_grill`.

## Testing Locally

### 1. Start the function
```bash
supabase functions serve ai --no-verify-jwt
```

### 2. Use REST Client (e.g., Thunder Client, Postman, or VS Code REST Client)

Import the test requests from `test-requests.http` file in this directory.

### 3. Test Cases

#### Test Case 1: Recipe WITH tips ✅
**Expected:** Response should include `tips_raw` field with extracted tips.

```json
{
    "source": "text",
    "text": "Naleśniki z serem\n\nSkładniki:\n2 jajka\n250 ml mleka\n150 g mąki\n500 g sera białego\n3 łyżki cukru\n\nWykonanie:\nWymieszać jajka z mlekiem.\nDodać mąkę i wymieszać na gładkie ciasto.\nUsmażyć cienkie naleśniki.\nSer wymieszać z cukrem.\nNałożyć farsz na naleśniki i zrolować.\n\nWskazówki:\nNaleśniki można zamrozić.\nPodawać z owocami lub sosem czekoladowym.\nZamiast sera można użyć dżemu.",
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
}
```

**Expected Response:**
```json
{
    "draft": {
        "name": "Naleśniki z serem",
        "description": "...",
        "ingredients_raw": "...",
        "steps_raw": "...",
        "tips_raw": "Naleśniki można zamrozić.\nPodawać z owocami lub sosem czekoladowym.\nZamiast sera można użyć dżemu.",
        "category_name": "Deser",
        "tags": [...]
    },
    "meta": {
        "confidence": 0.95,
        "warnings": []
    }
}
```

#### Test Case 2: Recipe WITHOUT tips ✅
**Expected:** Response should NOT include `tips_raw` field (undefined/missing).

```json
{
    "source": "text",
    "text": "Jajecznica\n\nSkładniki:\n3 jajka\nsól\nmasło\n\nWykonanie:\nRozbić jajka do miski.\nDodać sól.\nRoztopić masło na patelni.\nWlać jajka i mieszać.",
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
}
```

**Expected Response:**
```json
{
    "draft": {
        "name": "Jajecznica",
        "description": "...",
        "ingredients_raw": "...",
        "steps_raw": "...",
        // NO tips_raw field
        "category_name": "Śniadanie",
        "tags": [...]
    },
    "meta": {
        "confidence": 0.9,
        "warnings": []
    }
}
```

#### Test Case 3: Recipe with STRUCTURED tips ✅
**Expected:** Tips with section headers (# prefix) should be preserved.

```json
{
    "source": "text",
    "text": "Pierogi z kapustą i grzybami\n\nSKŁADNIKI:\n\nCiasto:\n500 g mąki\n250 ml wody\n1 jajko\n\nFarsz:\n500 g kapusty kiszonej\n100 g suszonych grzybów\n2 cebule\nsól, pieprz\n\nWYKONANIE:\n1. Wymieszać składniki na ciasto i odstawić na 30 minut.\n2. Namoczone grzyby ugotować i pokroić.\n3. Kapustę pokroić drobno.\n4. Cebulę pokroić w kostkę i zeszklić.\n5. Wymieszać farsz: kapustę, grzyby, cebulę.\n6. Wyrobić ciasto i wyciąć kółka.\n7. Nałożyć farsz i skleić pierogi.\n8. Ugotować w osolonej wodzie.\n\nWSKAZÓWKI:\n\nPrzechowywanie:\n- Pierogi można zamrozić na surowo\n- Zamrożone gotować bez rozmrażania\n\nPodawanie:\n- Podawać ze skwarkami\n- Smakują też z cebulką i grzybkami\n\nWarianty:\n- Można dodać suszone śliwki do farszu\n- Zamiast wody użyć wywaru z grzybów",
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
}
```

**Expected Response:**
```json
{
    "draft": {
        "name": "Pierogi z kapustą i grzybami",
        "tips_raw": "# Przechowywanie\nPierogi można zamrozić na surowo\nZamrożone gotować bez rozmrażania\n# Podawanie\nPodawać ze skwarkami\nSmakują też z cebulką i grzybkami\n# Warianty\nMożna dodać suszone śliwki do farszu\nZamiast wody użyć wywaru z grzybów",
        ...
    }
}
```

### 4. Metadata test cases

Use tests 7–9 from `test-requests.http`.

#### Explicit metadata

Verify that values stated in source text take precedence over inference. The response must contain all eight fields, for example:

```json
{
    "servings": 4,
    "prep_time_minutes": 20,
    "total_time_minutes": 50,
    "diet_type": "MEAT",
    "cuisine": "POLISH",
    "difficulty": "EASY",
    "is_termorobot": true,
    "is_grill": true
}
```

#### Metadata inferred from text or image

- Recipe text without explicit metadata should still return all fields.
- For an image without readable text, verify that `meta.confidence` is lower than for a clear recipe screenshot.
- `cuisine` must be a supported enum or `null`.
- Numeric values must stay within their API ranges.

#### Backend normalization

- Missing fields become `null` or `false` and produce one incomplete-metadata warning.
- Invalid individual values produce fixed messages in `meta.warnings`, but the endpoint still returns `200`.
- If `total_time_minutes < prep_time_minutes`, total time is raised to preparation time and a correction warning is returned.

## Validation Checklist

- [ ] Test 1: Recipe WITH tips returns `tips_raw` field
- [ ] Test 2: Recipe WITHOUT tips does NOT include `tips_raw` field
- [ ] Test 3: Structured tips preserve section headers (# prefix)
- [ ] Test 4: Empty tips are normalized to undefined (not empty string)
- [ ] Test 5: Tips in English work correctly with `language: "en"`
- [ ] Test 7: Explicit servings, times, cuisine, difficulty and flags are preserved
- [ ] Test 8: Missing source metadata is inferred and all eight fields are returned
- [ ] Test 9: Image import returns all eight fields
- [ ] `total_time_minutes >= prep_time_minutes` when both values are present
- [ ] Enum values belong to their allowlists; `cuisine` may be `null`
- [ ] Metadata warnings do not change a successful response from `200`
- [ ] Logs show `hasTips: true/false` indicator
- [ ] Logs show `warningsCount`, `hasServings`, and `hasTimes`
- [ ] No TypeScript errors
- [ ] No runtime errors
- [ ] Performance: response time < 10s for typical recipes

## Log Verification

Check that logs include the new `hasTips` field:

```
Recipe draft generated successfully {
    userId: "...",
    recipeName: "Naleśniki z serem",
    tagsCount: 3,
    hasTips: true,
    warningsCount: 0,
    hasServings: true,
    hasTimes: true,
    confidence: 0.95,
    duration: 5234
}
```

## Deployment

After successful local testing:

```bash
supabase functions deploy ai
```

## Rollback Plan

If issues occur, the `tips_raw` field is **fully optional** and backward compatible. Frontend can safely ignore it. No database changes required.

To revert:
1. Remove `tips_raw` from `AiRecipeDraftDto` interface
2. Remove `tips_raw` from `AiRecipeDraftOutputSchema`
3. Remove tips handling from `normalizeDraft()`
4. Remove tips instructions from system prompt
5. Redeploy

## Notes

- The `tips_raw` field follows the same format as `ingredients_raw` and `steps_raw`
- Each line is a separate tip
- Section headers start with `#` character
- The field is completely optional - model decides whether to include it based on source content
- Empty tips are normalized to `undefined` (not returned in response)
