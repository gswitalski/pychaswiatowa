# 🔒 Przewodnik Włączania Row Level Security (RLS) na Produkcji

## 🚨 KRYTYCZNE: PRODUKCJA DZIAŁA BEZ RLS - WYMAGA NATYCHMIASTOWEJ AKCJI

**STATUS OBECNY:**
- ❌ RLS jest **WYŁĄCZONE** na środowisku **PRODUKCYJNYM**
- ❌ Wszystkie polityki bezpieczeństwa są **NIEAKTYWNE**
- 🚨 **LUKA BEZPIECZEŃSTWA**: Użytkownicy mogą mieć dostęp do cudzych danych

**Ten dokument zawiera plan włączenia RLS na działającej produkcji.**

---

## 📋 Stan Obecny Produkcji

### Środowisko Produkcyjne (CZĘŚCIOWA NAPRAWA WYMAGANA)

**STARE TABELE (7) - WYMAGA NAPRAWY:**
- ❌ RLS: **WYŁĄCZONE** 
- ❌ Polityki: **BRAK**
- 🚨 Ryzyko: **WYSOKIE**
- Tabele: `profiles`, `categories`, `recipes`, `tags`, `collections`, `recipe_tags`, `recipe_collections`

**NOWE TABELE (5) - OK:**
- ✅ RLS: **WŁĄCZONE** (dodane przez migracje)
- ✅ Polityki: **~15 polityk** aktywnych
- ✅ Ryzyko: **NISKIE**
- Tabele: `plan_recipes`, `shopping_list_items`, `shopping_list_recipe_contributions`, `normalized_ingredients_jobs`, `recipe_normalized_ingredients`

**WIDOK (1) - WYMAGA KONFIGURACJI:**
- ⚠️ `recipe_details` - WIDOK (nie tabela)
- Widoki nie mają flagi "RLS enabled" jak tabele
- Dziedziczą RLS z tabel bazowych (głównie `recipes`)
- Wymaga ustawienia `security_invoker = true`

### Środowisko Deweloperskie (OK)
- ✅ RLS jest **WYŁĄCZONE** na wszystkich tabelach (zamierzone dla testów)
- ✅ Wszystkie polityki bezpieczeństwa są **USUNIĘTE**
- ✅ Plik: `supabase/migrations/20251125121000_disable_rls_for_development.sql`

---

## ℹ️ Wyjaśnienie: Dlaczego Niektóre Tabele Już Mają RLS?

**Historia wdrożeń:**

1. **Pierwotne wdrożenie (starsze):** Bazowe tabele (`profiles`, `recipes`, etc.) zostały wdrożone BEZ RLS dla szybszego rozwoju
2. **Późniejsze funkcje (nowsze):** Funkcje dodane później (lista zakupów, plan przepisów, worker) zostały wdrożone OD RAZU z RLS, zgodnie z najlepszymi praktykami
3. **Obecna sytuacja:** Mamy "hybrydę" - część tabel z RLS, część bez

**Ten skrypt naprawia tę niespójność - wszystkie tabele będą miały RLS!**

### 📌 Co z Widokiem `recipe_details`?

**Widoki ≠ Tabele** w kontekście RLS:

- **Tabele** mają flagę `rowsecurity` (ON/OFF) i własne polityki RLS
- **Widoki** nie mają flagi `rowsecurity` - zamiast tego **dziedziczą** RLS z tabel bazowych
- `recipe_details` to widok bazujący głównie na tabeli `recipes`

**Jak to działa:**
1. Użytkownik odpytuje widok `recipe_details`
2. PostgreSQL wykonuje zapytanie bazowe widoku
3. Zapytanie to korzysta z tabeli `recipes` (i innych)
4. Polityki RLS z tabeli `recipes` są **automatycznie stosowane**
5. Użytkownik widzi tylko przepisy, do których ma dostęp

**Opcja `security_invoker = true`:**
- Sprawia że widok wykonuje się z uprawnieniami **użytkownika**, nie właściciela widoku
- Gwarantuje że RLS z tabel bazowych jest zawsze respektowany
- **Zalecane** dla widoków zawierających dane wrażliwe

---

## 🎯 Plan Włączenia RLS na Produkcji

### Przegląd Procesu

1. **Weryfikacja stanu przed zmianą** (5 min)
2. **Backup bazy danych** (10-30 min w zależności od rozmiaru)
3. **Komunikacja z użytkownikami** (opcjonalne okno maintenance)
4. **Włączenie RLS** (2-5 min)
5. **Weryfikacja po włączeniu** (10 min)
6. **Monitoring** (pierwsze 24h)

