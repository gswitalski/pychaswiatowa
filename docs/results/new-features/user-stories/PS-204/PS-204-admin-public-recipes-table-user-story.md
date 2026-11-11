# PS-204: Tabela przepisów publicznych w panelu administracyjnym

## Opis

Jako **administrator** (rola `admin`),
chcę **widzieć w panelu administracyjnym tabelę ze wszystkimi przepisami publicznymi** (z autorem, kategorią,
datą utworzenia i ocenami) **oraz móc szybko otworzyć wybrany przepis**,
aby **mieć przegląd treści publikowanych w aplikacji i ułatwić ich przyszłą moderację**.

Treść zgłoszenia: „table z listą wszystkich przepisów w panelu administracyjnym - widok dla administratora".

> **Świadoma decyzja zakresu:** słowo „wszystkie" w zgłoszeniu oznacza tu **wszystkie przepisy publiczne
> (`visibility = PUBLIC`), nieusunięte (`deleted_at IS NULL`)**. Przepisy prywatne (`PRIVATE`), udostępnione
> linkiem (`SHARED`) i usunięte są **celowo poza zakresem** (decyzja prywatnościowa: administrator nie
> przegląda cudzych treści, których autor nie opublikował).

---

## Kontekst

### Stan obecny (zweryfikowany w kodzie)

- Panel administracyjny (`src/app/pages/admin/`) ma dziś dwie pozycje nawigacji
  (`admin-navigation.config.ts`): „Dashboard" (`/admin/dashboard`) i „Użytkownicy" (`/admin/users`).
  Trasa `admin` jest chroniona przez `usernameCompleteMatchGuard` i `adminRoleMatchGuard`
  (`src/app/app.routes.ts`); dla gości istnieją przekierowania `admin`, `admin/dashboard` i `admin/users`
  do `/login?returnUrl=...`.
- Lista użytkowników (`GET /admin/users`, `supabase/functions/admin/`) to wzorzec dla tej historyjki:
  funkcja bazy `public.admin_get_users_page(...)` z `security definer`, `set row_security = off`
  i `grant execute ... to service_role`, paginacja (domyślnie 25, max 100), sortowanie z allowlistą
  po stronie serwera i deterministyczny tie-breaker. Frontend woła ją przez `AdminApiService`,
  kontrakty to `AdminUsersSortBy`, `GetAdminUsersQueryDto`, `AdminUserListItemDto`,
  `GetAdminUsersResponseDto` w `shared/contracts/types.ts`.
- Daty na liście użytkowników są formatowane `toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })`;
  długie ID są skracane (`buildDisplayId`: 8 znaków + `...` + 4 ostatnie).
- Widok `public.recipe_details` (migracja `20261027120000_create_recipe_ratings.sql`) wystawia m.in.
  `id`, `user_id`, `name`, `category_id`, `category_name`, `created_at`, `visibility`, `is_grill`,
  `is_termorobot`, `deleted_at`, `ratings_count` (liczba ocen) oraz `average_rating`
  (`round(avg(rating), 1)`, `NULL` gdy brak ocen). Widok filtruje `deleted_at IS NULL`.
- Przepis ma jedną kategorię (`category_id` → `categories.name`, opcjonalną) oraz widoczność
  `PRIVATE` / `SHARED` / `PUBLIC`. Szczegół przepisu jest dostępny pod `/explore/recipes/{id}`.
- RLS na `recipes`: zwykły użytkownik widzi własne przepisy i publiczne; administrator nie ma
  osobnej ścieżki odczytu — dlatego odczyt realizuje funkcja serwisowa, a nie zmiana RLS.

---

## Zakres

### W zakresie

- Nowa strona **„Przepisy publiczne"** w panelu admina pod trasą `/admin/recipes`, z tabelą przepisów
  `PUBLIC` bez usuniętych, z paginacją i sortowaniem.
