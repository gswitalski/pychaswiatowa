# API Endpoints Implementation Plan: `POST /ai/recipes/image`

## 1. Przegląd punktu końcowego
Endpoint `POST /ai/recipes/image` (Supabase Edge Function: `/functions/v1/ai/recipes/image`) generuje **fotorealistyczny podgląd zdjęcia potrawy** na podstawie bieżącego stanu formularza przepisu (również niezapisanego). Zwraca obraz jako base64 (MVP: `image/webp` 1024x1024) oraz metadane `meta`, w tym **rozstrzygnięty tryb** `mode`.

Endpoint wspiera tryby:
- `recipe_only`: generacja wyłącznie z danych tekstowych przepisu.
- `with_reference`: generacja z danymi przepisu + opcjonalnym obrazem referencyjnym (do „zrozumienia wyglądu”, bez kopiowania kompozycji).
- `auto` (domyślnie): wybiera `with_reference`, gdy podano `reference_image`, w przeciwnym razie `recipe_only`.

Funkcja jest **premium-gated**: wymaga `app_role` w JWT = `premium` lub `admin`.

## 2. Szczegóły żądania
- **Metoda HTTP**: `POST`
- **Struktura URL**: `/functions/v1/ai/recipes/image`
- **Nagłówki**:
  - **Wymagane**:
    - `Authorization: Bearer <JWT>` (Supabase Auth)
    - `Content-Type: application/json`
- **Parametry**: brak
- **Request Body** (JSON):
  - **Wymagane**:
    - `recipe`:
      - `id` (number, int > 0) – ID przepisu (własność weryfikowana przez RLS)
      - `name` (string, 1..150)
      - `ingredients` (array, min 1) – elementy `{ type: 'header'|'item', content: string }`
      - `steps` (array, min 1) – elementy `{ type: 'header'|'item', content: string }`
    - `output`:
      - `mime_type`: `image/webp` (MVP)
      - `width`: `1024` (MVP)
      - `height`: `1024` (MVP)
    - `output_format`: `'pycha_recipe_image_v1'`
  - **Opcjonalne**:
    - `mode`: `'auto' | 'recipe_only' | 'with_reference'` (domyślnie `auto`)
    - `reference_image` (wymagane, gdy `mode='with_reference'`):
      - wariant A: `{ source: 'storage_path', image_path: string }`
      - wariant B: `{ source: 'base64', mime_type: 'image/png'|'image/jpeg'|'image/webp', data_base64: string }`
    - `language`: string (domyślnie `pl`)
    - Dodatkowe pola `recipe`: `description`, `servings`, `prep_time_minutes`, `total_time_minutes`, `is_termorobot`, `is_grill`, `category_name`, `tags` – zgodnie z istniejącą walidacją backendu (MVP).

## 3. Wykorzystywane typy
### 3.1 DTO/Contract (frontend ↔ backend)
Plik: `shared/contracts/types.ts`
- **Nowe/zmienione**:
  - `AiRecipeImageMode`:
    - `'auto' | 'recipe_only' | 'with_reference'`
  - `AiRecipeImageReferenceImageDto` (discriminated union):
    - `{ source: 'storage_path'; image_path: string }`
    - `{ source: 'base64'; mime_type: AiRecipeDraftImageMimeType; data_base64: string }`
  - `AiRecipeImageRequestDto`:
    - dodać `mode?: AiRecipeImageMode`
    - dodać `reference_image?: AiRecipeImageReferenceImageDto`
  - `AiRecipeImageMetaDto`:
    - dodać `mode: Exclude<AiRecipeImageMode,'auto'>` (tj. `recipe_only | with_reference`)

### 3.2 Typy/Command modele backendu
Plik: `supabase/functions/ai/ai.types.ts`
- **Nowe/zmienione**:
  - `AiRecipeImageMode` (j.w.)
  - `AiRecipeImageReferenceImageSchema` (discriminated union po `source`)
  - `AiRecipeImageRequestSchema`:
    - dodać `mode` (default `auto`)
    - dodać `reference_image` (optional; wymagane gdy `mode='with_reference'`)
  - `AiRecipeImageMeta`:
    - dodać `mode`
  - `GenerateRecipeImageParams`:
    - rozszerzyć o `mode` (rozstrzygnięty) oraz (opcjonalnie) dane obrazu referencyjnego w formie bezpiecznej dla serwisu, np.:
      - `resolvedMode: 'recipe_only' | 'with_reference'`
      - `referenceImage?: { bytes: Uint8Array; mimeType: string; source: 'storage_path'|'base64' }`

