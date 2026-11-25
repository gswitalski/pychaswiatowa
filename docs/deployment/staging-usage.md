# Jak używać środowiska staging

## Cel

Staging jest niezależną kopią PychaŚwiatowa uruchomioną przed wdrożeniem na
produkcję. Służy przede wszystkim do:

- testowania `develop` przed scaleniem do `main`,
- sprawdzania migracji na anonimizowanych danych podobnych do produkcyjnych,
- ręcznych testów funkcjonalnych frontendowych i Edge Functions,
- sprawdzania wdrożenia w GitHub Actions.

Adres aplikacji: `https://pychaswiatowa-staging.web.app`.

Staging nie jest środowiskiem produkcyjnym. Ma nagłówek `noindex, nofollow`,
ale adres jest publicznie dostępny — nie dodawaj do niego prawdziwych danych
osobowych ani sekretów produkcyjnych.

## Aktualny stan i ograniczenia

- Dane użytkowników są zanonimizowane: konta mają adresy
  `<rola>-<fragment-uuid>@staging.invalid`.
- Zachowane UUID pozwalają zachować relacje właścicielskie przepisów,
  kolekcji i innych danych.
- Hasło wszystkich odtworzonych kont jest wspólne i znajduje się wyłącznie w
  menedżerze haseł.
- Skopiowano bucket `recipe-images`.
- AI jest aktywne na osobnych kluczach staging z limitem budżetu.
- Stripe i płatności są obecnie **nie skonfigurowane**. Nie testuj ścieżek
  zakupu ani nie oczekuj działania `/checkout`.
- Rejestracja nowego użytkownika nie została jeszcze przetestowana.

## Codzienna praca

Po zakończeniu testu migracji z `develop` staging ma odzwierciedlać `develop`.

1. Utwórz gałąź funkcjonalną i otwórz PR do `develop`.
2. Po scaleniu PR do `develop` obserwuj workflow **Deploy to Staging** w
   GitHub Actions.
3. Po zielonym wdrożeniu przetestuj zmianę na staging.
4. Dopiero po poprawnym teście otwórz PR `develop` → `main`.
5. Scalenie do `main` uruchamia osobny workflow produkcyjny.

Jeżeli workflow staging nie został jeszcze przeniesiony na `develop`, najpierw
przenieś wszystkie commity gałęzi bazowej:

```powershell
git checkout develop
git fetch origin
git cherry-pick origin/main..origin/staging/baseline
git push origin develop
```

Nie przenoś tylko pierwszego commita workflow — poprawki CI są częścią tego
samego zakresu.

## Testowanie gałęzi przed scaleniem

Gdy workflow jest dostępny na domyślnej gałęzi, można uruchomić wdrożenie
wybranej gałęzi ręcznie z GitHub Actions:

1. Otwórz **Actions → Deploy to Staging → Run workflow**.
2. Wybierz gałąź funkcjonalną.
3. Pozostaw `skip_tests` wyłączone, chyba że świadomie potrzebujesz szybkiego
   ponownego wdrożenia już przetestowanego commita.
4. Po zielonym przebiegu sprawdź zmianę w aplikacji.

Nie wdrażaj na staging przypadkowych gałęzi zawierających migracje, których
nie planujesz scalać do `develop`. Historia migracji staging jest trwała.

## Migracje

Przed wdrożeniem migracji na staging:

```powershell
git fetch origin
git diff --name-status origin/main...origin/develop -- supabase/migrations
git diff --stat origin/main...origin/develop -- supabase/functions
```

Szczególnie sprawdzaj:

- `ALTER TABLE ... ADD COLUMN ... NOT NULL` bez wartości domyślnej,
- zmianę typu kolumny,
- `DROP TABLE` i `DROP COLUMN`,
- indeksy unikalne,
- ograniczenia `CHECK` i klucze obce,
- backfille aktualizujące całą tabelę,
- zmiany RLS.

Przed wdrożeniem można wykonać podgląd bez zapisu:

```powershell
supabase db push --dry-run --db-url $env:STAGING_DB_URL
```

Jeżeli migracja nie powiedzie się, popraw ją na gałęzi `develop` i wypchnij
ponownie. Jeżeli migracja powiedzie się, ale wymaga zmiany, nie edytuj jej:
utwórz nową migrację albo odtwórz staging do stanu `main`.

## Minimalne testy po wdrożeniu

Po każdej istotnej zmianie sprawdź:

