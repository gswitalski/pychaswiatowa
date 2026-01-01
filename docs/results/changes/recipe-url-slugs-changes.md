# Zmiany: Slugi w URL-ach przepisów (Recipe URL Slugs)

## 1. Historyjki użytkownika

### Nowe historyjki

**US-041: Kanoniczny link do przepisu z identyfikatorem i slugiem (publiczny i prywatny)**
- **Opis:** Jako użytkownik (gość lub zalogowany), chcę udostępniać link do przepisu w postaci zawierającej czytelną nazwę (slug), aby adres był przyjazny i jednoznaczny, a aplikacja zawsze prowadziła do kanonicznego URL.
- **Kryteria akceptacji (skrót):**
    1. Kanoniczny URL: `/explore/recipes/:id-:slug` oraz `/recipes/:id-:slug`.
    2. Wejście na `/explore/recipes/:id` i `/recipes/:id` normalizuje do kanonicznego URL.
    3. Wejście na URL z błędnym slugiem normalizuje do poprawnego sluga.
    4. Slug bez polskich znaków diakrytycznych, lowercase, separatory `-`, limit długości, fallback gdy pusty.

### Zmienione historyjki

**US-019: Przeglądanie szczegółów publicznego przepisu**
- **Zmiana:** Kanoniczna ścieżka została doprecyzowana jako `/explore/recipes/:id-:slug` (z normalizacją z `/explore/recipes/:id` oraz z błędnego sluga).

**US-020: Publiczne widoki w trybie zalogowanego (App Shell)**
- **Zmiana:** Doprecyzowanie, że publiczne szczegóły przepisu funkcjonują pod `/explore/recipes/:id-:slug`.

**US-024: Publiczne szczegóły przepisu bez sidebara**
- **Zmiana:** Doprecyzowanie, że ścieżka kanoniczna to `/explore/recipes/:id-:slug`, a `/explore/recipes/:id` pozostaje jako kompatybilność wsteczna (normalizacja).

## 2. Widoki

### Zmienione widoki

**3. Szczegóły przepisu (uniwersalny widok)**
- **Zmiana:** Ścieżka kanoniczna: `/explore/recipes/:id-:slug` oraz `/recipes/:id-:slug` (warianty bez sluga traktowane jako legacy i normalizowane).

### Nowe widoki

**3a. Normalizacja URL przepisu (techniczny handler)**
- **Ścieżka:** `/explore/recipes/:id` oraz `/recipes/:id` (handler wykonuje nawigację do kanonicznego URL z `replaceUrl=true`).
- **Opis:** Zapewnia kompatybilność wsteczną i kanoniczne linki oparte o aktualną nazwę przepisu.

## 3. API

### Nowe endpointy

**POST /utils/slugify** (Supabase Edge Function)
- **Zmiana:** Nowy endpoint pomocniczy do spójnego generowania sluga (lowercase, transliteracja PL diakrytyków, separatory `-`, limit długości, fallback).

### Zmienione endpointy

**GET /public/recipes/{id}**
- **Zmiana:** Doprecyzowanie kontraktu: frontend używa kanonicznego routingu `/explore/recipes/{id}-{slug}`; API nadal pobiera dane po `id`.

