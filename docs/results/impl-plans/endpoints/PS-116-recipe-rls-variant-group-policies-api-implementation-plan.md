# PS-116 — plan implementacji API

## Cel i zakres

Domknięcie RLS dla `public.recipes`, ustawienie `security_invoker` na
istniejącym `public.recipe_details` oraz przeniesienie odczytu szczegółów i
zapisu `image_path` na `service_role`. Bez zmian kolumn widoku, kontraktów DTO,
flag i pozostałych tabel RLS.

## Pliki do utworzenia lub zmiany

- `supabase/migrations/<timestamp>_ps116_recipe_rls_variant_group_policies.sql`
  — migracja idempotentnie włącza RLS, usuwa wszystkie polityki `recipes`,
  tworzy wyłącznie politykę odczytu dla `authenticated` i ustawia
  `security_invoker` na widoku.
- `docs/scripts/enable_rls_for_production.sql` — krok `recipes` ma wykonywać
  ten sam stan końcowy, nie odtwarzać polityk `INSERT`/`UPDATE`/`DELETE` i
  sprawdzać jedną politykę.
- `supabase/functions/recipes/recipes.service.ts` — `GET /recipes/{id}` pobiera
  `recipe_details` rolą serwisową po wcześniejszej kontroli dostępu; upload i
  delete obrazu zachowują kontrolę własności kluczem użytkownika, ale
  aktualizują `recipes.image_path` rolą serwisową.
- `supabase/functions/recipes/recipes.service.test.ts` oraz ewentualne testy
  SQL w `supabase/tests/` — regresja dostępu i użycia właściwych klientów.
- `supabase/functions/_shared/database.types.ts` tylko jeśli lokalne
  generowanie typów po migracji wymaga odświeżenia; żadnych zmian kontraktu
  DTO.

## Migracja, RLS i widok

1. Na początku kroku `recipes` usunąć wszystkie istniejące polityki tej tabeli
   dynamicznie po `pg_policies` (a nie tylko znane nazwy), aby obsłużyć bazę
   po skrypcie produkcyjnym i bazę po migracji deweloperskiej.
2. Wykonać `ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY`.
3. Utworzyć politykę wyłącznie dla `SELECT`, roli `authenticated`, z warunkiem:
   `deleted_at IS NULL AND (auth.uid() = user_id OR visibility = 'PUBLIC')`.
   Nie tworzyć polityk dla `anon` ani żadnych polityk zapisu. `service_role`
   korzysta z bypassu RLS.
4. Ustawić na bieżącym widoku `security_invoker = true` bez zmiany jego listy
   kolumn i podzapytań ocen. Przy każdej późniejszej przebudowie widoku
   powtórzyć to ustawienie.
5. Weryfikacja migracji ma sprawdzać `relrowsecurity`, dokładnie jedną politykę
   `recipes` i brak polityk dla operacji zapisu. Powtórne wykonanie migracji
   oraz ponowne uruchomienie kroku skryptu nie może kończyć się błędem.

## Skrypt produkcyjny

Zastąpić obecny krok tworzący cztery polityki. Krok powinien najpierw usunąć
wszystkie polityki `recipes`, włączyć RLS, utworzyć jedną politykę odczytu i
zweryfikować stan końcowy. Nie zmieniać kroków `profiles`, `tags`,
`collections` ani tabel łączących. Komunikaty i liczniki skryptu należy
zaktualizować z czterech polityk na jedną.

## Edge Functions i dostęp do danych

### `GET /functions/v1/recipes/{id}`

- Nadal wymaga zalogowania, waliduje dodatni identyfikator i zachowuje obecne
  rozstrzygnięcie wariantu.
- Zachować kontrolę aplikacyjną: własny przepis jest dostępny, cudzy tylko
  `PUBLIC`, przepis usunięty kończy się `404`, cudzy niepubliczny `403`.
  Kontrolę wykonać rolą serwisową, aby RLS widoku nie powodował niepotrzebnej
  ścieżki fallback.
- Pełny odczyt `recipe_details`, w tym agregaty ocen, wykonać
  `createServiceRoleClient()`. Dzięki temu ekran otrzyma pełną średnią i
  liczbę ocen.
- Odczyty danych użytkownika (plan, kolekcje, flagi, ocena użytkownika, notatka)
  pozostawić na kliencie użytkownika; profil autora może być pobrany klientem
  serwisowym zgodnie z istniejącą ścieżką.
- Zachować obecne kody: `200`, `400` dla niepoprawnego ID, `401` bez sesji,
  `403` dla cudzego niepublicznego, `404` dla braku/usunięcia, `500` dla
  błędu bazy. Nie dodawać nowego endpointu ani DTO.

### `POST /functions/v1/recipes/{id}/image` i `DELETE .../image`

