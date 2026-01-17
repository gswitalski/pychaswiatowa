# Naprawa: Pobieranie obrazu referencyjnego ze storage dla generowania AI

**Data:** 2026-01-16
**Typ:** Bugfix
**Moduł:** `supabase/functions/ai/ai.handlers.ts`

## Problem

Generowanie obrazu AI z użyciem obrazu referencyjnego nie działało poprawnie. System zgłaszał błąd podczas pobierania obrazu ze Supabase Storage i przełączał się na tryb `recipe_only` zamiast `with_reference`.

### Objawy
```
[Warning] Failed to download reference image from storage
[Info] Falling back to recipe_only mode
```

### Przyczyna

Kod nieprawidłowo interpretował ścieżkę obrazu przechowywaną w bazie danych:

**Błędne założenie:**
```typescript
// Kod zakładał format: bucket-name/path/to/file
const bucketMatch = imagePath.match(/^([^/]+)\//);
const bucket = bucketMatch ? bucketMatch[1] : 'recipe-images';
const filePath = imagePath.replace(/^[^/]+\//, '');
```

**Rzeczywistość:**
- Kolumna `recipes.image_path` przechowuje tylko ścieżkę w buckecie, np. `"recipes/54/cover_1700000000.webp"`
- Nazwa bucketa (`'recipe-images'`) nie jest częścią tej ścieżki
- Kod błędnie traktował `"recipes"` jako nazwę bucketa i próbował pobrać plik `"54/cover_1700000000.webp"` z bucketa `"recipes"` (który nie istnieje)

## Rozwiązanie

### Zmiany w kodzie

**Plik:** `supabase/functions/ai/ai.handlers.ts` (linie ~494-520)

**Przed:**
```typescript
// Extract bucket from path (assuming format: bucket-name/path/to/file)
const bucketMatch = imagePath.match(/^([^/]+)\//);
const bucket = bucketMatch ? bucketMatch[1] : 'recipe-images';
const filePath = imagePath.replace(/^[^/]+\//, '');

const { data: imageBlob, error: downloadError } = await supabase
    .storage
    .from(bucket)
    .download(filePath);

if (downloadError || !imageBlob) {
    logger.warn('Failed to download reference image from storage', {
        userId: user.id,
        recipeId: requestData.recipe.id,
        error: downloadError?.message,
    });
```

**Po:**
```typescript
// Bucket name is fixed (image_path contains only the file path within the bucket)
const bucket = 'recipe-images';
const filePath = imagePath;

const { data: imageBlob, error: downloadError } = await supabase
    .storage
    .from(bucket)
    .download(filePath);

if (downloadError || !imageBlob) {
    logger.warn('Failed to download reference image from storage', {
        userId: user.id,
        recipeId: requestData.recipe.id,
        bucket,
        filePath,
        error: downloadError,
    });
```

### Kluczowe zmiany:

1. **Usunięto nieprawidłowe parsowanie ścieżki** - bucket jest teraz stałą wartością `'recipe-images'`
2. **Użycie pełnej ścieżki** - `imagePath` jest używany bezpośrednio jako `filePath` bez modyfikacji
3. **Ulepszone logowanie błędów:**
   - Dodano `bucket` i `filePath` do kontekstu logów
   - Logowany jest cały obiekt `downloadError` zamiast tylko `message` (co wcześniej powodowało wyświetlanie `"{}"`)

## Weryfikacja

Po wprowadzeniu zmiany:

1. Generowanie obrazu AI z użyciem obrazu referencyjnego powinno działać poprawnie
2. System powinien używać trybu `with_reference` i modelu Gemini
3. W logach nie powinien pojawiać się błąd "Failed to download reference image from storage"
4. W przypadku rzeczywistych błędów, logi będą zawierały pełne informacje diagnostyczne

## Wpływ

- **Funkcjonalność:** Użytkownicy premium mogą teraz generować obrazy AI z użyciem obrazu referencyjnego
- **Tryb działania:** `with_reference` z modelem Gemini zamiast fallback do `recipe_only` z OpenAI
- **Debugging:** Lepsze logowanie ułatwi diagnozowanie przyszłych problemów

## Zgodność

Zmiana jest w pełni kompatybilna wstecz - nie wymaga migracji danych ani zmian w API.