**Szacowany czas okna maintenance:** 15-45 minut (zalecane)

---

## 📝 Krok 1: Weryfikacja Stanu Przed Zmianą

### 1.1. Sprawdź obecny stan RLS na WSZYSTKICH tabelach

Zaloguj się do Supabase Dashboard → SQL Editor i uruchom:

```sql
-- Sprawdź stan RLS na WSZYSTKICH tabelach aplikacji
SELECT 
    tablename, 
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '✅ WŁĄCZONY'
        ELSE '❌ WYŁĄCZONY'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    -- STARE TABELE (bez RLS na produkcji):
    'profiles', 
    'categories', 
    'recipes', 
    'tags', 
    'collections', 
    'recipe_tags', 
    'recipe_collections',
    -- NOWE TABELE (z RLS już włączonym):
    'plan_recipes',
    'shopping_list_items',
    'shopping_list_recipe_contributions',
    'normalized_ingredients_jobs',
    'recipe_normalized_ingredients'
)
ORDER BY tablename;
```

**Oczekiwany wynik przed zmianą:**
- ❌ **Stare tabele (7)**: `rowsecurity = false` - WYMAGA NAPRAWY
- ✅ **Nowe tabele (5)**: `rowsecurity = true` - już OK (dodane przez migracje)
- ℹ️ **Widok `recipe_details`**: nie pojawi się w wynikach (widoki nie mają flagi `rowsecurity`)

### 1.2. Sprawdź widok recipe_details

```sql
-- Sprawdź czy widok recipe_details istnieje i jego konfigurację
SELECT 
    schemaname,
    viewname,
    viewowner,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname = 'recipe_details';
```

**Oczekiwany wynik:**
- Widok powinien istnieć
- Bazuje na tabelach: recipes, categories, tags, collections
- Po włączeniu RLS będzie automatycznie respektował polityki z tabeli `recipes`

### 1.3. Sprawdź istniejące polityki

```sql
-- Sprawdź które tabele mają już polityki
SELECT 
    tablename, 
    COUNT(*) as policy_count,
    array_agg(cmd ORDER BY cmd) as commands
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Oczekiwany wynik przed zmianą:**
- ✅ **Nowe tabele** mają już polityki:
  - `normalized_ingredients_jobs`: 3 polityki
  - `plan_recipes`: 3 polityki
  - `recipe_normalized_ingredients`: 2 polityki
  - `shopping_list_items`: 4 polityki
  - `shopping_list_recipe_contributions`: 3 polityki
- ❌ **Stare tabele** nie mają polityk (0): profiles, categories, recipes, tags, collections, recipe_tags, recipe_collections

**RAZEM przed zmianą: ~15 polityk (tylko dla nowych tabel)**

### 1.4. Policz rekordy w kluczowych tabelach

```sql
-- Zapisz te liczby dla późniejszej weryfikacji
SELECT 
    'CORE TABLES' as category,
    (SELECT COUNT(*) FROM public.profiles) as profiles_count,
    (SELECT COUNT(*) FROM public.recipes) as recipes_count,
    (SELECT COUNT(*) FROM public.tags) as tags_count,
    (SELECT COUNT(*) FROM public.collections) as collections_count,
    (SELECT COUNT(*) FROM public.categories) as categories_count
UNION ALL
SELECT 
    'NEW FEATURES' as category,
    (SELECT COUNT(*) FROM public.plan_recipes) as plan_recipes_count,
    (SELECT COUNT(*) FROM public.shopping_list_items) as shopping_list_items_count,
    (SELECT COUNT(*) FROM public.normalized_ingredients_jobs) as jobs_count,
    (SELECT COUNT(*) FROM public.recipe_normalized_ingredients) as normalized_count,
    NULL as unused;
```

**⚠️ ZAPISZ te liczby - użyjesz ich do weryfikacji po włączeniu RLS.**  
**Liczby MUSZĄ być identyczne po wdrożeniu!**

---

## 💾 Krok 2: Backup Bazy Danych

**⚠️ OBOWIĄZKOWE przed jakimikolwiek zmianami w produkcji!**

### Opcja A: Przez Supabase Dashboard (Zalecana)

1. Otwórz **Supabase Dashboard**
2. Przejdź do **Database** → **Backups**
3. Kliknij **Create backup now**
4. Zapisz znacznik czasu backupu
5. **Poczekaj na potwierdzenie** wykonania backupu

### Opcja B: Przez Supabase CLI

```bash
# Utwórz lokalny backup
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres" > backup_before_rls_$(date +%Y%m%d_%H%M%S).sql

