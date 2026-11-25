# PS-116: RLS przepisów i polityki widoku przy grupach wariantów

## Opis

Jako **zespół PychaŚwiatowa**,
chcę **włączyć RLS na `recipes` i wykonać widok `recipe_details` z uprawnieniami wywołującego**,
aby **zalogowany użytkownik czytał tylko własne nieusunięte przepisy oraz cudze nieusunięte publiczne, a zapis wiersza nie szedł z jego konta z pominięciem limitu wariantów**.

Źródło: `docs/variants-conception.md` (sekcja 5, „RLS i widoczność”; sekcja 8, odchylenie 2).
PS-108–PS-112 i PS-115 są wdrożone i tego domknięcia nie zawierają.

---

## Kontekst (stan sprawdzony w migracjach i kodzie)

- `20251125121000_disable_rls_for_development.sql` wyłącza RLS na `recipes` i zdejmuje polityki.
  `20260210153000_update_public_recipe_collection_rls.sql` odtwarza tylko odczyt (własny albo `PUBLIC`,
  bez usuniętych); przy wyłączonym RLS nie działa. W bazie z migracji nie ma polityk zapisu.
- `docs/scripts/enable_rls_for_production.sql` (stan produkcji nie jest w repozytorium) włącza RLS,
  tworzy cztery polityki `recipes` (w tym zapis właściciela), oczekuje dokładnie czterech i przy drugim
  uruchomieniu nie tworzy polityk ponownie. Ustawia też `security_invoker` na widoku.
- Ostatni `recipe_details` (`20261121160000`) nie ma `security_invoker`. `average_rating` i `ratings_count`
  są podzapytaniem do `recipe_ratings` (RLS: zalogowany widzi tylko własny głos). Bez `security_invoker`
  agregat liczy się uprawnieniami właściciela widoku.
- Triggery PS-108 kopiują na przepis właściciela, widoczność i `deleted_at`. RLS `recipe_families` zostaje.
- Rolą serwisową (omija RLS) idą już: zapis wariantów, tworzenie i edycja, panel administratora, Eksploruj,
  strony publiczne i plan. Kluczem użytkownika: wyszukiwanie, kolekcje, sprawdzenie przepisu przy obrazie
  AI i normalizacji, odczyt widoku w `GET /recipes/{id}` oraz zapis `image_path`.
- `enqueue_normalized_ingredients_refresh` jest `security definer`, wołana kluczem użytkownika (`auth.uid()`,
  właściciel, brak usunięcia); aktualizuje status normalizacji i nie tworzy wariantu.
- RLS na `profiles`, `tags`, `collections`, `recipe_tags` i `recipe_collections` jest wyłączone.

---

## Zakres

### W zakresie

1. Migracja włącza RLS na `recipes` w każdej bazie z migracji, także lokalnej: gdy RLS jest wyłączone
   i gdy skrypt zdążył utworzyć stare polityki. Zdejmuje wszystkie polityki tej tabeli i zostawia jedną
   politykę odczytu dla `authenticated` (R1–R2).
2. Krok przepisów w skrypcie produkcyjnym zgodny z migracją i powtarzalny; nie przywraca zapisu właściciela.
   Pozostałe kroki skryptu bez zmian.
3. `security_invoker` na aktualnym widoku, bez zmiany kolumn i bez nowego obiektu ocen (R5–R6).
4. Dwa przeniesienia na rolę serwisową, bez których decyzje o zapisie i średniej byłyby nieprawdziwe:
   zapis `image_path` (sprawdzenie własności zostaje na kluczu użytkownika) oraz odczyt widoku
   w `GET /recipes/{id}` (funkcja dalej odmawia cudzego niepublicznego i usuniętego).
5. Testy SQL ról i Deno tam, gdzie zmienia się kod. Bez E2E i bez zmian ekranów.

### Poza zakresem

Link do przepisu udostępnionego i flaga wariantów dla wszystkich. RLS profili, tagów, kolekcji, tabel
łączących i `recipe_families`. Polityka administratora na koncie użytkownika. Przebudowa
`enqueue_normalized_ingredients_refresh`, kolumny widoku, polityki kubełka zdjęć, ekrany i kontrakty.

### Zależności

