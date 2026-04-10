# Admin Users List — wymagania

## Cel

Rozszerzyć istniejącą sekcję administracyjną o rzeczywisty widok **listy użytkowników** pod ścieżką `/admin/users`, aby administrator mógł przeglądać podstawowe informacje o wszystkich zarejestrowanych kontach w formie tabeli tylko do odczytu.

## Kontekst architektury (istniejące założenia)

- Aplikacja działa jako SPA w Angular + Angular Material, z wydzieloną sekcją `/admin/*` dostępną wyłącznie dla roli `admin`.
- Sekcja `Użytkownicy` istnieje już w nawigacji admina, ale obecnie ma charakter placeholdera.
- Role użytkowników są przenoszone w JWT jako claim `app_role` (`user`, `premium`, `admin`).
- Tabela `profiles` przechowuje `id`, `username`, `created_at` oraz dane powiązane 1:1 z `auth.users`.
- System logowania jest oparty o Supabase Auth, więc dane logowania i ostatniego logowania pochodzą z warstwy auth, a nie z `profiles`.
- Przepisy są miękko usuwane (`deleted_at`), dlatego przy liczeniu dorobku użytkownika należy liczyć tylko aktywne rekordy, chyba że przyszła decyzja produktowa wskaże inaczej.

## Zakres (MVP dla tego ficzera)

### Wymagania funkcjonalne

- **FR-ADM-USR-001 (lista użytkowników)**: Trasa `/admin/users` wyświetla tabelę wszystkich zarejestrowanych użytkowników dostępnych dla administratora.
- **FR-ADM-USR-002 (kolumny tabeli)**: Tabela zawiera następujące kolumny:
    - `ID użytkownika`
    - `Login`
    - `Username`
    - `Data rejestracji`
    - `Data ostatniego logowania`
    - `Liczba przepisów`
    - `Rola`
- **FR-ADM-USR-003 (mapowanie danych)**:
    - `ID użytkownika` pochodzi z `profiles.id` / `auth.users.id`
    - `Login` oznacza adres e-mail używany do logowania w Supabase Auth
    - `Username` pochodzi z `profiles.username`
    - `Data rejestracji` pochodzi z daty utworzenia konta
    - `Data ostatniego logowania` pochodzi z Supabase Auth
    - `Liczba przepisów` oznacza liczbę aktywnych przepisów utworzonych przez użytkownika
    - `Rola` odpowiada źródłu prawdy używanemu do nadawania claimu `app_role`
- **FR-ADM-USR-004 (sortowanie domyślne)**: Tabela jest domyślnie sortowana malejąco po `dacie rejestracji`, tak aby najnowsze konta były widoczne na górze.
- **FR-ADM-USR-005 (sortowanie dostępne w MVP)**: Administrator może zmieniać sortowanie przynajmniej po polach:
    - `Data rejestracji`
    - `Login`
    - `Data ostatniego logowania`
    - `Liczba przepisów`
- **FR-ADM-USR-006 (paginacja)**: Lista użytkowników jest stronicowana po stronie serwera. Domyślny rozmiar strony wynosi `25` rekordów.
- **FR-ADM-USR-007 (brak filtrowania)**: W MVP widok nie zawiera wyszukiwarki, filtrów ani segmentacji po roli/statusie.
- **FR-ADM-USR-008 (widok tylko do odczytu)**: Wiersze tabeli nie zawierają akcji typu edycja, blokowanie, zmiana roli, usunięcie konta ani przejście do szczegółów użytkownika.
- **FR-ADM-USR-009 (obsługa brakujących danych)**: Jeżeli użytkownik nigdy się nie logował lub Supabase nie zwraca daty ostatniego logowania, UI prezentuje czytelny stan pusty, np. `Nigdy`.
- **FR-ADM-USR-010 (spójność z layoutem admina)**: Widok `/admin/users` pozostaje osadzony w istniejącym layoucie sekcji administracyjnej z aktywną pozycją `Użytkownicy` w aside.
- **FR-ADM-USR-011 (ochrona dostępu)**: Cały widok i źródło danych są dostępne wyłącznie dla użytkownika z rolą `admin`.

### Poza zakresem (explicitly out-of-scope)

- Filtrowanie użytkowników.
- Wyszukiwanie użytkowników.
- Zmiana roli użytkownika z poziomu UI.
- Blokowanie, aktywacja lub dezaktywacja kont.
- Widok szczegółów użytkownika.
- Operacje masowe na użytkownikach.
- Eksport danych do CSV/XLSX.
- Pokazywanie statusu konta jako osobnej kolumny.

## User stories

### US-ADM-USR-001 — Przegląd listy użytkowników

Jako **administrator** chcę wejść do sekcji `/admin/users` i zobaczyć tabelę z podstawowymi danymi wszystkich kont, aby szybko ocenić strukturę bazy użytkowników bez przechodzenia do szczegółów.

**Kryteria akceptacji:**

- Po wejściu na `/admin/users` widzę tabelę użytkowników w sekcji administracyjnej.
- Tabela zawiera kolumny: `ID użytkownika`, `Login`, `Username`, `Data rejestracji`, `Data ostatniego logowania`, `Liczba przepisów`, `Rola`.
- Domyślne sortowanie ustawia najnowszych użytkowników na początku listy.
- Widok nie zawiera filtrów ani akcji modyfikujących dane.

### US-ADM-USR-002 — Sortowanie i paginacja tabeli

Jako **administrator** chcę sortować tabelę oraz przechodzić między stronami wyników, aby wygodnie przeglądać większą liczbę użytkowników.

**Kryteria akceptacji:**

- Widok otwiera się z domyślnym sortowaniem po `dacie rejestracji` malejąco.
- Mogę zmienić sortowanie po `loginie`, `dacie ostatniego logowania` oraz `liczbie przepisów`.
- Lista jest podzielona na strony i domyślnie pokazuje `25` rekordów.
- Zmiana strony zachowuje aktualny wybór sortowania.

### US-ADM-USR-003 — Ochrona danych administracyjnych

Jako **użytkownik bez uprawnień admina** nie chcę mieć dostępu do listy wszystkich użytkowników, aby dane administracyjne pozostały dostępne wyłącznie dla uprawnionych osób.

**Kryteria akceptacji:**

- Wejście na `/admin/users` bez roli `admin` kończy się przekierowaniem zgodnym z istniejącymi zasadami bezpieczeństwa.
- Backend nie zwraca listy użytkowników dla poprawnego tokena bez roli `admin`.
- Ukrycie linku w UI nie jest jedynym mechanizmem ochrony dostępu.

## Wymagania niefunkcjonalne

- **Bezpieczeństwo**: Lista użytkowników musi być dostarczana przez endpoint admin-only wykonywany po stronie backendu z uprawnieniami pozwalającymi bezpiecznie odczytać dane z Supabase Auth oraz agregacje z bazy.
- **Wydajność**: Paginacja i sortowanie powinny być realizowane po stronie serwera, aby uniknąć pobierania pełnej listy kont do przeglądarki.
- **Spójność UX**: Widok powinien korzystać ze wzorców tabel i paginacji zgodnych z Angular Material oraz z pozostałymi ekranami administracyjnymi.
- **Maintainability**: Kontrakt danych powinien być prosty i gotowy do późniejszego rozszerzenia o filtrowanie, szczegóły użytkownika lub akcje administracyjne bez łamania podstawowej struktury odpowiedzi.