# Zapisz plik backupu w bezpiecznym miejscu
# Sprawdź czy backup się utworzył
ls -lh backup_before_rls_*.sql
```

---

## 📢 Krok 3: Komunikacja (Opcjonalne Okno Maintenance)

### 3.1. Zalecane (jeśli baza ma aktywnych użytkowników)

**Wprowadź krótkie okno maintenance:**

1. Ustaw aplikację frontendową w tryb maintenance (banner lub redirect)
2. Zapisz komunikat: 
   ```
   "Wykonujemy krótką konserwację techniczną. 
   Aplikacja będzie niedostępna przez ok. 15-30 minut.
   Dziękujemy za cierpliwość!"
   ```
3. Zablokuj nowe połączenia do API (opcjonalnie)

### 3.2. Opcja bez maintenance (ryzykowna)

Możesz włączyć RLS bez okna maintenance, ale:
- ⚠️ Użytkownicy mogą doświadczyć błędów przez kilka minut
- ⚠️ Może pojawić się krótka przerwa w dostępie do danych
- ⚠️ Niektóre zapytania mogą zostać odrzucone podczas przełączania

---

## 🔧 Krok 4: Włączenie RLS na Produkcji

### Metoda 1: Przez Supabase Dashboard (Zalecana dla pierwszego razu)

1. Otwórz **Supabase Dashboard**
2. Przejdź do **SQL Editor**
3. Utwórz **New query**
4. Otwórz lokalnie plik `docs/deployment/enable_rls_for_production.sql`
5. **Skopiuj całą zawartość** pliku
6. **Wklej do SQL Editor**
7. **Przejrzyj dokładnie** skrypt przed uruchomieniem
8. Kliknij **Run** (Ctrl+Enter)
9. **Poczekaj na potwierdzenie** wykonania wszystkich poleceń
10. **Zapisz znacznik czasu** wykonania skryptu

### Metoda 2: Przez Supabase CLI

```bash
# Upewnij się że jesteś połączony z produkcją
supabase link --project-ref your-production-project-ref

# Sprawdź połączenie
supabase projects list

# Wykonaj skrypt RLS
supabase db execute --file docs/deployment/enable_rls_for_production.sql

# Zapisz output i znacznik czasu
```

### ⏱️ Oczekiwany czas wykonania

- **Włączenie RLS:** ~5 sekund
- **Utworzenie 24 polityk:** ~10-20 sekund
- **Całkowity czas:** **~30 sekund**

---

## ✅ Krok 5: Weryfikacja Po Włączeniu RLS

Jeśli z jakiegoś powodu potrzebujesz ręcznie włączyć RLS na istniejącej bazie:

### Opcja A: Przez Supabase CLI

```bash
supabase db execute --file docs/deployment/enable_rls_for_production.sql
```

### Opcja B: Przez Supabase Dashboard

1. Otwórz **Supabase Dashboard**
2. Przejdź do **SQL Editor**
3. Otwórz plik `docs/deployment/enable_rls_for_production.sql`
4. Skopiuj całą zawartość
5. Wklej do SQL Editor
6. Kliknij **Run**

---

### 5.1. Weryfikacja Podstawowa (OBOWIĄZKOWA)

#### Sprawdź czy RLS jest włączony na wszystkich tabelach

```sql
SELECT 
    tablename, 
    rowsecurity,
    CASE 
        WHEN rowsecurity THEN '✅ WŁĄCZONY'
        ELSE '❌ WYŁĄCZONY - BŁĄD!'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    -- Stare tabele (naprawione przez skrypt):
    'profiles', 
    'categories', 
    'recipes', 
    'tags', 
    'collections', 
    'recipe_tags', 
    'recipe_collections',
    -- Nowe tabele (już z RLS):
    'plan_recipes',
    'shopping_list_items',
    'shopping_list_recipe_contributions',
    'normalized_ingredients_jobs',
    'recipe_normalized_ingredients'
)
ORDER BY tablename;
```

**✅ Oczekiwany rezultat:** **WSZYSTKIE 12 tabel** `rowsecurity = true`  
**❌ Jeśli jakaś tabela ma `false`:** Włączenie RLS nie powiodło się - sprawdź logi i wykonaj rollback

#### Sprawdź liczbę utworzonych polityk

```sql
SELECT 
    tablename, 
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**✅ Oczekiwany rezultat:**

**STARE TABELE (naprawione przez skrypt):**
- `categories`: 2 polityki
- `collections`: 4 polityki
- `profiles`: 4 polityki
- `recipe_collections`: 3 polityki
- `recipe_tags`: 3 polityki
- `recipes`: 4 polityki
- `tags`: 4 polityki

