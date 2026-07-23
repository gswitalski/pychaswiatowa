# Włączenie Row Level Security (RLS) na produkcji

## Status obecny

### Produkcja – WYMAGA AKCJI

**Stare tabele (7) – RLS WYŁĄCZONY:**
- `profiles`, `categories`, `recipes`, `tags`, `collections`, `recipe_tags`, `recipe_collections`
- ❌ Brak polityk bezpieczeństwa
- 🚨 Ryzyko: **WYSOKIE** – użytkownicy mogą mieć dostęp do cudzych danych

**Nowe tabele (5) – RLS WŁĄCZONY:**
- `plan_recipes`, `shopping_list_items`, `shopping_list_recipe_contributions`, `normalized_ingredients_jobs`, `recipe_normalized_ingredients`
- ✅ ~15 polityk aktywnych
- ✅ Ryzyko: niskie

**Widok (1) – WYMAGA KONFIGURACJI:**
- `recipe_details` – widok (nie tabela), wymaga ustawienia `security_invoker = true`

### Development – OK (celowo wyłączony)
- Plik: `supabase/migrations/20251125121000_disable_rls_for_development.sql`

---

## Dlaczego część tabel już ma RLS?

1. **Pierwotne wdrożenie:** Bazowe tabele wdrożone BEZ RLS (szybszy rozwój)
2. **Późniejsze funkcje:** Lista zakupów, plan przepisów, worker – wdrożone OD RAZU z RLS
3. **Efekt:** Hybrydowy stan – ten skrypt naprawia tę niespójność

### Widoki vs tabele w kontekście RLS

- **Tabele** mają flagę `rowsecurity` (ON/OFF) i własne polityki
- **Widoki** nie mają flagi `rowsecurity` – **dziedziczą** RLS z tabel bazowych
- `recipe_details` bazuje na `recipes` → po włączeniu RLS na `recipes`, widok automatycznie respektuje polityki
- `security_invoker = true` gwarantuje, że widok wykonuje się z uprawnieniami **użytkownika**, nie właściciela widoku

---

## Plan wdrożenia – przegląd

| Krok | Czas | Opis |
|------|------|------|
| 1. Weryfikacja stanu | 5 min | Sprawdzenie obecnego RLS i zapisanie liczb rekordów |
| 2. Backup | 10-30 min | Obowiązkowy backup bazy |
| 3. Komunikacja | opcjonalnie | Okno maintenance dla użytkowników |
| 4. Wykonanie skryptu | 2-5 min | Uruchomienie `enable_rls_for_production.sql` |
| 5. Weryfikacja | 10 min | Sprawdzenie RLS, polityk, rekordów |
| 6. Test funkcjonalny | 15 min | Testy przez aplikację |

**Szacowany czas okna maintenance:** 15-45 minut

---

## Krok 1: Weryfikacja stanu przed zmianą

### 1.1. Sprawdź stan RLS na wszystkich tabelach

Supabase Dashboard → SQL Editor:

```sql
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
    'profiles', 'categories', 'recipes', 'tags', 
    'collections', 'recipe_tags', 'recipe_collections',
    'plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
    'normalized_ingredients_jobs', 'recipe_normalized_ingredients'
)
ORDER BY tablename;
```

**Oczekiwany wynik:** 7 tabel z `false`, 5 tabel z `true`.

### 1.2. Sprawdź istniejące polityki

```sql
SELECT 
    tablename, 
    COUNT(*) as policy_count,
    array_agg(cmd ORDER BY cmd) as commands
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Oczekiwany wynik:** ~15 polityk tylko dla nowych tabel.

### 1.3. Zapisz liczbę rekordów

```sql
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

⚠️ **ZAPISZ te liczby** – muszą być identyczne po wdrożeniu!

---

## Krok 2: Backup bazy danych

**OBOWIĄZKOWE przed jakimikolwiek zmianami!**

### Opcja A: Przez Dashboard (zalecana)

