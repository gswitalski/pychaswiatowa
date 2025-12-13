# Zmiany: Publiczny Portal Przepisów (Public Recipes Portal)

## 1. Historyjki Użytkownika

### Nowe historyjki

**US-017: Landing dla gościa z publicznymi przepisami**
- **Opis:** Jako użytkownik niezalogowany, chcę wejść na stronę główną i od razu zobaczyć ciekawe publiczne przepisy oraz pole wyszukiwania, abym mógł szybko znaleźć inspirację i zrozumieć wartość aplikacji.
- **Kryteria akceptacji:**
    1. Wejście na adres `/` dla gościa wyświetla landing zawierający pole wyszukiwania oraz sekcje z publicznymi przepisami (np. Najnowsze, Popularne, Sezonowe).
    2. Każda karta przepisu zawiera co najmniej: zdjęcie (jeśli istnieje), nazwę oraz kategorię (jeśli przypisana).
    3. Kliknięcie w kartę publicznego przepisu przenosi do widoku szczegółów publicznego przepisu.
    4. Landing zawiera widoczne akcje "Zaloguj się" i "Zarejestruj się".
    5. Landing nie wyświetla przepisów o widoczności `Prywatny` ani `Współdzielony`.

**US-018: Wyszukiwanie publicznych przepisów (MVP: tylko tekst)**
- **Opis:** Jako użytkownik niezalogowany, chcę wyszukać publiczne przepisy po frazie tekstowej, abym mógł szybko znaleźć interesujące mnie propozycje.
- **Kryteria akceptacji:**
    1. Gość ma dostęp do pola wyszukiwania publicznych przepisów.
    2. Wyszukiwanie jest tekstowe i przeszukuje co najmniej: nazwę przepisu, składniki oraz tagi.
    3. Wyniki zawierają wyłącznie przepisy o widoczności `Publiczny`.
    4. Wyniki są stronicowane.
    5. Dla braku wyników wyświetlany jest czytelny komunikat i sugestia zmiany frazy.

**US-019: Przeglądanie szczegółów publicznego przepisu**
- **Opis:** Jako użytkownik niezalogowany, chcę wyświetlić pełne szczegóły publicznego przepisu w czytelnym układzie, abym mógł z niego korzystać bez konieczności zakładania konta.
- **Kryteria akceptacji:**
    1. Strona szczegółów publicznego przepisu wyświetla: nazwę, opis, zdjęcie, listę składników i listę kroków.
    2. Na widoku desktopowym składniki i kroki są wyświetlane obok siebie w dwóch kolumnach.
    3. Lista kroków jest numerowana w sposób ciągły i nie resetuje się po nagłówkach sekcji.
    4. Widoczne są kategoria oraz tagi (jeśli istnieją).
    5. Gość nie widzi akcji właściciela ("Edytuj", "Usuń"). Zamiast tego widzi zachętę do logowania/rejestracji.
    6. Strona jest dostępna pod publicznym, udostępnialnym adresem URL (SEO-friendly).

### Zmienione historyjki
Brak.

## 2. Widoki

### Zmienione widoki

**1. Landing Page**
- **Zmiana:** Zamiast wyłącznie marketingowego widoku dodano publiczny content: pole wyszukiwania i sekcje z publicznymi przepisami.

### Nowe widoki

**2. Publiczny katalog przepisów (Explore)**
- **Ścieżka:** `/explore`
- **Opis:** Lista publicznych przepisów z wyszukiwaniem tekstowym (MVP) i paginacją.

**3. Publiczne szczegóły przepisu**
- **Ścieżka:** `/explore/recipes/:id-:slug`
- **Opis:** Pełny podgląd publicznego przepisu. Brak akcji właściciela; widoczne CTA do logowania/rejestracji.

## 3. API

### Nowe endpointy

**GET /public/recipes**
- **Zmiana:** Nowy publiczny endpoint bez JWT, zwraca wyłącznie przepisy `PUBLIC`.
- **Query:** `page`, `limit`, `sort`, `q` (MVP: tylko tekst).

**GET /public/recipes/{id}**
- **Zmiana:** Nowy publiczny endpoint bez JWT, zwraca pełne szczegóły publicznego przepisu.
- **Uwagi:** Frontend może używać SEO-friendly URL z "slug", ale API pobiera dane po `id`.