**NOWE TABELE (już miały polityki):**
- `normalized_ingredients_jobs`: 3 polityki
- `plan_recipes`: 3 polityki
- `recipe_normalized_ingredients`: 2 polityki
- `shopping_list_items`: 4 polityki
- `shopping_list_recipe_contributions`: 3 polityki

**ŁĄCZNIE: 39 polityk** (24 nowe + 15 istniejących)

**❌ Jeśli liczby się nie zgadzają:** Polityki nie zostały utworzone prawidłowo - wykonaj rollback

#### Sprawdź nazwy wszystkich polityk

```sql
SELECT 
    tablename, 
    policyname, 
    cmd,
    roles::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
```

**Zapisz wynik** - będzie potrzebny do dokumentacji i przyszłych audytów.

#### Zweryfikuj liczbę rekordów (bez zmian)

```sql
-- Porównaj z liczbami z Kroku 1.3
-- MUSZĄ być identyczne!
SELECT 
    'CORE TABLES' as category,
    (SELECT COUNT(*) FROM public.profiles) as profiles_count,
    (SELECT COUNT(*) FROM public.recipes) as recipes_count,
    (SELECT COUNT(*) FROM public.tags) as tags_count,
    (SELECT COUNT(*) FROM public.collections) as collections_count,
    (SELECT COUNT(*) FROM public.categories) as categories_count
UNION ALL
SELECT 
    'NEW FEATURES' as category,
    (SELECT COUNT(*) FROM public.plan_recipes) as plan_recipes_count,
    (SELECT COUNT(*) FROM public.shopping_list_items) as shopping_list_items_count,
    (SELECT COUNT(*) FROM public.normalized_ingredients_jobs) as jobs_count,
    (SELECT COUNT(*) FROM public.recipe_normalized_ingredients) as normalized_count,
    NULL as unused;
```

**✅ Oczekiwany rezultat:** Liczby **IDENTYCZNE** jak przed włączeniem RLS  
**❌ Jeśli liczby się różnią:** Coś poszło nie tak - **NATYCHMIAST** wykonaj rollback!

### 5.2. Weryfikacja Funkcjonalna (ZALECANA)

#### Test dostępu do kategorii (publiczne dane)

```sql
-- Symuluj użytkownika niezalogowanego (anon)
SET ROLE anon;
SELECT COUNT(*) FROM public.categories;
-- Powinno zwrócić wszystkie kategorie

-- Reset
RESET ROLE;
```

#### Test izolacji danych użytkowników

```sql
-- Znajdź dwóch różnych użytkowników
SELECT id, username FROM public.profiles LIMIT 2;

-- Zapisz ich UUID (np. user1_id i user2_id)
-- Następnie symuluj kontekst user1:

-- Test 1: Użytkownik widzi tylko swoje przepisy
SET request.jwt.claims TO '{"sub": "USER1_UUID_TUTAJ"}';
SELECT COUNT(*) FROM public.recipes WHERE user_id = 'USER1_UUID_TUTAJ';
-- Powinna zwrócić przepisy user1

-- Test 2: Użytkownik NIE widzi cudzych przepisów
SELECT COUNT(*) FROM public.recipes WHERE user_id = 'USER2_UUID_TUTAJ';
-- Powinno zwrócić 0

-- Reset
RESET request.jwt.claims;
```

**⚠️ UWAGA:** Testy SQL to symulacja. Prawdziwa weryfikacja wymaga testów przez API/frontend.

---

## 🧪 Krok 6: Testowanie Funkcjonalne Przez Aplikację

### 6.1. Test Podstawowy - Logowanie i Dostęp

1. **Zaloguj się jako istniejący użytkownik**
   - ✅ Logowanie powinno działać normalnie
   - ✅ Użytkownik powinien zobaczyć swój dashboard

2. **Sprawdź dostęp do własnych danych**
   - ✅ Lista "Moje przepisy" powinna się załadować
   - ✅ Powinny być widoczne TYLKO przepisy tego użytkownika
   - ✅ Liczba przepisów powinna się zgadzać z wcześniejszym stanem

3. **Sprawdź brak dostępu do cudzych danych**
   - ✅ Próba wejścia na `/recipes/:id` cudzego przepisu (prywatnego) powinna zwrócić 404
   - ✅ Lista nie powinna zawierać cudzych prywatnych przepisów

4. **Sprawdź dostęp do danych publicznych**
   - ✅ Wyloguj się
   - ✅ Przejdź do `/explore`
   - ✅ Publiczne przepisy powinny być widoczne
   - ✅ Kategorie powinny się ładować

### 6.2. Test Operacji CRUD

