# Terms of Service (Regulamin Serwisu) — plan API

## Cel API

W MVP **nie wprowadzamy nowych endpointów**, ponieważ treść Regulaminu będzie dystrybuowana jako asset frontendu (np. `assets/legal/terms.md`) i renderowana po stronie aplikacji Angular.

Jednocześnie dokumentujemy kierunek na przyszłość: możliwość pobierania dokumentów prawnych dynamicznie (np. z Supabase) bez konieczności redeployu frontendu.

## MVP — brak zmian w API

- **Nowe endpointy**: brak
- **Zmiany w istniejących endpointach**: brak
- **Uzasadnienie**: najprostszy, niezależny od backendu sposób dostarczenia treści statycznej w SPA.

## Proponowane endpointy (post-MVP / opcjonalne)

### 1) `GET /public/legal/terms`

**Opis**: Zwraca aktualną wersję Regulaminu Serwisu w formacie Markdown.

- **Auth**: brak (public)
- **Query params**:
    - `format` (opcjonalne): `md` (domyślne) | `json`
- **Odpowiedzi**:
    - `200 OK`
    - `304 Not Modified` (ETag / If-None-Match)
    - `404 Not Found` (brak dokumentu)

**Przykład odpowiedzi — `format=md` (plain text):**

```
# Regulamin serwisu „PychaŚwiatowa” (Warunki korzystania)
...
```

**Przykład odpowiedzi — `format=json`:**

```json
{
  "document": {
    "id": "terms",
    "title": "Regulamin Serwisu",
    "version": "0.1",
    "published_at": "2026-02-19",
    "updated_at": "2026-02-19",
    "content_markdown": "# Regulamin serwisu „PychaŚwiatowa” (Warunki korzystania)\n..."
  }
}
```

### 2) `GET /public/legal/documents`

**Opis**: Lista dokumentów prawnych dostępnych do pobrania (ułatwia budowę stopki/sekcji legal).

- **Auth**: brak (public)
- **Odpowiedzi**:
    - `200 OK`

**Przykładowa odpowiedź:**

```json
{
  "documents": [
    {
      "id": "terms",
      "title": "Regulamin Serwisu",
      "path": "/legal/terms",
      "version": "0.1",
      "updated_at": "2026-02-19"
    },
    {
      "id": "privacy",
      "title": "Polityka prywatności",
      "path": "/legal/privacy",
      "version": "0.1",
      "updated_at": "2026-02-19"
    }
  ]
}
```

## Kontrakty błędów (wspólne, proponowane)

### `404 Not Found` (przykład)

```json
{
  "error": "not_found",
  "message": "Dokument nie istnieje."
}
```

## Wymagania niefunkcjonalne (API — post-MVP)

- **Cache**: ETag + `Cache-Control` dla treści dokumentów (treści rzadko zmieniane).
- **Bezpieczeństwo**: dokumenty legal są publiczne, ale edycja/publikacja musi być admin-only po stronie backendu (jeśli powstanie CMS).
- **Spójność**: wersja/`updated_at` widoczne w odpowiedzi, aby UI mogło pokazywać metadane i wykrywać zmiany.