- Nowa pozycja w sidebarze admina („Przepisy publiczne") oraz tytuł strony tak samo nazwany,
  z podtytułem wyjaśniającym, że przepisy prywatne i udostępnione linkiem nie są tu pokazywane.
- Nowy endpoint `GET /admin/recipes` (w istniejącej Edge Function `admin`) i funkcja bazy z uprawnieniami
  serwisowymi, wzorowana na `admin_get_users_page`.
- Rozszerzenie `AdminApiService`, kontraktów DTO (`shared/contracts/types.ts`) oraz testy jednostkowe.
- Stany ładowania, błędu („Spróbuj ponownie") i pustej listy — jak na liście użytkowników.
- Przekierowanie gościa z `/admin/recipes` na logowanie (spójnie z pozostałymi trasami admina).
- **Zabezpieczenie uprawnień:** migracja PS-204 odbiera `execute` rolom `public`, `anon`, `authenticated` nie
  tylko nowej funkcji `admin_get_recipes_page`, ale też istniejącej `admin_get_users_page` (zwracającej e-maile),
  pozostawiając `execute` wyłącznie dla `service_role`. Nie zmienia to działania panelu (wywołuje je klucz
  serwisowy) — wymagane potwierdzenie braku regresji listy użytkowników.
- **Zabezpieczenie zmiany roli:** ta sama migracja odbiera `execute` rolom `public`, `anon`, `authenticated`
  również funkcji `admin_update_user_role(uuid, text, uuid)` (zostaje `service_role`); wymagane potwierdzenie
  braku regresji zmiany roli z panelu. Pozostałe funkcje z niepełnym `revoke` — osobne zgłoszenie.

### Poza zakresem

- Przepisy `PRIVATE`, `SHARED` oraz usunięte (soft delete); ich ewentualne pokazanie w przyszłości.
- Wyszukiwanie, filtry (np. po autorze, kategorii, znacznikach) — tylko paginacja i sortowanie.
- Jakiekolwiek akcje modyfikujące (edycja, usuwanie, ukrywanie, zmiana widoczności) — tabela jest **tylko do odczytu**
  poza linkiem „Otwórz przepis".
- Moderacja treści i kafelek „Moderacja treści (wkrótce)" na dashboardzie — **dashboard bez zmian**.
- Kolumny: widoczność, data modyfikacji (wraz z sortowaniem po niej).
- Zmiany RLS dla zwykłych użytkowników oraz zmiany w widoku `recipe_details`.
- Zmiany logiki i działania `admin_get_users_page` — w zakresie jest wyłącznie odebranie `execute` rolom
  `public`, `anon`, `authenticated` (patrz „W zakresie").
- Odświeżanie w czasie rzeczywistym (lista może być nieaktualna do ręcznego odświeżenia).
- Testy E2E (Playwright) — proces obejmuje wyłącznie testy jednostkowe.

---

## Decyzje i założenia

### Decyzje użytkownika — runda 1

1. **Zakres danych:** tylko przepisy `PUBLIC` bez usuniętych (opis „wszystkie" = wszystkie publiczne;
   prywatne, `SHARED` i usunięte poza zakresem — świadoma decyzja prywatnościowa).
2. **Wyszukiwanie i filtry:** brak; tylko paginacja i sortowanie, jak na liście użytkowników.
3. **Akcje:** wyłącznie odczyt + link „Otwórz przepis" (`/explore/recipes/{id}`).
4. **Autor:** nazwa użytkownika + e-mail w drugiej linii komórki.
5. **Mobile:** tabela z poziomym przewijaniem, jak lista użytkowników (bez widoku kart).
6. **Nawigacja:** nowa pozycja w sidebarze admina, trasa `/admin/recipes`.

### Decyzje użytkownika — runda 2

7. **Kolumna „Widoczność":** usunięta (wszystkie wiersze są `PUBLIC`).
8. **Kolumna „Data modyfikacji":** usunięta wraz z sortowaniem po niej.
9. **Brak ocen:** dwie osobne kolumny — „Średnia ocena" (`—` gdy brak ocen) i „Liczba ocen" (`0`).
10. **Autor bez nazwy lub e-maila:** brak nazwy → tekst „Brak nazwy użytkownika" + e-mail; gdy oba pola puste →
    skrócone ID autora (ten sam format skrótu co `buildDisplayId` na liście użytkowników).
11. **Link „Otwórz przepis":** otwiera **nową kartę** z `rel="noopener"`.
12. **Nazwa:** pozycja menu i tytuł strony „Przepisy publiczne"; podtytuł wyjaśnia, że przepisy prywatne
    i udostępnione linkiem nie są pokazywane. Dashboard bez zmian.

### Decyzje użytkownika — planowanie funkcjonalne (rundy 1–2)

13. **Sortowanie po autorze:** autorzy bez nazwy użytkownika (`profiles.username IS NULL`) zawsze na końcu
    w obu kierunkach, w grupie rozstrzyganej po ID przepisu rosnąco; pozostali alfabetycznie po nazwie
    użytkownika (bez rozróżniania wielkości liter, polska kolejność alfabetyczna). E-mail ani ID autora
    nie biorą udziału w sortowaniu.
14. **„Bez ocen na końcu":** dotyczy wyłącznie kolumny „Średnia ocena". „Liczba ocen" sortuje się jak zwykła
    liczba (rosnąco `0, 1, 2…`; malejąco od największej; remis → ID rosnąco).
15. **Rozmiar strony:** selektor **25 / 50 / 100** (domyślnie 25); zmiana rozmiaru zachowuje aktywne
    sortowanie i wraca na stronę 1.
16. **Kolejność alfabetyczna:** polska kolacja ICU (`COLLATE "pl-x-icu"`) dla nazwy przepisu, autora
    i kategorii; dostępność kolacji weryfikuje plan API lokalnie i na produkcji; gdy jej brak — wariant
    zastępczy `lower()` + domyślna kolacja bazy z jawnie odnotowanym ograniczeniem (polskie znaki
    diakrytyczne mogą być sortowane niezgodnie z polskim alfabetem).
17. **Strona poza zakresem przy `totalItems > 0`:** UI automatycznie ładuje ostatnią dostępną stronę
    (jednokrotna korekta, bez pętli, z zachowaniem sortowania i rozmiaru strony); komunikat pustej listy
    pojawia się wyłącznie przy `totalItems = 0`.

### Ostateczne kolumny i sortowanie

| # | Kolumna | Treść | Sortowalna |
|---|---------|-------|------------|
| 1 | ID | liczbowe ID przepisu, w całości (bez skracania) | nie |
| 2 | Nazwa | nazwa przepisu | tak |
| 3 | Autor | nazwa użytkownika; w drugiej linii e-mail (reguły zastępcze: decyzja 10); sortowanie wg nazwy użytkownika — reguła w decyzji 13 (e-mail i ID autora nie są kluczem sortowania) | tak |
| 4 | Kategoria | jedno pole z nazwą kategorii; brak → `—` | tak |
| 5 | Data utworzenia | `toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })` | tak |
| 6 | Średnia ocena | liczba z 1 miejscem po przecinku; brak ocen → `—` | tak |
| 7 | Liczba ocen | liczba całkowita; brak → `0`; sortowana jak zwykła liczba (decyzja 14) | tak |
| 8 | Znaczniki | ikony/etykiety „Grill" i „Termorobot" (gdy ustawione) | nie |
| 9 | Akcja | „Otwórz przepis" | nie |

Sortowalnych kolumn jest **sześć**: nazwa, autor, kategoria, data utworzenia, średnia ocena, liczba ocen.

**Reguły sortowania:**
- Domyślnie: **data utworzenia malejąco**.
- Remis w każdym sortowaniu rozstrzyga **ID rosnąco** (stabilna paginacja).
- Przepisy **bez ocen** zawsze na końcu przy sortowaniu po **„Średniej ocenie"**, niezależnie od kierunku
  (średnia porównywana po wartości zaokrąglonej do 1 miejsca po przecinku). **„Liczba ocen"** sortuje się
  jak zwykła liczba (rosnąco `0, 1, 2…`, malejąco od największej), bez przesuwania przepisów z `0` ocen.
- Przepisy **z pustą kategorią** zawsze na końcu przy sortowaniu po kategorii, niezależnie od kierunku.
- Autorzy **bez nazwy użytkownika** (`profiles.username IS NULL`, także brak profilu) zawsze na końcu przy
  sortowaniu po autorze, niezależnie od kierunku; wśród nich porządek wyznacza ID przepisu rosnąco.
  Pozostali są sortowani po nazwie użytkownika.
- Sortowanie tekstu (nazwa, autor, kategoria) **bez rozróżniania wielkości liter i według polskiej kolejności
  alfabetycznej** (np. `a, ą, b, c, ć … l, ł, m … s, ś … z, ź, ż`); remisy rozstrzyga ID rosnąco.
- Sortowanie realizuje serwer na podstawie **allowlisty** pól; nieznane lub niepoprawne wartości `sort_by` /
  `sort_dir` (oraz niepoprawne `page` / `page_size`) są odrzucane błędem walidacji `VALIDATION_ERROR`
  (HTTP `400`) — **bez cichego przywracania wartości domyślnych**. Wartości domyślne (`created_at desc`,
  strona 1, rozmiar 25) stosuje się wyłącznie, gdy parametr został pominięty.

### Założenia (do potwierdzenia przez planistów, nie rozstrzygnięte przez użytkownika)

1. **Dostęp tylko dla admina:** guard na trasie (`adminRoleMatchGuard`) **oraz** weryfikacja roli w endpoincie;
   `401` → przekierowanie do logowania, `403` → komunikat o braku dostępu (jak w użytkownikach).
2. **Endpoint:** `GET /admin/recipes`; parametry `page` (całkowita ≥ 1 i nie większa niż największa bezpieczna
   liczba całkowita JavaScript — każda mniejsza wartość poza zakresem zwraca `200` z pustą listą; funkcja bazy
   przyjmuje numer strony jako liczbę 64-bitową), `page_size` (całkowita 1..100,
   domyślnie 25; selektor w UI oferuje 25 / 50 / 100), `sort_by` (allowlista sześciu pól), `sort_dir`
   (`asc` / `desc`). Walidacja Zod jak `AdminUsersQuerySchema`; błąd → `VALIDATION_ERROR` (HTTP `400`).
   Odpowiedź ma kształt jak `GetAdminUsersResponseDto`: `data`, `pagination`, `sorting` (faktycznie użyte
   wartości). Łączna liczba przepisów jest liczona niezależnie od wybranej strony, więc strona poza zakresem
   zwraca poprawne `totalItems` / `totalPages` i pustą listę `data`.
3. **Odczyt przez funkcję bazy z uprawnieniami serwisowymi** (`security definer`, `row_security = off`,
   `grant execute ... to service_role`) wzorowaną na `admin_get_users_page`; frontend wyłącznie przez
   `AdminApiService` → Edge Function (bez `supabase.from()` / `supabase.rpc()` we frontendzie).
4. **Filtr po stronie bazy:** `visibility = 'PUBLIC'` **i** `deleted_at IS NULL`; filtr nie jest parametrem
   wejściowym i nie może być obejściem (brak parametru zmieniającego widoczność).
5. **Oceny:** `ratings_count` i `average_rating` są agregowane z tabeli `recipe_ratings` **tą samą formułą co
   widok `recipe_details`** (`round(avg(rating)::numeric, 1)`, `NULL` bez ocen, `count(*)`) — bez zmiany
   widoku i bez odczytu z samego widoku; jedna definicja formuły, dwa miejsca użycia.
6. **Sortowanie po autorze:** zgodnie z decyzją 13 — po nazwie użytkownika (`profiles.username`), autorzy
   bez nazwy na końcu w obu kierunkach (w grupie wg ID przepisu rosnąco); sortowanie nie używa e-maila ani
   ID autora.
7. **Brak trwałości stanu widoku:** aktywne sortowanie, rozmiar i numer strony nie są zapisywane (ani w adresie
   URL, ani w pamięci przeglądarki); po odświeżeniu (F5) strona wraca do 25 / `created_at desc` / strona 1.
8. **Stany UI** (ładowanie, błąd z „Spróbuj ponownie", pusta lista) jak na liście użytkowników; podczas
   ponownego ładowania poprzednie dane pozostają widoczne (`opacity: 0.5`, bez białego overlayu).
9. **Kontrakty DTO** (m.in. `AdminRecipesSortBy`, `GetAdminRecipesQueryDto`, `AdminRecipeListItemDto`,
   `GetAdminRecipesResponseDto`) w `shared/contracts/types.ts`; `SortDirection` jest istniejącym typem.
10. **Brak zmian RLS** dla zwykłych użytkowników.
11. **Testy:** tylko jednostkowe (Vitest dla Angulara, `deno test` dla Edge Function), bez E2E.
12. **Aktualność:** lista może być nieaktualna do ręcznego odświeżenia (brak auto-refresh).

---

## Kryteria akceptacji

### Scenariusz 1: Wejście na stronę z menu (happy path)

- **Given**: Zalogowany `admin` jest w panelu administracyjnym.
- **When**: Klika pozycję „Przepisy publiczne" w sidebarze.
- **Then**:
    - Otwiera się `/admin/recipes`, a pozycja menu jest oznaczona jako aktywna.
    - Tytuł strony to „Przepisy publiczne", a podtytuł informuje, że przepisy prywatne i udostępnione
      linkiem nie są pokazywane.
    - Widoczna jest tabela z kolumnami: ID, Nazwa, Autor, Kategoria, Data utworzenia, Średnia ocena,
      Liczba ocen, Znaczniki, Akcja (bez kolumn „Widoczność" i „Data modyfikacji").
    - Pierwsza strona zawiera do 25 przepisów posortowanych wg daty utworzenia malejąco.

### Scenariusz 2: Zakres danych — tylko publiczne i nieusunięte

- **Given**: W bazie są przepisy `PUBLIC`, `PRIVATE`, `SHARED` oraz usunięty (soft delete) przepis `PUBLIC`.
- **When**: Admin otwiera `/admin/recipes`.
- **Then**:
    - W tabeli są wyłącznie przepisy `PUBLIC` z `deleted_at IS NULL`.
    - Przepisy `PRIVATE`, `SHARED` i usunięte nie pojawiają się na żadnej stronie ani w licznikach paginacji.
    - Przepis publiczny, który po otwarciu strony zmienił widoczność na `PRIVATE`, znika po odświeżeniu listy.

### Scenariusz 3: Zawartość wiersza

- **Given**: Publiczny przepis „Szarlotka" (ID 42), autor `Kasia_Gotuje` (`kasia@example.com`),
  kategoria „Deser", utworzony 3 maja 2026, średnia ocena 4,5 z 12 ocen, oznaczony jako grill.
- **When**: Wiersz jest wyświetlany.
- **Then**:
    - ID `42` w całości; nazwa „Szarlotka"; autor `Kasia_Gotuje` z `kasia@example.com` w drugiej linii.
    - Kategoria „Deser"; data w formacie `pl-PL` jak na liście użytkowników.
    - Średnia ocena `4,5`, liczba ocen `12`; znacznik „Grill" widoczny, brak znacznika „Termorobot".
    - Link „Otwórz przepis" jest dostępny.

### Scenariusz 4: Sortowanie

- **Given**: Admin widzi listę z domyślnym sortowaniem (data utworzenia malejąco).
- **When**: Klika nagłówek jednej z sześciu sortowalnych kolumn (np. „Nazwa"), a następnie klika go ponownie.
- **Then**:
    - Dane są sortowane po stronie serwera rosnąco, a po ponownym kliknięciu malejąco; strona wraca do pierwszej.
    - Nagłówki ID, Znaczniki i Akcja nie są sortowalne.
    - Wskaźnik sortowania (strzałka, `aria-sort`) odpowiada aktywnej kolumnie i kierunkowi.
    - Remisy są rozstrzygane po ID rosnąco, więc przejście między stronami nie duplikuje ani nie pomija wierszy.

### Scenariusz 5: Sortowanie po ocenach

- **Given**: Na liście są przepisy z ocenami i bez ocen (np. średnie `4,5`, `3,0`, `5,0` oraz przepisy
  z `0` ocen).
- **When**: Admin sortuje po „Średniej ocenie" albo po „Liczbie ocen", rosnąco albo malejąco.
- **Then**:
    - (a) **„Średnia ocena":** przepisy bez ocen (`—`) znajdują się **zawsze na końcu** (w obu kierunkach);
      pozostałe są uporządkowane po wartości średniej (rosnąco lub malejąco); remis (także wśród
      przepisów bez ocen) rozstrzyga ID rosnąco.
    - (b) **„Liczba ocen":** sortowanie jak zwykła liczba — rosnąco `0, 1, 2…` (przepisy z `0` ocen
      **na początku**), malejąco od największej liczby (przepisy z `0` ocen na końcu); remis rozstrzyga
      ID rosnąco. Przepisy bez ocen nie są przesuwane na koniec w kierunku rosnącym.

### Scenariusz 6: Sortowanie po kategorii — pusta kategoria na końcu

- **Given**: Część przepisów nie ma kategorii.
- **When**: Admin sortuje po „Kategorii" rosnąco lub malejąco.
- **Then**: Przepisy bez kategorii (`—`) są zawsze na końcu; kategorie są porównywane bez rozróżniania
  wielkości liter i według polskiej kolejności alfabetycznej; remis rozstrzyga ID rosnąco.

### Scenariusz 6a: Sortowanie po autorze

- **Given**: Na liście są przepisy autorów z nazwami (np. `ala`, `Basia`, `Łukasz`, `Zofia`) oraz autorów
  bez nazwy użytkownika (brak nazwy lub brak profilu).
- **When**: Admin sortuje po „Autorze" rosnąco albo malejąco.
- **Then**:
    - Autorzy z nazwą są uporządkowani po nazwie użytkownika, bez rozróżniania wielkości liter i według
      polskiej kolejności alfabetycznej (rosnąco lub malejąco); remis rozstrzyga ID przepisu rosnąco.
    - Przepisy autorów **bez nazwy użytkownika** są **zawsze na końcu** (w obu kierunkach), uporządkowane
      po ID przepisu rosnąco; e-mail ani ID autora nie wpływają na porządek.

### Scenariusz 7: Paginacja i rozmiar strony

- **Given**: W systemie jest więcej niż 25 przepisów publicznych.
- **When**: Admin przechodzi na kolejną stronę lub zmienia rozmiar strony w selektorze (opcje 25 / 50 / 100;
  domyślnie 25).
- **Then**:
    - Wyświetlane są kolejne wiersze zgodnie z aktywnym sortowaniem; łączna liczba i liczba stron wynikają
      z liczby przepisów publicznych.
    - Zmiana sortowania wraca na pierwszą stronę.
    - Zmiana rozmiaru strony zachowuje aktywne sortowanie i **wraca na stronę 1**.
    - Po odświeżeniu przeglądarki (F5) widok wraca do 25 / `created_at desc` / strona 1.

### Scenariusz 8: Brak ocen i brak kategorii w wierszu

- **Given**: Przepis publiczny bez ocen i bez kategorii.
- **When**: Wiersz jest wyświetlany.
- **Then**: „Średnia ocena" to `—`, „Liczba ocen" to `0`, „Kategoria" to `—`.

### Scenariusz 9: Autor bez nazwy lub e-maila

- **Given**: Trzy przepisy: (a) autor z e-mailem, ale bez nazwy użytkownika; (b) autor z nazwą i bez e-maila;
  (c) autor bez nazwy i bez e-maila.
- **When**: Wiersze są wyświetlane.
- **Then**:
    - (a) pierwsza linia „Brak nazwy użytkownika", druga linia e-mail.
    - (b) pierwsza linia nazwa, druga linia pusta (bez tekstu zastępczego e-maila).
    - (c) skrócone ID autora (np. `1a2b3c4d...ef01`).

### Scenariusz 10: Link „Otwórz przepis"

- **Given**: Admin widzi wiersz przepisu o ID 42.
- **When**: Klika „Otwórz przepis".
- **Then**:
    - Otwiera się **nowa karta** z `/explore/recipes/42`; link ma `target="_blank"` i `rel="noopener"`.
    - Karta panelu admina pozostaje bez zmian (zachowane sortowanie i strona).
    - Link ma czytelną etykietę dla czytnika ekranu (np. z nazwą przepisu).

### Scenariusz 11: Stany ładowania, błędu i pustej listy

- **Given**: (a) trwa pobieranie; (b) endpoint zwraca błąd (np. `500`/brak sieci); (c) brak przepisów
  publicznych (`totalItems = 0`); (d) żądana strona leży poza zakresem, a przepisy publiczne istnieją
  (`totalItems > 0`, np. po zmniejszeniu liczby przepisów między pobraniami).
- **When**: Strona jest wyświetlana.
- **Then**:
    - (a) widoczny wskaźnik ładowania; przy odświeżaniu poprzednie dane zostają widoczne z `opacity: 0.5`.
    - (b) komunikat błędu z przyciskiem „Spróbuj ponownie", który ponawia pobranie z bieżącymi parametrami.
    - (c) komunikat o pustej liście (jak w użytkownikach), bez tabeli z pustymi wierszami — **wyłącznie
      gdy `totalItems = 0`**.
    - (d) UI **automatycznie ładuje ostatnią dostępną stronę** (jednokrotna korekta, bez pętli;
      zachowuje aktywne sortowanie i rozmiar strony); komunikat pustej listy nie jest wtedy pokazywany.

### Scenariusz 12: Dostęp — role i goście

- **Given**: Użytkownik o roli `user` lub `premium`, albo niezalogowany gość.
- **When**: Wchodzi na `/admin/recipes` lub wywołuje `GET /admin/recipes`.
- **Then**:
    - `user`/`premium` nie wchodzą na trasę (guard) i nie widzą pozycji w sidebarze; wywołanie endpointu
      zwraca `403`.
    - Gość jest przekierowany na `/login?returnUrl=%2Fadmin%2Frecipes`; endpoint bez ważnego tokenu zwraca `401`.
    - Wygaśnięcie sesji podczas pracy (`401`) → przekierowanie do logowania; `403` → komunikat o braku dostępu.

### Scenariusz 13: Responsywność (mobile)

- **Given**: Szerokość okna < 600 px.
- **When**: Admin otwiera `/admin/recipes`.
- **Then**: Tabela zachowuje wszystkie kolumny i jest przewijana **poziomo** (bez przełączania na karty
  i bez ucinania treści); nagłówek strony, podtytuł i paginacja pozostają czytelne i dostępne dotykowo.

### Scenariusz 14: Brak regresji

- **Given**: Zmiana jest wdrożona.
- **When**: Admin korzysta z dashboardu i listy użytkowników; zwykły użytkownik korzysta z listy przepisów i Explore.
- **Then**:
    - Dashboard, kafelek „Moderacja treści (wkrótce)" i lista użytkowników działają i wyglądają jak dotąd.
    - Uprawnienia i widoczność przepisów dla zwykłych użytkowników (RLS) nie zmieniają się.
    - Lista użytkowników (`GET /admin/users`) działa tak samo mimo odebrania `execute` rolom `public`, `anon`,
      `authenticated` funkcji `admin_get_users_page`; wywołanie tej funkcji przez zwykłego użytkownika lub gościa
      przez publiczne API bazy jest odrzucane.

---

## Przypadki brzegowe

| # | Przypadek | Oczekiwane zachowanie |
|---|-----------|-----------------------|
| 1 | `page_size` > 100, < 1 lub nienumeryczny; `page` < 1, nienumeryczny lub większy niż największa bezpieczna liczba całkowita JavaScript (`Number.MAX_SAFE_INTEGER`) | `VALIDATION_ERROR` (HTTP `400`), spójnie z `GET /admin/users`; **bez cichego przywracania wartości domyślnych** |
| 2 | Nieznane `sort_by` / `sort_dir` (np. `visibility`, `updated_at`) | `VALIDATION_ERROR` (HTTP `400`) — allowlista; brak wstrzyknięcia SQL; bez cichego powrotu do `created_at desc` (to zachowanie dotyczy wyłącznie pominiętych parametrów oraz drugiej linii obrony w SQL) |
| 3 | Strona poza zakresem (`page` > liczba stron, także np. `page = 3000000000`, o ile nie przekracza bezpiecznej liczby całkowitej JavaScript) przy `totalItems > 0` | API zwraca `200` (nigdy `500`) z pustą listą `data` z poprawnymi `totalItems` / `totalPages`; UI jednokrotnie automatycznie ładuje ostatnią dostępną stronę (bez pętli, zachowuje sortowanie i rozmiar strony); komunikat pustej listy tylko gdy `totalItems = 0`; UI nie wpada w błąd |
| 4 | Przepis zmienia widoczność lub zostaje usunięty po załadowaniu listy | Lista bywa nieaktualna do odświeżenia; link do przepisu może zwrócić standardowy komunikat „brak dostępu / nie znaleziono" widoku przepisu |
| 5 | Admin otwiera link do przepisu publicznego innego autora | Widok szczegółu przepisu otwiera się według zwykłych reguł dla przepisów `PUBLIC` |
| 6 | Wiele przepisów z identyczną nazwą, datą lub oceną | Stały porządek dzięki tie-breakerowi ID rosnąco; brak duplikatów i luk między stronami |
| 7 | Nazwa przepisu / autora zawiera znaki HTML (`<b>x</b>`, `&amp;`) | Wyświetlane jako zwykły tekst |
| 8 | Bardzo długa nazwa przepisu lub e-mail autora | Nie rozpycha układu ponad możliwości poziomego przewijania; pełna treść dostępna (np. zawijanie lub tooltip) |
| 9 | Autor usunięty lub bez profilu | Brak błędu; zastosowanie reguł zastępczych (decyzja 10), bez gubienia wiersza przepisu |
| 10 | Średnia ocena (np. `4.0`, `4.5`) | Zawsze 1 miejsce po przecinku w formacie `pl-PL` (`4,0`, `4,5`); `null` → `—`, nigdy `0` ani `NaN` |
| 11 | Znaczniki: grill i termorobot jednocześnie / żaden | Oba znaczniki widoczne razem / pusta komórka; znaczniki mają etykietę tekstową dostępną dla czytnika ekranu |
| 12 | Nieprawidłowa lub brakująca data utworzenia | Wartość zastępcza (jak `formatDateLabel` na liście użytkowników), bez przerwania renderowania |
| 13 | Szybkie wielokrotne zmiany sortowania/strony | Aktualny jest wynik ostatniego żądania; spóźniona odpowiedź poprzedniego nie nadpisuje stanu |
| 14 | Rozmiar tabeli rośnie (kilka tysięcy publicznych przepisów) | Paginacja i sortowanie po stronie serwera; wydajność agregacji ocen do oceny przez planerów |
| 15 | Bezpośrednie wejście na `/admin/recipes` (odświeżenie F5) | Strona ładuje się poprawnie po zalogowaniu; brak 404; stan wraca do 25 / `created_at desc` / strona 1 |
| 16 | Nazwy z polskimi znakami i różną wielkością liter (np. `ćma`, `Czosnek`, `Łosoś`, `lody`, `Śledź`, `sałatka`, `Żurek`, `zupa`) | Kolejność zgodna z polskim alfabetem, bez rozróżniania wielkości liter (`Czosnek` przed `ćma`, `lody` przed `Łosoś`, `sałatka` przed `Śledź`, `zupa` przed `Żurek`); remisy ID rosnąco. Jeśli kolacja `pl-x-icu` jest niedostępna w środowisku, obowiązuje wariant zastępczy z jawnie odnotowanym ograniczeniem (decyzja 16) |

---

## Wymagania niefunkcjonalne

- **Bezpieczeństwo:** weryfikacja roli `admin` w endpoincie niezależnie od guarda; funkcja bazy dostępna
  tylko dla `service_role`; filtr `PUBLIC` + `deleted_at IS NULL` wymuszony w bazie, nie w kliencie;
  e-mail autora jest daną osobową — wyświetlany tylko adminowi (admin już widzi e-maile na liście użytkowników).
- **Architektura:** frontend tylko przez `AdminApiService` → Edge Function `admin` (rozdział `index.ts` /
  handlery / serwisy, walidacja Zod, ujednolicony błąd `{ code, message, details }`); brak bezpośrednich
  zapytań do tabel z frontendu.
- **Frontend:** komponenty standalone, `OnPush`, sygnały, `@if` / `@for`, selektor z prefiksem `pych`,
  zmienne motywu Material (`--mat-sys-*`), lazy loading trasy, wcięcie 4 znaki.
- **Dostępność (WCAG 2.1 AA):** `aria-sort` w nagłówkach sortowalnych, etykiety akcji, obsługa klawiaturą,
  widoczny fokus.
- **Wydajność:** paginacja i sortowanie po stronie bazy; brak pobierania wszystkich przepisów na raz.
- **Zgodność wsteczna:** brak zmian w istniejących endpointach, DTO ani RLS; jedyna zmiana istniejącego obiektu
  bazy to odebranie `execute` rolom `public`/`anon`/`authenticated` funkcji `admin_get_users_page`
  (bez zmiany jej treści i sygnatury).

---

## Definicja ukończenia (Definition of Done)

- [ ] Strona `/admin/recipes` („Przepisy publiczne") z tytułem, podtytułem i tabelą w ustalonych kolumnach
- [ ] Nowa pozycja w sidebarze admina oraz trasa w `admin.routes.ts`; przekierowanie gościa na logowanie
- [ ] Endpoint `GET /admin/recipes` (paginacja: domyślnie 25, `page_size` 1..100, sortowanie z allowlistą,
      tie-breaker ID rosnąco, domyślnie `created_at desc`) + migracja z funkcją bazy `service_role`
      (`PUBLIC`, `deleted_at IS NULL`); błędne `page` / `page_size` / `sort_by` / `sort_dir` →
      `VALIDATION_ERROR` (HTTP `400`), bez cichego przywracania domyślnych
- [ ] Selektor rozmiaru strony 25 / 50 / 100 (domyślnie 25); zmiana rozmiaru zachowuje sortowanie i wraca
      na stronę 1
- [ ] Reguła „bez ocen na końcu" dla **„Średniej oceny"**, „Liczba ocen" sortowana jak zwykła liczba,
      „pusta kategoria na końcu" i „autor bez nazwy na końcu" — w obu kierunkach sortowania
- [ ] Polska kolejność alfabetyczna (nazwa, autor, kategoria) bez rozróżniania wielkości liter; dostępność
      `pl-x-icu` zweryfikowana lokalnie i na produkcji (lub odnotowany wariant zastępczy)
- [ ] Strona poza zakresem: poprawne `totalItems` / `totalPages` z API; UI jednokrotnie ładuje ostatnią
      stronę; komunikat pustej listy tylko przy `totalItems = 0`
- [ ] Kontrakty DTO w `shared/contracts/types.ts`; metoda w `AdminApiService`
- [ ] Autor: nazwa + e-mail w drugiej linii oraz reguły zastępcze („Brak nazwy użytkownika", skrócone ID)
- [ ] Link „Otwórz przepis" w nowej karcie z `rel="noopener"`
- [ ] Stany ładowania, błędu („Spróbuj ponownie") i pustej listy; poziome przewijanie na mobile
- [ ] Dostęp tylko dla admina (guard + weryfikacja w endpoincie; `401` → logowanie, `403` → brak dostępu)
- [ ] Dashboard, lista użytkowników i RLS dla zwykłych użytkowników bez zmian w działaniu
- [ ] Migracja odbiera `execute` rolom `public`/`anon`/`authenticated` funkcjom `admin_get_recipes_page` i
      `admin_get_users_page`; `has_function_privilege` → `false` / `false` / `true` (`anon` / `authenticated` /
      `service_role`) dla obu funkcji, lista użytkowników nadal działa (lokalnie i po wdrożeniu)
- [ ] Migracja odbiera `execute` rolom `public`/`anon`/`authenticated` także funkcji `admin_update_user_role`;
      `has_function_privilege` → `false` / `false` / `true`; zmiana roli z panelu nadal działa
- [ ] Migracja nie zawiera instrukcji `drop` obiektów spoza repozytorium; weryfikacja na czystej bazie lokalnej
      (`supabase db reset`) i sprawdzenie zdalnej historii migracji przed merge
- [ ] `page` większa niż `Number.MAX_SAFE_INTEGER` → `400`; duża, ale bezpieczna wartość (np. `3000000000`) → `200`
      z pustą listą i poprawnymi licznikami (funkcja bazy z 64-bitowym numerem strony)
- [ ] Opcjonalny test kolejności na lokalnej bazie (`deno test`; uruchamiany wyłącznie dla adresu lokalnego
      `localhost` / `127.0.0.1`, dane z unikalnym prefiksem, sprzątanie po teście); brak lokalnej bazy →
      status `NIE_WYKONANO` (nie `PASS`) i weryfikacja manualna
- [ ] Testy jednostkowe:
    - Vitest: komponent strony i tabeli (kolumny, formatowanie daty i ocen, `—` / `0`, reguły autora,
      link z `target`/`rel`, sortowanie i paginacja, **selektor 25 / 50 / 100, wymuszenie strony 1 przy
      zmianie rozmiaru, zachowanie sortowania, automatyczna jednokrotna korekta strony poza zakresem**,
      stany ładowania/błędu/pustej listy), `AdminApiService` (parametry zapytania, mapowanie odpowiedzi),
      konfiguracja nawigacji i trasa;
    - `deno test`: handler/serwis `GET /admin/recipes` (walidacja `page_size` 1..100, błędny `sort_by` /
      `sort_dir` → `VALIDATION_ERROR`, `401`/`403`, mapowanie odpowiedzi, przepisy bez ocen i autorzy bez
      nazwy na końcu, `totalItems` / `totalPages` dla strony poza zakresem, polska kolejność alfabetyczna
      jeśli kolacja jest dostępna, brak przepisów nie-`PUBLIC` w mocku wywołania).
- [ ] Weryfikacja manualna lokalnie (konto admina z `.env.local`): sortowanie wszystkich sześciu kolumn,
      brak ocen/kategorii, paginacja, autor bez nazwy, link w nowej karcie, szerokość < 600 px,
      konto `user` bez dostępu
- [ ] Lint (`npm run lint`) bez nowych błędów i `npm run build` zakończone sukcesem
      (status zapisany jawnie: `PASS`/`FAIL`, nie `NIE_WYKONANO`)
- [ ] Pełny zestaw testów Vitest (`npm run test`) oraz `deno test` dla funkcji `admin` przechodzą (`PASS`)
- [ ] Code review API i widoków zakończone pozytywnie (artefakty zgodne z `ps-feature-conventions`
      lub jawnie `BEZ_REVIEW` z powodem)
- [ ] `docs/results/project-summary.md` zaktualizowany po akceptacji review (etap summary)

---

## Otwarte kwestie

- **Przyszły zakres:** czy w przyszłości pokazywać przepisy `PRIVATE` / `SHARED` / usunięte oraz dodać
  moderację (ukrywanie, usuwanie) — wymaga osobnej decyzji prywatnościowej i osobnej historyjki.
- **Dane osobowe:** e-mail autora jest daną osobową; admin już widzi e-maile na liście użytkowników,
  ale warto potwierdzić zgodność z polityką prywatności.
- **Wydajność:** agregacja ocen z `recipe_ratings` i sortowanie (w tym po polskiej kolacji) przy większej
  skali (rząd ~10 tys. przepisów publicznych) — ocena i ryzyka w planie API oraz planie wdrożenia; nowe
  indeksy tylko na podstawie dowodu (`EXPLAIN ANALYZE`).
- **Dostępność kolacji `pl-x-icu`:** do potwierdzenia lokalnie i na produkcji przed wdrożeniem (plan
  wdrożenia); przy braku — wariant zastępczy `lower()` + domyślna kolacja z odnotowanym ograniczeniem.

---

## Powiązania

- **Jira:** PS-204 — Tabela z listą przepisów publicznych w panelu administracyjnym
- **Wzorzec:** lista użytkowników admina (`GET /admin/users`, `admin_get_users_page`,
  `src/app/pages/admin/admin-users/`)
- **Powiązane elementy kodu:**
    - `src/app/pages/admin/admin.routes.ts`, `src/app/pages/admin/admin-layout/admin-navigation.config.ts`
    - `src/app/app.routes.ts` — przekierowania gości dla tras `admin/*`
    - `src/app/core/services/admin-api.service.ts`
    - `supabase/functions/admin/` — handlery, serwisy, typy i testy
    - `supabase/migrations/20260410120000_create_admin_get_users_page_rpc.sql` — wzorzec funkcji bazy
    - `supabase/migrations/20261027120000_create_recipe_ratings.sql` — `recipe_details` (`ratings_count`, `average_rating`)
- **Kontrakty (nowe):** `AdminRecipesSortBy`, `GetAdminRecipesQueryDto`, `AdminRecipeListItemDto`,
  `GetAdminRecipesResponseDto` w `shared/contracts/types.ts`
- **Poza zakresem:** dashboard admina, kafelek „Moderacja treści (wkrótce)", RLS zwykłych użytkowników,
  treść i działanie `admin_get_users_page` (zmieniane są tylko jej uprawnienia wywołania)

---

## Historia zmian

| Data | Etap | Zmiana | Powód |
|------|------|--------|-------|
| 2026-11-11 | plan funkcjonalny | Reguły sortowania: „bez ocen na końcu" obowiązuje tylko dla „Średniej oceny"; „Liczba ocen" sortowana jak zwykła liczba (rosnąco 0,1,2…, malejąco od największej, remis ID rosnąco). Nowa decyzja 14. | Odpowiedź użytkownika (runda 1, pyt. 2, opcja B) — poprzednie brzmienie mogło przesuwać przepisy z 0 ocen na koniec także dla liczby ocen. |
| 2026-11-11 | plan funkcjonalny | Scenariusz 5 przepisany: punkt (a) „Średnia ocena" i osobny punkt (b) „Liczba ocen". | Spójność ze zmianą reguł sortowania ocen. |
| 2026-11-11 | plan funkcjonalny | Usunięto założenie 7 (dosłowna interpretacja „bez ocen na końcu" dla obu kolumn) — w jego miejsce założenie o braku trwałości stanu widoku (F5 → 25 / `created_at desc` / strona 1); usunięto punkt „Interpretacja reguły…" z Otwartych kwestii. | Założenie 7 sprzeczne z decyzją 14; kwestia rozstrzygnięta przez użytkownika. |
| 2026-11-11 | plan funkcjonalny | Założenie 5 (oceny): agregacja z `recipe_ratings` tą samą formułą co `recipe_details` (`round(avg(rating)::numeric,1)`, `NULL` bez ocen, `count(*)`), zamiast „pochodzą z `recipe_details`". | Funkcja bazy czyta tabele, a nie widok; potrzebna jednoznaczna formuła i jej źródło (ustalenia z kodu). |
| 2026-11-11 | plan funkcjonalny | Autor: sortowanie wg nazwy użytkownika; autorzy bez nazwy (`profiles.username IS NULL`) zawsze na końcu w obu kierunkach, w grupie wg ID przepisu rosnąco; e-mail i ID autora nie są kluczem. Zmieniono założenie 6, tabelę kolumn (kol. 3), reguły sortowania, dodano decyzję 13 i scenariusz 6a. | Odpowiedź użytkownika (runda 1, pyt. 1, opcja C); poprzednie założenie 6 sortowało po e-mailu/ID. |
| 2026-11-11 | plan funkcjonalny | Selektor rozmiaru strony 25 / 50 / 100 (domyślnie 25), zmiana rozmiaru zachowuje sortowanie i wraca na stronę 1: założenie 2, scenariusz 7, DoD, decyzja 15. | Odpowiedź użytkownika (runda 1, pyt. 3, opcja A) — poprzednio rozmiar „maksymalnie 100" bez zdefiniowanego sterowania. |
| 2026-11-11 | plan funkcjonalny | Przypadki brzegowe 1 i 2, reguły sortowania, założenie 2 i DoD: błędne `page` / `page_size` / `sort_by` / `sort_dir` → `VALIDATION_ERROR` (HTTP `400`), bez cichego przywracania domyślnych (domyślne tylko dla pominiętych parametrów); `page_size` 1..100. | Spójność z `GET /admin/users` (Zod `AdminUsersQuerySchema`) i zakaz cichych korekt; poprzedni zapis dopuszczał „powrót do domyślnych". |
| 2026-11-11 | plan funkcjonalny | Opis kolumn: „Liczba ocen" sortowana jak liczba, „Autor" wg reguły z decyzji 13 (tabela kolumn). Dodano decyzje 13–17 w sekcji „Decyzje użytkownika — planowanie funkcjonalne". | Czytelność i spójność opisu kolumn z nowymi regułami. |
| 2026-11-11 | plan funkcjonalny | Polska kolejność alfabetyczna: nowe brzmienie reguły sortowania tekstu („bez rozróżniania wielkości liter i według polskiej kolejności alfabetycznej…; remisy ID rosnąco"), scenariusz 6, nowy przypadek brzegowy 16 (polskie znaki), decyzja 16, DoD i Otwarte kwestie (dostępność `pl-x-icu`, wariant zastępczy). | Odpowiedź użytkownika (runda 2, pyt. 1, opcja B) — sama niewrażliwość na wielkość liter nie zapewnia polskiej kolejności znaków diakrytycznych. |
| 2026-11-11 | plan funkcjonalny | Strona poza zakresem: scenariusz 11 — dodano podpunkt (d) (automatyczna jednokrotna korekta na ostatnią stronę), poprawiono (c) (pusta lista tylko gdy `totalItems = 0`); przypadek brzegowy 3 przepisany; decyzja 17; założenie 2 (łączna liczba liczona niezależnie od strony). | Odpowiedź użytkownika (runda 2, pyt. 2, opcja A) — poprzednio „pusta lista" dla strony poza zakresem była nierozróżnialna od braku danych. |
| 2026-11-11 | plan funkcjonalny | DoD — testy: `deno test` (walidacja `page_size` 1..100, błędny `sort_by`/`sort_dir`, bez ocen i autor bez nazwy na końcu, `totalItems` poza zakresem, polska kolejność jeśli kolacja dostępna) oraz Vitest (selektor 25/50/100, wymuszenie strony 1, zachowanie sortowania, auto-korekta strony poza zakresem); nowe punkty DoD dla nowych reguł. Przypadek brzegowy 15 uzupełniony o stan po F5. | Pokrycie testami nowych reguł z decyzji 13–17. |
| 2026-11-11 | plany implementacji | Limit `page`: funkcja bazy z 64-bitowym numerem strony; walidacja odrzuca (`400`) tylko `page` > `Number.MAX_SAFE_INTEGER`, mniejsze wartości poza zakresem → `200` z pustą listą. Zmieniono założenie 2, przypadki brzegowe 1 i 3, DoD. | Odpowiedź użytkownika (plany implementacji, pyt. 1, opcja A) — przy 32-bitowym numerze strony `page=3000000000` dawało `500`. |
| 2026-11-11 | plany implementacji | DoD: opcjonalny test kolejności `deno test` na lokalnej bazie (tylko adres `localhost`/`127.0.0.1`, unikalny prefiks danych, sprzątanie; brak bazy → `NIE_WYKONANO`). | Odpowiedź użytkownika (pyt. 2, opcja A) — atrapy klienta nie sprawdzają `ORDER BY`. |
| 2026-11-11 | plany implementacji | Zakres: migracja PS-204 odbiera `execute` rolom `public`/`anon`/`authenticated` także funkcji `admin_get_users_page` (bez zmiany treści); zmieniono sekcje „W zakresie", „Poza zakresem", scenariusz 14, wymaganie zgodności wstecznej, DoD i „Powiązania". | Odpowiedź użytkownika (pyt. 3, opcja B) — możliwy wyciek e-maili użytkowników przez publiczne API bazy; zamknięcie luki od razu. |
| 2026-11-11 | implementacja API (review r1) | Zakres: migracja odbiera `execute` rolom `public`/`anon`/`authenticated` także funkcji `admin_update_user_role`; usunięto z migracji `drop function` obiektu spoza repozytorium; weryfikacja na czystej bazie (`db reset`). Sekcja „W zakresie" i DoD. | Review `api-db` (możliwe przejęcie roli admina przez publiczne API bazy; powtarzalność migracji) i decyzja użytkownika (opcja B, `db reset` z kopią danych). |