1. Supabase Dashboard → **Database** → **Backups**
2. Kliknij **Create backup now**
3. Zapisz znacznik czasu backupu
4. Poczekaj na potwierdzenie

### Opcja B: Przez CLI

```bash
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres" > backup_before_rls_$(date +%Y%m%d_%H%M%S).sql
ls -lh backup_before_rls_*.sql
```

---

## Krok 3: Komunikacja (opcjonalne okno maintenance)

### Z oknem maintenance (zalecane)

1. Ustaw banner/redirect w aplikacji:
   ```
   "Wykonujemy krótką konserwację techniczną.
   Aplikacja będzie niedostępna przez ok. 15-30 minut."
   ```
2. (Opcjonalnie) Zablokuj nowe połączenia do API

### Bez okna maintenance (ryzykowne)

- ⚠️ Użytkownicy mogą doświadczyć błędów przez kilka minut
- ⚠️ Niektóre zapytania mogą zostać odrzucone podczas przełączania

---

## Krok 4: Wykonanie skryptu RLS

### Metoda A: Przez Dashboard (zalecana dla pierwszego razu)

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Otwórz lokalnie plik [`enable_rls_for_production.sql`](./enable_rls_for_production.sql)
3. Skopiuj całą zawartość → wklej do SQL Editor
4. Przejrzyj dokładnie skrypt
5. Kliknij **Run** (Ctrl+Enter)
6. Poczekaj na potwierdzenie
7. Zapisz znacznik czasu

### Metoda B: Przez CLI

```bash
supabase link --project-ref your-production-project-ref
supabase db execute --file docs/deployment/enable_rls_for_production.sql
```

### Oczekiwany czas wykonania

- Włączenie RLS: ~5 sekund
- Utworzenie 24 polityk: ~10-20 sekund
- **Całkowity czas: ~30 sekund**

---

## Krok 5: Weryfikacja po włączeniu

### 5.1. Weryfikacja podstawowa (OBOWIĄZKOWA)

#### RLS włączony na wszystkich tabelach

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
    'profiles', 'categories', 'recipes', 'tags', 
    'collections', 'recipe_tags', 'recipe_collections',
    'plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
    'normalized_ingredients_jobs', 'recipe_normalized_ingredients'
)
ORDER BY tablename;
```

✅ **WSZYSTKIE 12 tabel** powinny mieć `rowsecurity = true`

#### Liczba polityk

```sql
SELECT 
    tablename, 
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Oczekiwane wartości:**

| Tabela | Polityki | Źródło |
|--------|----------|--------|
| `profiles` | 4 | skrypt |
| `categories` | 2 | skrypt |
| `recipes` | 4 | skrypt |
| `tags` | 4 | skrypt |
| `collections` | 4 | skrypt |
| `recipe_tags` | 3 | skrypt |
| `recipe_collections` | 3 | skrypt |
| `plan_recipes` | 3 | migracja |
| `shopping_list_items` | 4 | migracja |
| `shopping_list_recipe_contributions` | 3 | migracja |
| `normalized_ingredients_jobs` | 3 | migracja |
| `recipe_normalized_ingredients` | 2 | migracja |
| **ŁĄCZNIE** | **39** | 24 nowych + 15 istniejących |

#### Liczba rekordów (bez zmian!)

Uruchom to samo zapytanie co w Kroku 1.3 – liczby **MUSZĄ** być identyczne.

### 5.2. Weryfikacja funkcjonalna (ZALECANA)

#### Dostęp do kategorii (publiczne)

```sql
SET ROLE anon;
SELECT COUNT(*) FROM public.categories;
-- Powinno zwrócić wszystkie kategorie
RESET ROLE;
```

#### Izolacja danych użytkowników

```sql
SELECT id, username FROM public.profiles LIMIT 2;
-- Zapisz UUID dwóch użytkowników

SET request.jwt.claims TO '{"sub": "USER1_UUID"}';
SELECT COUNT(*) FROM public.recipes WHERE user_id = 'USER1_UUID';
-- Powinno zwrócić przepisy user1

SELECT COUNT(*) FROM public.recipes WHERE user_id = 'USER2_UUID';
-- Powinno zwrócić 0

RESET request.jwt.claims;
```