**Jako zalogowany użytkownik:**

1. **Utwórz nowy przepis**
   - ✅ Formularz dodawania powinien działać
   - ✅ Przepis powinien zostać zapisany
   - ✅ Przepis powinien być widoczny w "Moje przepisy"

2. **Edytuj swój przepis**
   - ✅ Formularz edycji powinien się załadować
   - ✅ Zmiany powinny zostać zapisane
   - ✅ Nie powinieneś móc edytować cudzych przepisów

3. **Usuń swój przepis**
   - ✅ Usuwanie powinno działać
   - ✅ Przepis powinien zniknąć z listy
   - ✅ Nie powinieneś móc usunąć cudzych przepisów

4. **Utwórz kolekcję**
   - ✅ Tworzenie kolekcji powinno działać
   - ✅ Dodawanie przepisów do kolekcji powinno działać
   - ✅ Powinny być widoczne TYLKO twoje kolekcje

### 6.3. Test Wieloużytkownikowy (Krytyczny)

**Wymaga dwóch różnych kont testowych:**

1. **Jako User A:**
   - Utwórz przepis prywatny o nazwie "Test RLS - User A"
   - Zapisz ID tego przepisu

2. **Zaloguj się jako User B:**
   - Spróbuj bezpośrednio wejść na `/recipes/:id` przepisu User A
   - ✅ **POWINNO ZWRÓCIĆ 404** (brak dostępu)
   - ✅ Przepis User A **NIE POWINIEN** być widoczny w wyszukiwaniu User B
   - ✅ User B **NIE POWINIEN** widzieć przepisu w swoim dashboardzie

**❌ Jeśli User B widzi przepis User A:** RLS NIE DZIAŁA - natychmiast wykonaj rollback!

---

## 🔄 Krok 7: Rollback (W Razie Problemów)

### Kiedy wykonać rollback?

- ❌ RLS się nie włączył (tabele nadal mają `rowsecurity = false`)
- ❌ Nie wszystkie polityki zostały utworzone (mniej niż 24)
- ❌ Liczba rekordów się zmieniła po włączeniu RLS
- ❌ Użytkownicy widzą cudze dane (test wieloużytkownikowy failed)
- ❌ Aplikacja zwraca masowe błędy 403 lub 401
- ❌ Użytkownicy nie mogą uzyskać dostępu do własnych danych

### Procedura Rollback - Opcja A: Przywróć Backup

**Najszybsza i najbezpieczniejsza metoda:**

1. Otwórz **Supabase Dashboard**
2. Przejdź do **Database** → **Backups**
3. Znajdź backup sprzed włączenia RLS (znacznik czasu z Kroku 2)
4. Kliknij **Restore**
5. **Potwierdź** przywrócenie
6. **Poczekaj** na zakończenie (~5-15 minut)
7. **Zweryfikuj** stan bazy po przywróceniu

### Procedura Rollback - Opcja B: Ręczne Wyłączenie RLS

**Użyj tylko jeśli nie masz backupu lub backup jest zbyt stary:**

**⚠️ UWAGA:** Ten rollback wyłącza RLS TYLKO na starych tabelach.  
**Nowe tabele (plan_recipes, shopping_list_*, normalized_ingredients_*) POZOSTANĄ z RLS** - to jest zamierzone!