PS-108 (kopie widoczności i triggery) oraz PS-109 (zapis wariantów rolą serwisową, limit 10).
Ta historyjka nie włącza flagi.

---

## Reguły

- **R1.** RLS na `recipes` włączone. Jedyna polityka `authenticated`: odczyt wiersza nieusuniętego,
  którego właścicielem jest zalogowany albo który jest publiczny.
- **R2.** `anon` i `authenticated` nie mają polityki zapisu. Rola serwisowa omija RLS i nie dostaje polityki.
- **R3.** Reguła czyta kolumny przepisu (właściciel, widoczność, data usunięcia), bez łączenia z grupą.
  Spójność kopii zostaje przy istniejących triggerach.
- **R4.** Gość nie czyta treści z tabeli ani z widoku. Strony publiczne zostają na funkcji serwerowej.
- **R5.** Widok ma `security_invoker`, kolumny bez zmian. Późniejsza przebudowa (`CREATE VIEW`) ma ustawienie
  powtórzyć, inaczej je gubi.
- **R6.** Średnia i liczba ocen zostają podzapytaniem w widoku. Ekran (rola serwisowa) widzi pełny agregat.
  Bezpośredni odczyt zalogowanego widzi tylko jego głos; liczby mogą się różnić.
- **R7.** Wyszukiwanie, kolekcje oraz sprawdzenie przepisu przy obrazie i normalizacji zostają na kluczu
  użytkownika. Pozostałe odczyty i zapisy aplikacji — na roli serwisowej, z wyjątkiem odświeżenia
  normalizacji (założenia).
- **R8.** Brak zmian ekranów i flagi. Panel administratora zostaje na roli serwisowej i widzi wszystkie
  przepisy, także niepubliczne i usunięte.

---

## Scenariusze

1. **RLS w bazie z migracji.** *Given* baza z migracji (RLS wyłączone, bez polityk zapisu), *When* wejdzie
   nowa migracja, *Then* RLS jest włączone, jest jedna polityka odczytu (R1) i nie ma polityki zapisu.
   Drugie zastosowanie kończy się tym samym stanem.
2. **Stare polityki i krok skryptu.** *Given* polityki odczytu i zapisu właściciela jak w skrypcie
   produkcyjnym, *When* wejdzie migracja, a potem ponownie sam krok przepisów skryptu, *Then* zapis
   właściciela nie wraca, odczyt jest zgodny z R1, a krok da się uruchomić jeszcze raz. Kroki profili,
   tagów i kolekcji skryptu bez zmian.
3. **Własny przepis.** *Given* zalogowany właściciel, *When* czyta swoje nieusunięte przepisy prywatne,
   udostępnione i publiczne (każdy nieusunięty wariant), *Then* dostaje treść.
4. **Cudzy publiczny.** *Given* zalogowany użytkownik, *When* czyta cudzy nieusunięty przepis publiczny,
   *Then* dostaje treść, także każdego nieusuniętego wariantu grupy publicznej.
5. **Niewidoczne wiersze.** *Given* zalogowany użytkownik, *When* czyta cudzy przepis prywatny, cudzy
   udostępniony albo dowolny usunięty (własny lub cudzy), *Then* wiersza nie ma.
6. **Gość i strony publiczne.** *Given* brak sesji, *When* gość czyta `recipes` lub `recipe_details`,
   *Then* nie dostaje treści. *When* ta sama strona idzie przez funkcję serwerową, *Then* publiczny
   nieusunięty przepis jest zwrócony jak dziś.
7. **Brak zapisu z konta.** *Given* zalogowany właściciel, *When* wstawia, zmienia albo usuwa wiersz
   `recipes` swoim kluczem (także dopisanie wariantu obok limitu 10), *Then* baza odrzuca operację.
   Ręczna edycja tym kontem nie zapisuje zmian.
8. **Zapis i ekran szczegółów rolą serwisową.** *Given* wgranie lub usunięcie zdjęcia albo otwarcie
   szczegółów, *When* aplikacja zapisuje `image_path` albo czyta widok na ekran, *Then* robi to rolą
   serwisową. Sprawdzenie własności przed zapisem zdjęcia zostaje na kluczu użytkownika. Cudzy
   niepubliczny i usunięty na szczegółach nadal kończą się odmową. Operacje wariantów zostają na roli
   serwisowej i dalej egzekwują limit.