## 4. Szczegóły odpowiedzi
- **Sukces**:
  - **Kod**: `200 OK`
  - **Payload**:
    - `image`:
      - `mime_type`: `image/webp`
      - `data_base64`: string
    - `meta`:
      - `mode`: `'recipe_only' | 'with_reference'`
      - `style_contract`: obiekt zgodny z kontraktem (booleany)
      - `warnings`: string[]

## 5. Przepływ danych
1. **Routing**: `supabase/functions/ai/index.ts` → `aiRouter` w `ai.handlers.ts` → `handlePostAiRecipesImage`.
2. **Autentykacja**: `getAuthenticatedContext(req)` weryfikuje JWT (Supabase).
3. **Autoryzacja (premium)**:
   - `extractAuthToken(req)` + `extractAndValidateAppRole(token)` → blokada dla `app_role='user'` (403).
4. **Walidacja request body**:
   - limit rozmiaru payloadu (ochrona DoS),
   - `AiRecipeImageRequestSchema.safeParse(body)`,
   - walidacja spójności `mode` ↔ `reference_image` (patrz sekcja 6).
5. **Weryfikacja własności przepisu**:
   - zapytanie do `recipes` przez klienta z tokenem użytkownika (RLS) + `deleted_at IS NULL`.
6. **Obsługa obrazu referencyjnego** (jeżeli `resolvedMode='with_reference'`):
   - `storage_path`: pobranie obiektu z bucketu (np. `recipe-images`) metodą `client.storage.from(bucket).download(image_path)`; walidacja dostępu i rozmiaru.
   - `base64`: dekodowanie, walidacja MIME i rozmiaru.
7. **Budowa promptu**:
   - `recipe_only`: styl rustykalny (drewniany stół, naturalne światło), bez ludzi/tekstu/znaków wodnych.
   - `with_reference`: styl eleganckiej kuchni/jadalni; dodatkowo w promptach **jawny zakaz kopiowania** referencji (kompozycja/ujęcie/tło).
   - Zasady domenowe w promptach pozostają (np. „nie dodawaj pietruszki, jeśli nie ma tego w przepisie”).
8. **Generacja obrazu**:
   - wywołanie OpenAI Images API `POST /v1/images/generations` (MVP: `model=gpt-image-1.5`, `n=1`, `size=1024x1024`, `output_format=webp`, `background=auto`, `quality=auto`).
   - dla `with_reference` rekomendowane podejście:
     - **preferowane**: jeśli OpenAI Images API wspiera wejście obrazowe dla modelu w tym trybie – użyć go zgodnie z dokumentacją,
     - **fallback**: wykonać krótki krok pośredni „opis referencji” (multimodal chat) i wstrzyknąć do promptu jako `reference_description` (bez dołączania referencji do samej generacji), aby utrzymać zgodność funkcjonalną.
9. **Zwrócenie odpowiedzi**:
   - `meta.mode` = rozstrzygnięty tryb,
   - `meta.style_contract` zależny od trybu (patrz niżej),
   - `warnings` (np. „reference image unreadable, used recipe_only fallback”).

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: wymagany poprawny JWT.
- **Premium gating**: `app_role` musi być `premium|admin` (403 w przeciwnym razie).
- **RLS / własność**: sprawdzenie dostępu do `recipes` przez klienta z tokenem użytkownika; brak użycia service-role.
- **Bezpieczeństwo `reference_image.storage_path`**:
  - nie ufać dowolnym ścieżkom: dopuścić tylko ścieżki zgodne z formatem projektu (np. prefiks katalogu dla danego `recipeId`) lub wymusić zgodność z `recipes.image_path` pobranym z DB,
  - nie logować pełnych ścieżek, jeśli mogą zdradzać strukturę storage (logować skrót/prefix + `recipeId`).
- **Bezpieczeństwo `reference_image.base64`**:
  - walidacja MIME (`png|jpeg|webp`),
  - limit rozmiaru po dekodowaniu (413),
  - nie logować `data_base64` (nawet fragmentów).
- **Ochrona przed nadużyciami kosztowymi**:
  - limit rozmiaru payloadu JSON,
  - limit liczby elementów `ingredients/steps` (już istnieje),
  - (opcjonalnie) rate limiting per user (429).
- **Ochrona prywatności**:
  - prompt nie powinien zawierać danych osobowych; w razie wykrycia (np. w `description`) można je znormalizować/wyciąć w serwisie.

## 7. Obsługa błędów
Projekt nie definiuje w `008 DB Plan.md` dedykowanej tabeli na logi błędów; obsługa błędów opiera się na:
- `logger` (Supabase Edge Function logs),
- `ApplicationError` + `handleError()` jako spójny mapper kodów.