- Klient użytkownika nadal pobiera `id,image_path` z warunkiem właściciela i
  `deleted_at IS NULL`; ta kontrola jest wymagana przed operacją.
- Upload/remove Storage może pozostać na dotychczasowym kliencie użytkownika,
  zgodnie z istniejącymi politykami bucketu.
- Aktualizację `recipes.image_path` wykonać klientem serwisowym, z warunkami
  `id` i `user_id` (oraz `deleted_at IS NULL` przy usuwaniu), a wynik
  aktualizacji sprawdzić. Nie przenosić kontroli własności na zaufanie do
  `user_id` z body.
- Zachować rollback nowego pliku, best-effort usunięcie starego pliku,
  idempotentne usunięcie pustej ścieżki i istniejące DTO/kody `200`, `401`,
  `404`, `500`.
- Przypadki tworzenia/edycji/soft-delete całego przepisu i operacje wariantów
  pozostają na istniejących RPC/kliencie serwisowym; nie przywracać zapisu
  właściciela przez RLS.

## Walidacja, kontrakty i role

Nie zmieniać schematów Zod, tras, DTO ani `shared/contracts/types.ts`.
Autoryzacja pozostaje oparta o zweryfikowany JWT; `service_role` jest używana
wyłącznie po sprawdzeniu sesji i własności/visibility w kodzie. Nie dodawać
RPC ani nowych uprawnień funkcji `security definer`.

## Testy jednostkowe i SQL

- Test migracji na bazie z migracji: scenariusze 1–2, 12 oraz 15; ponowne
  wykonanie kroku i sprawdzenie relacji/polityk.
- Testy SQL ról `anon`, `authenticated` właściciela, `authenticated` innego
  użytkownika i `service_role`: scenariusze 3–7, 11–14; obejmują warianty,
  soft-delete, prywatne/udostępnione/publiczne i pełny agregat ocen.
- Test regresji funkcji: scenariusz 8 (GET szczegółów i image_path),
  scenariusz 9 (pozostałe operacje kluczem użytkownika), scenariusz 10
  (kolekcja i zmiana visibility). Sprawdzić, że odczyt szczegółów i update
  ścieżki używają klienta serwisowego, a kontrola własności klienta
  użytkownika pozostaje.
- Test publicznego odczytu przez funkcję serwerową i braku treści dla gościa:
  scenariusz 6. Scenariusze 15 potwierdzić brakiem zmian ekranów/flag i
  pozostałych tabel.
- Uruchomić `deno test` dla zmienionych testów/funkcji, `deno lint` i
  `deno check` dla zmienionych funkcji. Testy SQL uruchomić lokalnie zgodnie
  z konfiguracją Supabase. Nie planować ani uruchamiać E2E.

## Komendy weryfikacji

```text
supabase db reset
supabase migration list --local
deno test --allow-env --allow-net supabase/functions/recipes
deno lint supabase/functions/recipes supabase/functions/_shared
deno check supabase/functions/recipes/index.ts
```

Po migracji sprawdzić w katalogu systemowym `pg_class`/`pg_policies`:
`recipes.relrowsecurity = true`, jedna polityka `SELECT` dla
`authenticated`, brak `INSERT`/`UPDATE`/`DELETE`, a `recipe_details` ma
`security_invoker = true`. Zarejestrować status weryfikacji jako
`PASS`, `FAIL`, `NIE_WYKONANO` albo `WYMAGA_WERYFIKACJI`.

## Czynności ręczne

1. Przed wdrożeniem wykonać kopię/backup bazy produkcyjnej i potwierdzić
   okno migracyjne; migracja zmienia skuteczność RLS na `recipes`.
2. Uruchomić migrację PS-116 na produkcji albo zastosować ją przez standardowy
   pipeline Supabase; nie uruchamiać ręcznie tylko fragmentu bez weryfikacji
   końcowego stanu polityk.
3. Jeśli środowisko produkcyjne korzysta ze skryptu
   `docs/scripts/enable_rls_for_production.sql`, uruchomić po zmianie wyłącznie
   uzgodniony krok `recipes` lub cały skrypt w kontrolowanym oknie, po
   sprawdzeniu, że pozostałe kroki nie są częścią tej historyjki.
4. Po migracji wykonać ręczne smoke testy jako gość, właściciel, inny
   zalogowany użytkownik i `service_role`: odczyt własny/publiczny, odmowa
   zapisu kontem, szczegóły z pełną średnią, upload i usunięcie obrazu.
5. Zweryfikować w logach brak błędów `42501` dla dozwolonych ścieżek oraz brak
   dostępu do prywatnych/usuniętych przepisów.
6. Nie są wymagane nowe sekrety, konfiguracja zewnętrznych usług ani ręczne
   działania w GitHub Actions.