```sql
-- KROK 1: Wyłącz RLS TYLKO na STARYCH tabelach (wróć do stanu sprzed skryptu)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_collections DISABLE ROW LEVEL SECURITY;

-- NIE WYŁĄCZAJ RLS na nowych tabelach! Mają one RLS od początku.

-- KROK 2: Usuń TYLKO polityki STARYCH tabel (utworzone przez skrypt)
-- NIE USUWAJ polityk nowych tabel!

DROP POLICY IF EXISTS "authenticated users can select own profile" ON public.profiles;
DROP POLICY IF EXISTS "authenticated users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "authenticated users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "authenticated users can delete own profile" ON public.profiles;

DROP POLICY IF EXISTS "anonymous users can select categories" ON public.categories;
DROP POLICY IF EXISTS "authenticated users can select categories" ON public.categories;

DROP POLICY IF EXISTS "authenticated users can select own recipes" ON public.recipes;
DROP POLICY IF EXISTS "authenticated users can insert own recipes" ON public.recipes;
DROP POLICY IF EXISTS "authenticated users can update own recipes" ON public.recipes;
DROP POLICY IF EXISTS "authenticated users can delete own recipes" ON public.recipes;

DROP POLICY IF EXISTS "authenticated users can select own tags" ON public.tags;
DROP POLICY IF EXISTS "authenticated users can insert own tags" ON public.tags;
DROP POLICY IF EXISTS "authenticated users can update own tags" ON public.tags;
DROP POLICY IF EXISTS "authenticated users can delete own tags" ON public.tags;

DROP POLICY IF EXISTS "authenticated users can select own collections" ON public.collections;
DROP POLICY IF EXISTS "authenticated users can insert own collections" ON public.collections;
DROP POLICY IF EXISTS "authenticated users can update own collections" ON public.collections;
DROP POLICY IF EXISTS "authenticated users can delete own collections" ON public.collections;

DROP POLICY IF EXISTS "authenticated users can select own recipe tags" ON public.recipe_tags;
DROP POLICY IF EXISTS "authenticated users can insert own recipe tags" ON public.recipe_tags;
DROP POLICY IF EXISTS "authenticated users can delete own recipe tags" ON public.recipe_tags;

DROP POLICY IF EXISTS "authenticated users can select own recipe collections" ON public.recipe_collections;
DROP POLICY IF EXISTS "authenticated users can insert own recipe collections" ON public.recipe_collections;
DROP POLICY IF EXISTS "authenticated users can delete own recipe collections" ON public.recipe_collections;

-- KROK 3: Zweryfikuj czy RLS jest wyłączony na STARYCH tabelach
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles', 'categories', 'recipes', 'tags', 
    'collections', 'recipe_tags', 'recipe_collections'
);
-- STARE tabele powinny mieć rowsecurity = false

-- KROK 4: Zweryfikuj że NOWE tabele nadal mają RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
    'normalized_ingredients_jobs', 'recipe_normalized_ingredients'
);
-- NOWE tabele powinny mieć rowsecurity = true

-- KROK 5: Zweryfikuj liczby polityk
SELECT COUNT(*) as total_policies FROM pg_policies WHERE schemaname = 'public';
-- Powinno zwrócić ~15 (tylko polityki nowych tabel)
```

### Po Rollbacku

1. **Zamknij okno maintenance** (jeśli było aktywne)
2. **Zweryfikuj działanie aplikacji** bez RLS
3. **Przeanalizuj przyczynę** niepowodzenia
4. **Zapisz logi i błędy** do późniejszej analizy
5. **Zaplanuj ponowną próbę** po rozwiązaniu problemów

---

## 📊 Krok 8: Monitoring Po Wdrożeniu

---

## 📊 Polityki RLS - Podsumowanie

### Tabela: `profiles`
- ✅ Użytkownicy mogą czytać/modyfikować tylko swój profil
- 🔒 Wymagane uwierzytelnienie

### Tabela: `categories`
- ✅ Wszystcy (nawet niezalogowani) mogą czytać
- 🔒 Tylko admini mogą modyfikować (przez migracje)

### Tabela: `recipes`
- ✅ Użytkownicy mogą czytać/modyfikować tylko swoje przepisy
- ✅ Soft-deleted przepisy są ukryte (`deleted_at IS NULL`)
- 🔒 Wymagane uwierzytelnienie

### Tabela: `tags`
- ✅ Użytkownicy mogą czytać/modyfikować tylko swoje tagi
- 🔒 Wymagane uwierzytelnienie

### Tabela: `collections`
- ✅ Użytkownicy mogą czytać/modyfikować tylko swoje kolekcje
- 🔒 Wymagane uwierzytelnienie

### Tabele: `recipe_tags` i `recipe_collections`
- ✅ Użytkownicy mogą łączyć tylko swoje przepisy ze swoimi tagami/kolekcjami
- 🔒 Weryfikacja właściciela po obu stronach relacji

---

## 🔥 Checklist Wdrożenia

Przed wdrożeniem na produkcję, upewnij się że:

- [ ] Usunąłeś plik `20251125121000_disable_rls_for_development.sql`
- [ ] Uruchomiłeś wszystkie migracje na produkcji
- [ ] Zweryfikowałeś że RLS jest włączony na wszystkich tabelach
- [ ] Zweryfikowałeś że wszystkie 24 polityki zostały utworzone
- [ ] Przetestowałeś że użytkownicy widzą tylko swoje dane
- [ ] Przetestowałeś że użytkownicy nie mogą modyfikować cudzych danych
- [ ] Przetestowałeś że kategorie są dostępne publicznie

### Pierwsze 24 godziny (KRYTYCZNE)

1. **Monitoruj logi błędów w Supabase Dashboard:**
   - Przejdź do **Logs** → **Error logs**
   - Szukaj błędów związanych z RLS:
     - `permission denied for table`
     - `new row violates row-level security policy`
     - `policy check violation`