9. **Klucz użytkownika.** *Given* zalogowany użytkownik, *When* szuka, czyta kolekcję albo funkcja
   sprawdza przepis przed obrazem AI lub normalizacją, *Then* zapytanie idzie jego kluczem i widzi
   własne oraz publiczne nieusunięte przepisy. Cudzy prywatny i udostępniony jest niewidoczny.
   Odświeżenie normalizacji dalej woła istniejącą funkcję `security definer` jego kluczem.
10. **Kolekcja i plan.** *Given* cudzy przepis publiczny w kolekcji, *When* przestaje być publiczny,
    *Then* odczyt kolekcji kluczem użytkownika go nie zwraca (powiązanie może zostać). Plan dalej
    ukrywa go po stronie serwera, bez zmiany tej funkcji.
11. **Bez tabeli grup.** *Given* zmiana widoczności grupy skopiowana triggerem na przepisy, *When* inny
    użytkownik czyta wariant, *Then* wynik bierze się z kolumn przepisu (R1, R3), nie z połączenia
    z `recipe_families`.
12. **Widok wywołującego.** *Given* aktualny `recipe_details`, *When* migracja się wykona, *Then* widok
    ma `security_invoker`, a zestaw kolumn jest ten sam.
13. **Średnia ocen.** *Given* głosy kilku użytkowników, *When* ekran szczegółów, Eksploruj albo strona
    publiczna czyta widok rolą serwisową, *Then* średnia i liczba obejmują wszystkie głosy. *When*
    zalogowany czyta widok swoim kluczem, *Then* obejmują tylko jego głos (brak głosu: brak średniej
    i liczba zero). Obie średnie mogą się różnić. Nowego obiektu liczącego oceny nie ma.
14. **Administrator.** *Given* panel administratora, *When* pobiera przepisy, *Then* używa roli serwisowej
    i widzi także prywatne, udostępnione i usunięte. Konto administratora nie ma osobnej polityki;
    bezpośredni odczyt jego kluczem podlega R1.
15. **Flagi, ekrany i inne tabele.** *Given* wdrożona historyjka, *When* użytkownik otwiera aplikację,
    *Then* flaga `recipe_variants` i ekrany są bez zmian, a RLS profili, tagów, kolekcji i tabel
    łączących pozostaje wyłączone.

---

## Przypadki brzegowe

- Grupa usunięta: triggery ustawiają `deleted_at` na wariantach, więc odczyt ich nie zwraca.
- Jeden usunięty wariant grupy publicznej znika; pozostałe nieusunięte zostają.
- Widok może pokazać nazwy kolekcji i tagów, bo te tabele nie mają RLS (otwarte).
- Nieznane nazwy starych polityk: migracja zdejmuje wszystkie polityki `recipes`, nie tylko nazwy z repozytorium.

---

## Decyzje i założenia

### Decyzje użytkownika

1. **Zapis bezpośredni — przyjęta rekomendacja.** Zalogowany ma sam odczyt własnych i publicznych
   przepisów. Zapis zostaje wyłącznie przy roli serwisowej. Nie da się dopisać wariantu z pominięciem
   limitu; ręczna edycja wiersza tym kontem przestaje działać. Krok przepisów w skrypcie produkcyjnym
   trzeba w tej części poprawić.
2. **Średnia ocen — przyjęta rekomendacja.** Liczenie zostaje w widoku, bez nowego obiektu. Ekrany
   pokazują pełną średnią (odczyt rolą serwisową). Bezpośredni odczyt zalogowanego pokazuje tylko jego
   głos; te liczby mogą się różnić. To samo podzapytanie dotyczy liczby ocen.

### Założenia (z rundy pytań; nie są stanem sprzed decyzji)

- Nowa migracja włącza RLS na `recipes` w każdej bazie z migracji, także lokalnej. Krok przepisów
  w skrypcie jest z nią uzgodniony i da się go uruchomić ponownie. Zapis bezpośredni właściciela
  jest wyłączony (decyzja 1).
- Odczyt zalogowanego obejmuje jego nieusunięte przepisy prywatne, udostępnione i publiczne oraz cudze
  nieusunięte publiczne. Gość nie dostaje treści. Strony publiczne zostają na funkcji serwerowej.
