# RLS – Rollback i Monitoring

## Kiedy wykonać rollback?

Natychmiastowy rollback jeśli:
- 🚨 Użytkownicy widzą cudze dane
- 🚨 Liczba rekordów się zmieniła po włączeniu RLS
- 🚨 Polityki nie zostały utworzone (mniej niż 24 nowych)
- 🚨 Masowe błędy 403/401 w aplikacji
- 🚨 Użytkownicy nie mogą uzyskać dostępu do własnych danych
- 🚨 RLS nie włączył się na wszystkich tabelach

---

## Procedura rollback

### Opcja A: Przywrócenie backupu (najszybsza, najbezpieczniejsza)

1. Supabase Dashboard → **Database** → **Backups**
2. Znajdź backup sprzed włączenia RLS (znacznik czasu z Kroku 2 procedury wdrożenia)
3. Kliknij **Restore**
4. Potwierdź przywrócenie
5. Poczekaj (~5-15 minut)
6. Zweryfikuj stan bazy

### Opcja B: Ręczne wyłączenie RLS

Użyj gdy backup jest niedostępny lub zbyt stary.

⚠️ Ten rollback wyłącza RLS **TYLKO na starych tabelach**. Nowe tabele (`plan_recipes`, `shopping_list_*`, `normalized_ingredients_*`) **POZOSTANĄ z RLS** – to zamierzone!

```sql
-- KROK 1: Wyłącz RLS na STARYCH tabelach
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_collections DISABLE ROW LEVEL SECURITY;

-- KROK 2: Usuń polityki STARYCH tabel (utworzone przez skrypt)
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

-- KROK 3: Weryfikacja – STARE tabele bez RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles', 'categories', 'recipes', 'tags', 
    'collections', 'recipe_tags', 'recipe_collections'
);
-- Oczekiwane: rowsecurity = false

-- KROK 4: Weryfikacja – NOWE tabele nadal z RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
    'normalized_ingredients_jobs', 'recipe_normalized_ingredients'
);
-- Oczekiwane: rowsecurity = true

-- KROK 5: Weryfikacja liczby polityk
SELECT COUNT(*) as total_policies FROM pg_policies WHERE schemaname = 'public';
-- Oczekiwane: ~15 (tylko polityki nowych tabel)
```

### Po rollbacku

1. Zamknij okno maintenance (jeśli było aktywne)
2. Zweryfikuj działanie aplikacji bez RLS
3. Przeanalizuj przyczynę niepowodzenia
4. Zapisz logi i błędy do późniejszej analizy
5. Zaplanuj ponowną próbę po rozwiązaniu problemów

---

## Monitoring po wdrożeniu

### Pierwsze 24 godziny (KRYTYCZNE)

#### 1. Logi błędów

Supabase Dashboard → **Logs** → **Error logs**

Szukaj:
- `permission denied for table`
- `new row violates row-level security policy`
- `policy check violation`

#### 2. Metryki wydajności

- **Query Performance** w Dashboard
- RLS może nieznacznie zwiększyć czas zapytań (5-15%)
- Alarm jeśli wzrost > 30%

#### 3. Feedback użytkowników

- Zgłoszenia o błędach dostępu
- Problemy z logowaniem
- "Brak dostępu do własnych danych"

### Harmonogram sprawdzeń

| Czas | Akcja |
|------|-------|
| +15 min | Weryfikacja logów, test wieloużytkownikowy |
| +1 h | Sprawdzenie metryk wydajności |
| +4 h | Przegląd logów błędów |
| +8 h | Ponowna weryfikacja |
| +24 h | Pełny przegląd, decyzja o zamknięciu incydentu |

---

## Typowe problemy i rozwiązania

### `permission denied for table recipes`

**Przyczyna:** Polityki RLS blokują dostęp

**Diagnostyka:**
```sql
SELECT auth.uid();
-- Nie powinno zwrócić NULL

SELECT * FROM pg_policies 
WHERE tablename = 'recipes' AND cmd = 'SELECT';
```

**Rozwiązanie:** Sprawdź czy użytkownik jest uwierzytelniony i czy token JWT jest prawidłowy.

### Użytkownik widzi cudze dane

**🚨 KRYTYCZNE – Wykonaj natychmiastowy rollback!**

Ten scenariusz oznacza, że polityki RLS nie działają prawidłowo.

### Kategorie nie ładują się dla gości

**Przyczyna:** Brak polityki `anon` dla `categories`