2. **Monitoruj metryki wydajności:**
   - **Query Performance** w Dashboard
   - Sprawdź czy czas zapytań się nie zwiększył znacząco
   - RLS może nieznacznie zwiększyć czas zapytań (5-15%)

3. **Zbieraj feedback od użytkowników:**
   - Monitoruj zgłoszenia o błędach dostępu
   - Sprawdzaj czy użytkownicy zgłaszają problemy z logowaniem
   - Zwróć uwagę na skargi o "brak dostępu do własnych danych"

### Typowe Problemy i Rozwiązania

#### Problem: "permission denied for table recipes"

**Przyczyna:** Polityki RLS blokują dostęp  
**Rozwiązanie:**
```sql
-- Sprawdź czy użytkownik jest uwierzytelniony
SELECT auth.uid(); -- Nie powinno zwrócić NULL

-- Sprawdź czy polityka SELECT istnieje dla recipes
SELECT * FROM pg_policies 
WHERE tablename = 'recipes' AND cmd = 'SELECT';
```

#### Problem: Użytkownik widzi cudze dane

**Przyczyna:** Polityki RLS nie działają lub są źle skonfigurowane  
**❌ KRYTYCZNE - Wykonaj natychmiastowy rollback!**

#### Problem: Kategorie nie ładują się dla gości

**Przyczyna:** Brak polityki `anon` dla categories  
**Rozwiązanie:**
```sql
-- Sprawdź politykę dla anon
SELECT * FROM pg_policies 
WHERE tablename = 'categories' AND roles @> ARRAY['anon'::name];
```

#### Problem: Zapytania są bardzo wolne po włączeniu RLS

**Przyczyna:** Brak odpowiednich indeksów  
**Rozwiązanie:**
```sql
-- Sprawdź czy istnieją indeksy na user_id
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%user_id%';
```

---

## 🔐 Krok 9: Finalizacja i Dokumentacja

### Po Pomyślnym Wdrożeniu

1. **Zapisz raport wdrożenia:**
   ```
   Data wdrożenia: YYYY-MM-DD HH:MM
   Czas trwania: XX minut
   Backup: backup_before_rls_YYYYMMDD_HHMMSS.sql
   Status: ✅ SUKCES
   Liczba utworzonych polityk: 24
   Wykryte problemy: [lista lub "brak"]
   ```

2. **Usuń plik deweloperski z repozytorium:**
   ```bash
   git rm supabase/migrations/20251125121000_disable_rls_for_development.sql
   git commit -m "Remove dev-only RLS disable migration after production deployment"
   git push
   ```

3. **Zaktualizuj dokumentację:**
   - Oznacz w dokumentacji że RLS jest **AKTYWNE** na produkcji
   - Zapisz datę włączenia
   - Dodaj notatkę o successful deployment

4. **Zamknij okno maintenance** (jeśli było aktywne)

5. **Komunikat dla użytkowników:**
   ```
   "Konserwacja zakończona. Aplikacja działa normalnie.
   Zwiększyliśmy bezpieczeństwo Twoich danych!"
   ```

---

## 📋 Checklist Wdrożenia RLS na Produkcji

**Przed włączeniem RLS:**
- [ ] Utworzono backup bazy danych
- [ ] Zapisano znacznik czasu backupu
- [ ] Zweryfikowano obecny stan RLS (stare tabele: `rowsecurity = false`, nowe: `true`)
- [ ] Sprawdzono że nowe tabele mają już ~15 polityk
- [ ] Zapisano liczby rekordów w WSZYSTKICH tabelach (12 tabel)
- [ ] Przygotowano komunikat dla użytkowników (opcjonalnie)
- [ ] Przygotowano plan rollbacku

**Włączanie RLS:**
- [ ] Uruchomiono skrypt `enable_rls_for_production.sql`
- [ ] Zapisano znacznik czasu wykonania skryptu
- [ ] Zweryfikowano że WSZYSTKIE 12 tabel mają `rowsecurity = true`
- [ ] Zweryfikowano że utworzono 39 polityk ŁĄCZNIE (24 nowe + 15 istniejących)

**Po włączeniu RLS:**
- [ ] Liczby rekordów są identyczne jak przed włączeniem
- [ ] Test logowania: użytkownik może się zalogować
- [ ] Test dostępu: użytkownik widzi swoje przepisy
- [ ] Test izolacji: użytkownik NIE widzi cudzych prywatnych przepisów
- [ ] Test gościa: niezalogowani widzą publiczne przepisy i kategorie
- [ ] Test CRUD: tworzenie/edycja/usuwanie własnych przepisów działa
- [ ] Test wieloużytkownikowy: dwóch użytkowników NIE widzi swoich danych nawzajem