---

## Krok 6: Testy przez aplikację

### 6.1. Logowanie i dostęp

- ✅ Logowanie działa normalnie
- ✅ Dashboard się ładuje
- ✅ "Moje przepisy" widoczne (tylko własne)
- ✅ Liczba przepisów zgadza się

### 6.2. Operacje CRUD

- ✅ Utworzenie nowego przepisu
- ✅ Edycja własnego przepisu
- ✅ Usunięcie własnego przepisu
- ✅ Utworzenie kolekcji i dodanie przepisu

### 6.3. Test wieloużytkownikowy (KRYTYCZNY)

1. **User A:** Utwórz prywatny przepis "Test RLS - User A"
2. **User B:** Spróbuj wejść na `/recipes/:id` przepisu User A
   - ✅ Powinno zwrócić **404**
   - ✅ Przepis nie widoczny w wyszukiwaniu User B
   - ✅ Przepis nie widoczny w dashboardzie User B

❌ **Jeśli User B widzi przepis User A → NATYCHMIASTOWY ROLLBACK!**
(Patrz: [Rollback i monitoring](./rls-rollback-and-monitoring.md))

### 6.4. Dostęp publiczny

- ✅ Wyloguj się
- ✅ `/explore` – publiczne przepisy widoczne
- ✅ Kategorie się ładują

---

## Podsumowanie polityk RLS

| Tabela | Zasada dostępu |
|--------|----------------|
| `profiles` | Użytkownik czyta/modyfikuje tylko swój profil |
| `categories` | Wszyscy (nawet anon) mogą czytać; modyfikacja tylko przez migracje |
| `recipes` | Własne przepisy + publiczne (SELECT); CRUD tylko własne; soft-delete respektowany |
| `tags` | CRUD tylko własne tagi |
| `collections` | CRUD tylko własne kolekcje |
| `recipe_tags` | Łączenie tylko własnych przepisów z własnymi tagami |
| `recipe_collections` | Łączenie własnych kolekcji z własnymi/publicznymi przepisami |

---

## Checklista wdrożenia

### Przed włączeniem RLS
- [ ] Backup bazy danych utworzony
- [ ] Znacznik czasu backupu zapisany
- [ ] Stan RLS zweryfikowany (stare: `false`, nowe: `true`)
- [ ] Liczby rekordów zapisane
- [ ] Plan rollbacku przygotowany (patrz [rollback](./rls-rollback-and-monitoring.md))
- [ ] Komunikat dla użytkowników (opcjonalnie)

### Włączanie RLS
- [ ] Skrypt `enable_rls_for_production.sql` uruchomiony
- [ ] Znacznik czasu wykonania zapisany
- [ ] WSZYSTKIE 12 tabel: `rowsecurity = true`
- [ ] 39 polityk ŁĄCZNIE (24 nowe + 15 istniejących)

### Po włączeniu RLS
- [ ] Liczby rekordów identyczne
- [ ] Logowanie działa
- [ ] Użytkownik widzi swoje przepisy
- [ ] Użytkownik NIE widzi cudzych prywatnych przepisów
- [ ] Goście widzą publiczne przepisy i kategorie
- [ ] CRUD własnych przepisów działa
- [ ] Test wieloużytkownikowy przeszedł

---

**Powiązane dokumenty:**
- [RLS – Rollback i monitoring](./rls-rollback-and-monitoring.md) – procedury awaryjne i monitoring
- [Skrypt SQL](./enable_rls_for_production.sql) – wykonywalny skrypt
- [CI/CD Pipeline](./ci-cd-pipeline.md) – automatyczne wdrożenie migracji

---

**Ostatnia aktualizacja:** 2026-07-21  
**Status produkcji:** ⚠️ RLS CZĘŚCIOWO WŁĄCZONY (5/12 tabel) – WYMAGA AKCJI