**Diagnostyka:**
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'categories' AND roles @> ARRAY['anon'::name];
```

**Rozwiązanie:** Polityka powinna zezwalać na SELECT dla roli `anon`. Jeśli jej brak → skrypt nie wykonał się prawidłowo.

### Zapytania bardzo wolne po włączeniu RLS

**Przyczyna:** Brak odpowiednich indeksów na `user_id`

**Diagnostyka:**
```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%user_id%';
```

**Rozwiązanie:** Dodaj indeksy na kolumnach `user_id` w tabelach, które ich nie mają.

### Użytkownik nie widzi swoich przepisów

**Przyczyna:** Polityka SELECT na `recipes` zawiera warunek `deleted_at IS NULL` – sprawdź czy przepisy nie są soft-deleted.

**Diagnostyka:**
```sql
SELECT id, name, deleted_at 
FROM recipes 
WHERE user_id = 'UUID_UZYTKOWNIKA';
```

---

## Przydatne zapytania debugowania

```sql
-- Bieżąca rola
SELECT current_user, session_user;

-- Czy auth.uid() działa
SELECT auth.uid();

-- Polityki dla konkretnej tabeli
SELECT * FROM pg_policies WHERE tablename = 'recipes';

-- Indeksy na user_id
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND indexdef LIKE '%user_id%';

-- Plan zapytania z RLS
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM recipes WHERE user_id = auth.uid();

-- Nazwy wszystkich polityk (do dokumentacji/audytu)
SELECT 
    tablename, 
    policyname, 
    cmd,
    roles::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
```

---

## Finalizacja po pomyślnym wdrożeniu

### Raport wdrożenia

```
Data wdrożenia: YYYY-MM-DD HH:MM
Czas trwania: XX minut
Backup: backup_before_rls_YYYYMMDD_HHMMSS.sql
Status: ✅ SUKCES
Liczba utworzonych polityk: 24
Wykryte problemy: [lista lub "brak"]
```

### Czynności po wdrożeniu

1. **Usuń plik deweloperski z repozytorium:**
   ```bash
   git rm supabase/migrations/20251125121000_disable_rls_for_development.sql
   git commit -m "chore: remove dev-only RLS disable migration after production deployment"
   git push
   ```

2. **Zaktualizuj dokumentację** – oznacz w README że RLS jest AKTYWNE na produkcji

3. **Zamknij okno maintenance** (jeśli było aktywne)

4. **Komunikat dla użytkowników:**
   ```
   "Konserwacja zakończona. Aplikacja działa normalnie.
   Zwiększyliśmy bezpieczeństwo Twoich danych!"
   ```

---

## Dla nowych wdrożeń (przyszłe projekty)

Jeśli zakładasz nowy projekt od zera:

### Nie dodawaj pliku deweloperskiego na produkcję

Plik `20251125121000_disable_rls_for_development.sql` powinien być TYLKO w lokalnym środowisku dev. Upewnij się, że proces wdrożenia go wyklucza.

### Uruchom migracje bez pliku deweloperskiego

```bash
supabase link --project-ref new-production-project-ref
supabase db push
```

Wszystkie polityki RLS zostaną automatycznie utworzone od pierwszego dnia.

### Weryfikacja

Wykonaj testy z sekcji "Krok 5" i "Krok 6" dokumentu [RLS – Procedura wdrożenia](./rls-deployment.md).

**Oczekiwany wynik:**
- ✅ Wszystkie 12 tabel z RLS
- ✅ Wszystkie ~39 polityk
- ✅ Brak luk bezpieczeństwa od pierwszego dnia

---

## Kluczowe zasady

> **RLS to Twoja pierwsza linia obrony!**
> Nawet jeśli frontend ma błędy, RLS zapewnia że użytkownicy nie mogą dostać się do cudzych danych na poziomie bazy.

✅ RLS **MUSI** być włączony na produkcji  
✅ **ZAWSZE** rób backup przed zmianami w RLS  
✅ **TESTUJ** dokładnie po włączeniu RLS  
✅ **MONITORUJ** pierwsze 24h po wdrożeniu  
✅ **NIGDY** nie wyłączaj RLS na produkcji bez bardzo dobrego powodu

---

**Powiązane dokumenty:**
- [RLS – Procedura wdrożenia](./rls-deployment.md) – plan i kroki włączenia RLS
- [Skrypt SQL](./enable_rls_for_production.sql) – wykonywalny skrypt

---

**Ostatnia aktualizacja:** 2026-07-21