**Monitoring (pierwsze 24h):**
- [ ] Sprawdzano logi błędów co 2-4 godziny
- [ ] Monitorowano wydajność zapytań
- [ ] Zbierano feedback od użytkowników
- [ ] Nie wykryto krytycznych problemów

**Finalizacja:**
- [ ] Zapisano raport wdrożenia
- [ ] Usunięto plik deweloperski z repo
- [ ] Zaktualizowano dokumentację
- [ ] Zamknięto okno maintenance
- [ ] Wysłano komunikat do użytkowników

---

## 🆕 Dla Nowych Wdrożeń (Przyszłe Projekty)

**Jeśli zakładasz nowy projekt od zera:**

### Krok 1: NIE dodawaj pliku deweloperskiego na produkcję

```bash
# Plik ten powinien być TYLKO w lokalnym środowisku dev:
# supabase/migrations/20251125121000_disable_rls_for_development.sql

# Upewnij się że .gitignore lub proces wdrożenia go wyklucza
```

### Krok 2: Uruchom migracje bez deweloperskiego pliku

```bash
# Połącz się z nową produkcyjną bazą
supabase link --project-ref new-production-project-ref

# Uruchom migracje (RLS będzie włączony od razu)
supabase db push
```

**Wszystkie polityki RLS zostaną automatycznie utworzone!**

### Krok 3: Weryfikacja

Wykonaj testy z **Kroku 5** i **Kroku 6** tego dokumentu.

**Oczekiwany wynik dla świeżego wdrożenia:**
- ✅ Wszystkie 12 tabel z RLS włączonym
- ✅ Wszystkie ~39 polityk utworzonych
- ✅ Brak luk bezpieczeństwa od pierwszego dnia

---

## 📞 Pomoc i Troubleshooting

### Supabase Dashboard

1. **Logs** → **Error logs**: Sprawdź błędy związane z RLS
2. **Database** → **Roles**: Sprawdź role `anon` i `authenticated`
3. **Database** → **Policies**: Przeglądaj polityki w UI
4. **API Docs**: Sprawdź czy endpointy odzwierciedlają polityki RLS

### Przydatne Zapytania Debugowania

```sql
-- Sprawdź bieżącą rolę
SELECT current_user, session_user;

-- Sprawdź czy auth.uid() działa
SELECT auth.uid();

-- Sprawdź polityki dla konkretnej tabeli
SELECT * FROM pg_policies WHERE tablename = 'recipes';

-- Sprawdź indeksy dla user_id
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND indexdef LIKE '%user_id%';

-- Wyjaśnij plan zapytania z RLS
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM recipes WHERE user_id = auth.uid();
```

### Kontakt z Supportem

Jeśli problemy utrzymują się:
1. Przygotuj dokładny opis problemu
2. Dołącz logi błędów z Supabase Dashboard
3. Dołącz wyniki zapytań weryfikacyjnych
4. Opisz kroki jakie podjąłeś do tej pory
5. Skontaktuj się z zespołem deweloperskim lub Supabase Support

---

## 🎯 Kluczowe Zasady

> **RLS to Twoja pierwsza linia obrony!**
> 
> Nawet jeśli frontend ma błędy, RLS zapewnia że użytkownicy nie mogą dostać się do cudzych danych na poziomie bazy.

### Pamiętaj:

✅ **RLS MUSI BYĆ WŁĄCZONY na produkcji**  
✅ **ZAWSZE rób backup przed zmianami w RLS**  
✅ **TESTUJ dokładnie po włączeniu RLS**  
✅ **MONITORUJ pierwsze 24h po wdrożeniu**  
✅ **NIGDY nie wyłączaj RLS na produkcji bez BARDZO dobrego powodu**

### Czerwone Flagi (Natychmiastowy Rollback):

🚨 Użytkownicy widzą cudze dane  
🚨 Liczba rekordów się zmieniła po włączeniu RLS  
🚨 Polityki nie zostały utworzone  
🚨 Masowe błędy 403/401 w aplikacji  
🚨 Użytkownicy nie mogą uzyskać dostępu do własnych danych

---

**Dokument zaktualizowany:** 2026-02-10  
**Wersja:** 2.1 (Produkcja z częściowym RLS → Pełne włączenie RLS)  
**Status produkcji:** ⚠️ RLS CZĘŚCIOWO WŁĄCZONY (5/12 tabel) - WYMAGA AKCJI  
**Zakres:** 7 starych tabel wymaga naprawy + 5 nowych tabel już OK