- Reguły czytają kolumny przepisu, bez łączenia z tabelą grup. Spójność z grupą zostaje przy triggerach.
- Cudzy przepis udostępniony pozostaje niewidoczny. Link do udostępnionego i flaga dla wszystkich
  są poza tą historyjką.
- Wyszukiwanie, kolekcje oraz sprawdzenie przy obrazie i normalizacji zostają na kluczu użytkownika,
  dlatego odczyt puszcza własne i publiczne. Pozostałe odczyty i zapisy aplikacji zostają na roli serwisowej.
- Przepis, który przestanie być publiczny, znika z cudzej kolekcji przy odczycie kluczem użytkownika.
  Plan już ukrywa go po stronie serwera.
- Panel administratora zostaje na roli serwisowej i widzi wszystkie przepisy. Bez osobnej polityki
  administratora dla konta użytkownika.
- RLS profili, tagów, kolekcji i tabel łączących zostaje wyłączone. Na aktualnym widoku ustawiamy
  `security_invoker`, bez zmiany kolumn; późniejsza przebudowa ma to ustawienie zachować.
- Brak zmian ekranów i flagi. Rola serwisowa nadal omija RLS.
- Migracja jest bezpieczna, gdy RLS jest wyłączone i gdy skrypt zdążył utworzyć stare polityki.
  Stan produkcji nie jest w repozytorium.

Doprecyzowanie wobec kodu (żeby decyzje 1 i 2 dało się spełnić): odczyt widoku w `GET /recipes/{id}`
oraz zapis `image_path` idą dziś kluczem użytkownika — ta historyjka przenosi te dwa dostępy na rolę
serwisową. Sprawdzenie własności przed zapisem zdjęcia zostaje na kluczu użytkownika.
`enqueue_normalized_ingredients_refresh` zostaje na kluczu użytkownika: jest `security definer` i bierze
`auth.uid()`; przeniesienie bez przebudowy przestałoby rozpoznawać użytkownika, a przebudowa jest
poza zakresem. To nie jest polityka zapisu tabeli i nie omija limitu wariantów.

### Otwarte kwestie

1. Pełne RLS na profilach i kolekcjach. Do tego czasu widok może pokazać nazwy kolekcji i tagów.
2. Cały skrypt produkcyjny nadal włączyłby RLS na profilach, tagach i kolekcjach. Tu uzgodniony jest
   tylko krok przepisów.
3. Dostęp do `SHARED` po linku i tryb flagi `all`. Polityki `recipe_families` z PS-108 zostają
   (gość może czytać publiczną grupę; to nie jest treść z `recipes`).

---

## Definition of Done

- Migracja w `supabase/migrations/`: RLS na `recipes`, jedna polityka odczytu (R1), brak polityk zapisu,
  `security_invoker` na istniejącym widoku bez zmiany kolumn. Przechodzi na bazie z migracji i na bazie
  ze starymi politykami zapisu; powtórzenie nie kończy się błędem.
- Krok przepisów w `docs/scripts/enable_rls_for_production.sql` zgodny z migracją, powtarzalny, bez zapisu
  właściciela. Pozostałe kroki skryptu bez zmian. Zapis `image_path` i odczyt widoku na ekran szczegółów
  idą rolą serwisową. Flaga i ekrany bez zmian.
- Testy SQL na lokalnej bazie (skrypt albo `deno test`) dla gościa, właściciela, innego zalogowanego
  i roli serwisowej: scenariusze 3–7 i 11–14. Deno dla zmienionych funkcji (8–10). Bez E2E.
  `deno lint` / `deno check` dla zmienionych funkcji. `ng lint` i `ng build` tylko przy zmianie frontu.
- Weryfikacja: `recipes.relrowsecurity` włączone, widok ma `security_invoker`, brak polityk zapisu.
  Status `PASS` / `FAIL` / `NIE_WYKONANO` / `WYMAGA_WERYFIKACJI`. Wiersz PS-116 w `project-summary.md`
  na etapie summary.

---

## Historia zmian

| Data | Etap | Zmiana | Powód |
|------|------|--------|-------|
| 2026-11-26 | implementacja-api | Migracja RLS na `recipes`, `security_invoker` na `recipe_details`, odczyt szczegółów i zapis `image_path` rolą serwisową. Widoki pominięte. | Etap 3 po akceptacji planów |