1. stronę publiczną i odświeżenie bezpośredniej podstrony,
2. logowanie kontem zwykłym, premium i administratorem,
3. panel administratora,
4. tworzenie i edycję przepisu,
5. normalizację składników — status zadania powinien osiągnąć `DONE`,
6. funkcję AI, jeśli zmiana jej dotyczy,
7. logi Edge Functions oraz GitHub Actions.

Do sprawdzenia ostatnich zadań normalizacji:

```powershell
psql $env:STAGING_DB_URL -c "select r.name, j.status, j.attempts, j.last_error from public.normalized_ingredients_jobs j join public.recipes r on r.id = j.recipe_id order by j.updated_at desc limit 10;"
```

Nie testuj płatności, dopóki Stripe Sandbox, ceny i webhook staging nie zostaną
skonfigurowane.

## Cron i worker

Na staging działają:

- `normalized-ingredients-worker` — co minutę,
- `billing-expire-subscriptions` — codziennie o 03:00,
- `ai-credits-monthly-reset` — tworzony przez migrację.

Ręczny test workera:

```powershell
Invoke-RestMethod -Method POST `
    -Uri "https://eugnqwuxkfujjvfaijtm.supabase.co/functions/v1/internal/workers/normalized-ingredients/run" `
    -Headers @{ 'x-internal-worker-secret' = $env:INTERNAL_WORKER_SECRET }
```

Wartość `INTERNAL_WORKER_SECRET` musi być zgodna z sekretem GitHub Environment
`staging` i z funkcją `public.get_internal_worker_secret()` w bazie.

## Odświeżanie danych

Odświeżaj dane tylko wtedy, gdy nikt nie testuje na staging. Operacja:

- czyści wszystkie dane aplikacji i konta staging,
- unieważnia sesje,
- odtwarza anonimowe konta z nowym wspólnym hasłem,
- importuje świeże dane publiczne z produkcji,
- ponownie pseudonimizuje profile.

Wykonaj pełny **Krok 6** z
[instrukcji utworzenia środowiska](./staging-environment.md).

Jeżeli staging ma migracje z `develop`, a dump pochodzi z produkcyjnego
`main`, najpierw odtwórz staging do stanu `main`. W przeciwnym razie import
może nie pasować do schematu.

## Powrót do stanu `main`

Staging nie cofa migracji automatycznie. Gdy trzeba powtórzyć test migracji:

1. użyj `supabase db reset --db-url $env:STAGING_DB_URL --no-seed` z czystego
   checkoutu `main`, albo utwórz nowy projekt Supabase staging;
2. wdroż `staging/baseline`;
3. odtwórz RLS i crony;
4. powtórz anonimizowany import danych;
5. wykonaj testy dymne przed kolejnym wdrożeniem `develop`.

Szczegóły i polecenia są w sekcji „Powrót do stanu main” instrukcji utworzenia.

## Sekrety i bezpieczeństwo

Przechowuj w menedżerze haseł:

- hasło bazy staging,
- wspólne hasło kont staging,
- `INTERNAL_WORKER_SECRET`,
- ograniczony `SUPABASE_ACCESS_TOKEN` dla CI,
- klucze OpenAI i Gemini staging.

Nie przechowuj ani nie używaj na staging:

- kluczy produkcyjnych Stripe,
- produkcyjnych kluczy Secret Supabase,
- tymczasowych Secret keys utworzonych wyłącznie do kopiowania Storage.

Po lokalnej pracy usuń pliki dumpów oraz zmienne sesji z URI i kluczami:

```powershell
Remove-Item -Recurse -Force $work
Remove-Item Env:PROD_DB_URL, Env:STAGING_DB_URL, `
    Env:PROD_SUPABASE_URL, Env:PROD_SECRET_KEY, `
    Env:STAGING_SUPABASE_URL, Env:STAGING_SECRET_KEY, `
    Env:INTERNAL_WORKER_SECRET, Env:STAGING_REF, Env:stagingPassword `
    -ErrorAction SilentlyContinue
```

## Gdzie diagnozować problemy

- GitHub Actions → szczegóły jobów wdrożenia,
- Supabase → Edge Functions → Logs,
- Supabase → Database → Migrations,
- Supabase → Database → Cron Jobs / `cron.job_run_details`,
- Firebase → Hosting → Release history.

Przed zmianą sekretów lub migracji sprawdź, czy pracujesz na projekcie
`eugnqwuxkfujjvfaijtm`, a nie na produkcji.
