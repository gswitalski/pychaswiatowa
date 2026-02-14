# Recipe AI Image on Create — plan API

## Cel API

Zapewnić możliwość generowania podglądu zdjęcia AI dla przepisu **bez zapisywania przepisu** (scenariusz `/recipes/new`) oraz utrzymać dotychczasowy scenariusz edycji (`/recipes/:id/edit`). W MVP dążymy do tego, aby UI mogło:

- wygenerować podgląd przez `POST /ai/recipes/image`,
- po akceptacji zapisać przepis standardowym `POST /recipes`,
- a następnie wgrać zaakceptowane zdjęcie przez istniejący `POST /recipes/{id}/image`.

## Istniejące endpointy wykorzystywane przez UI (bez zmian)

### 1) `POST /recipes`

Tworzy przepis i zwraca `id` (wymagane do uploadu zdjęcia).

### 2) `POST /recipes/{id}/image`

Upload/replace zdjęcia dla istniejącego przepisu (multipart). Wykorzystujemy go również do uploadu zaakceptowanego obrazu AI po `POST /recipes`.

## Endpoint AI (zmiana kontraktu / doprecyzowanie)

### `POST /ai/recipes/image` (Supabase Edge Function)

**Opis**: Generuje **podgląd** zdjęcia potrawy na podstawie aktualnego stanu formularza (również niezapisanych zmian). Endpoint zwraca wynik jako base64 WebP 1024×1024.

**Auth**: wymagany JWT.

**Autoryzacja (premium gating)**:

- `app_role in ('premium', 'admin')` → `200 OK`
- `app_role = 'user'` → `403 Forbidden`

#### Kluczowa zmiana dla `/recipes/new`

Aby wspierać tworzenie przepisu, `recipe.id` w payloadzie musi być **opcjonalne**. Dla `/recipes/new` klient wysyła `recipe.id = null` (lub pomija pole), a backend nie może wymagać istnienia rekordu w bazie.

#### Doprecyzowanie promptu (wymagane przez UI)

Dodajemy opcjonalne pole `prompt_hint` (krótkie doprecyzowanie, wysyłane z dialogu UI).

#### Request payload (propozycja)

```json
{
  "recipe": {
    "id": null,
    "name": "Sernik klasyczny",
    "description": "Kremowy sernik na spodzie z herbatników.",
    "servings": 8,
    "prep_time_minutes": 20,
    "total_time_minutes": 90,
    "is_termorobot": false,
    "is_grill": false,
    "category_name": "Deser",
    "ingredients": [
      { "type": "header", "content": "Masa" },
      { "type": "item", "content": "twaróg" }
    ],
    "steps": [
      { "type": "item", "content": "Wymieszaj składniki." }
    ],
    "tags": ["wypieki", "sernik"]
  },
  "prompt_hint": "Ujęcie z góry, naturalne światło, bez tekstu na zdjęciu.",
  "mode": "auto",
  "reference_image": {
    "source": "base64",
    "mime_type": "image/jpeg",
    "data_base64": "/9j/4AAQSkZJRgABAQAAAQ..."
  },
  "output": {
    "mime_type": "image/webp",
    "width": 1024,
    "height": 1024
  },
  "language": "pl",
  "output_format": "pycha_recipe_image_v1"
}
```

**Uwagi:**

- `reference_image`:
    - w trybie tworzenia (`/recipes/new`) preferowany jest `source = base64` (obraz istnieje tylko w stanie formularza),
    - w edycji (`/recipes/:id/edit`) dozwolone jest także `source = storage_path`.
- `mode`:
    - `auto` (domyślne) wybiera `with_reference` jeśli `reference_image` jest podane, w przeciwnym razie `recipe_only`.
- `prompt_hint`:
    - opcjonalne,
    - limit długości po stronie backendu (np. 400 znaków po trim),
    - treść jest traktowana jako „doprecyzowanie stylu”, nie jako pełny prompt.

#### Success response (bez zmian w formacie)

```json
{
  "image": {
    "mime_type": "image/webp",
    "data_base64": "UklGRiQAAABXRUJQVlA4..."
  },
  "meta": {
    "mode": "with_reference",
    "warnings": []
  }
}
```

#### Error responses (kluczowe)

- `400 Bad Request` — niepoprawny payload (np. brak `recipe.name` i brak sensownej treści).
- `401 Unauthorized` — brak sesji.
- `403 Forbidden` — brak roli premium/admin.
- `413 Payload Too Large` — zbyt duża referencja base64.
- `422 Unprocessable Entity` — zbyt mało informacji, aby wygenerować sensowny obraz jednej potrawy.
- `429 Too Many Requests` — rate limit (koszty).

## Sekwencja wywołań dla scenariusza `/recipes/new`

1. UI: `POST /ai/recipes/image` → dostaje preview base64.
2. UI: użytkownik akceptuje wynik → obraz trafia do stanu formularza (tymczasowo).
3. UI: `POST /recipes` → otrzymuje `id`.
4. UI: `POST /recipes/{id}/image` (multipart) → upload zaakceptowanego obrazu AI.
    - Jeśli upload się nie uda: przepis pozostaje zapisany, UI pokazuje błąd i pozwala ponowić upload z poziomu edycji.

## Wymagania bezpieczeństwa i kosztów

- Rate limit na `POST /ai/recipes/image` per user (np. limit/minutę + limit/dzień) oraz logowanie metryk kosztowych.
- Backend nie może polegać na UI w zakresie premium gating — `403` musi być wymuszane serwerowo.