Scenariusze i kody:
- **400 Bad Request**:
  - niepoprawny JSON,
  - błędy walidacji Zod (w tym: `mode='with_reference'` bez `reference_image`),
  - nieobsługiwany format `output_format`/`mime_type`/wymiary.
- **401 Unauthorized**:
  - brak/niepoprawny `Authorization`,
  - niepoprawny/wygaśnięty token,
  - brak `app_role` w JWT (wg `extractAndValidateAppRole`).
- **403 Forbidden**:
  - `app_role='user'` (premium feature).
- **404 Not Found**:
  - przepis nie istnieje / jest soft-deleted / brak dostępu (RLS),
  - obraz referencyjny w `storage_path` nie istnieje lub brak uprawnień do odczytu.
- **413 Payload Too Large**:
  - przekroczony limit rozmiaru request body,
  - zbyt duży obraz referencyjny (zwłaszcza `base64`).
- **422 Unprocessable Entity**:
  - przepis nie ma wystarczających danych do wygenerowania sensownego zdjęcia (np. same nagłówki, zbyt ogólna nazwa) – zwrócić `message` + `reasons`.
- **429 Too Many Requests**:
  - rate limit OpenAI lub wewnętrzny limit per user (jeżeli wdrożony).
- **500 Internal Server Error**:
  - błędy integracji (OpenAI), błędy Storage, nieobsłużone wyjątki.

## 8. Rozważania dotyczące wydajności
- **Minimalizacja tokenów/promptu**:
  - utrzymać streszczanie składników/kroków (już w serwisie),
  - nie przesyłać całych list jeśli są długie; wybrać kluczowe elementy.
- **Obraz referencyjny**:
  - preferować `storage_path` zamiast `base64` dla większych plików,
  - dla `base64` ustalić niski limit (np. 1–2 MB po dekodowaniu) oraz odpowiedni limit `MAX_IMAGE_REQUEST_PAYLOAD_SIZE`.
- **Timeouty**:
  - utrzymać timeouty na wywołaniach OpenAI (już są),
  - dodać timeout na pobieranie z Storage.

## 9. Kroki implementacji
1. **Zaktualizować kontrakty** w `shared/contracts/types.ts`:
   - dodać `AiRecipeImageMode`, `AiRecipeImageReferenceImageDto`,
   - rozszerzyć `AiRecipeImageRequestDto` o `mode` i `reference_image`,
   - rozszerzyć `AiRecipeImageMetaDto` o `mode`.
2. **Zaktualizować backendowe typy i walidacje** w `supabase/functions/ai/ai.types.ts`:
   - dodać schematy dla `mode` i `reference_image`,
   - dodać walidację zależności `mode` ↔ `reference_image` (guard clause lub `superRefine`),
   - dodać limity rozmiarów dla `reference_image.base64`.
3. **Zaktualizować handler** `handlePostAiRecipesImage` w `supabase/functions/ai/ai.handlers.ts`:
   - odczytać `mode`, rozstrzygnąć `resolvedMode`,
   - w przypadku `storage_path` pobrać obraz z bucketu (z kontrolą dostępu i rozmiaru),
   - w przypadku `base64` dekodować i walidować,
   - przekazać do serwisu `resolvedMode` oraz (opcjonalnie) `referenceImage`.
4. **Zrefaktoryzować serwis** `generateRecipeImage` w `supabase/functions/ai/ai.service.ts`:
   - rozdzielić budowę promptu na `recipe_only` vs `with_reference`,
   - dodać jawny „no-copy” kontrakt dla referencji,
   - ustawić `meta.style_contract` zależnie od trybu (np. `rustic_table=true` dla `recipe_only`, `rustic_table=false` dla `with_reference`),
   - ustawić `meta.mode`.
5. **Dodać obsługę ostrzeżeń**:
   - np. jeśli referencja nie może być pobrana/odczytana, a `mode=auto`, wykonać fallback do `recipe_only` i dodać `warnings`.
6. **Zaktualizować frontend** (konsument kontraktu) w `src/app/pages/recipes/...`:
   - budowa requestu powinna opcjonalnie dołączać `mode` i `reference_image` (np. `storage_path` gdy przepis ma już `image_path`),
   - obsłużyć `meta.mode` (np. do debug/telemetrii).
7. **Testy (rekomendowane minimum)**:
   - testy walidacji schematu (`mode`/`reference_image`),
   - testy handlera: `403` dla non-premium, `404` dla braku przepisu, `413` dla zbyt dużej referencji, `200` dla obu trybów.

