# 🔒 Przewodnik Włączania Row Level Security (RLS) na Produkcji

## ⚠️ WAŻNE: Ten dokument jest KRYTYCZNY dla bezpieczeństwa produkcji

Obecnie RLS (Row Level Security) jest **WYŁĄCZONE** w środowisku deweloperskim dla łatwiejszego testowania. **MUSI** zostać włączone przed wdrożeniem na produkcję.

---

## 📋 Stan Obecny (Development)

W środowisku deweloperskim:
- ✅ RLS jest **WYŁĄCZONE** na wszystkich tabelach
- ✅ Wszystkie polityki bezpieczeństwa są **USUNIĘTE**
- ⚠️ **Wszystkie użytkownicy mają dostęp do wszystkich danych**

Plik odpowiedzialny za to:
```
supabase/migrations/20251125121000_disable_rls_for_development.sql
```

---

## 🚀 Kroki Przed Wdrożeniem na Produkcję

### Krok 1: Usuń migrację deweloperską

**PRZED** wdrożeniem na produkcję, usuń plik:

```bash
rm supabase/migrations/20251125121000_disable_rls_for_development.sql
```

### Krok 2: Uruchom migracje na produkcji

Po usunięciu pliku deweloperskiego, uruchom wszystkie migracje na środowisku produkcyjnym:

```bash
# Połącz się z produkcyjną bazą
supabase link --project-ref your-production-project-ref

# Uruchom migracje
supabase db push
```

**Wszystkie polityki RLS zostaną automatycznie utworzone!**

---

## 🔄 Alternatywna Metoda: Ręczne Włączenie RLS

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

## ✅ Weryfikacja RLS

Po włączeniu RLS, zweryfikuj czy wszystko działa poprawnie:

### 1. Sprawdź czy RLS jest włączony

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles', 
    'categories', 
    'recipes', 
    'tags', 
    'collections', 
    'recipe_tags', 
    'recipe_collections'
);
```

**Oczekiwany rezultat:** Wszystkie tabele powinny mieć `rowsecurity = true`

### 2. Sprawdź polityki bezpieczeństwa

```sql
SELECT 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Oczekiwany rezultat:** 
- `profiles`: 4 polityki (select, insert, update, delete dla authenticated)
- `categories`: 2 polityki (select dla anon i authenticated)
- `recipes`: 4 polityki (select, insert, update, delete dla authenticated)
- `tags`: 4 polityki (select, insert, update, delete dla authenticated)
- `collections`: 4 polityki (select, insert, update, delete dla authenticated)
- `recipe_tags`: 3 polityki (select, insert, delete dla authenticated)
- `recipe_collections`: 3 polityki (select, insert, delete dla authenticated)

**ŁĄCZNIE: 24 polityki**

---

## 🧪 Testowanie RLS

Po włączeniu RLS, przetestuj następujące scenariusze:

### Test 1: Użytkownik widzi tylko swoje dane

```typescript
// Zaloguj się jako User A
const { data: userARecipes } = await supabase
    .from('recipes')
    .select('*');

// userARecipes powinien zawierać TYLKO przepisy User A
```

### Test 2: Użytkownik nie może modyfikować cudzych danych

```typescript
// Próba aktualizacji przepisu innego użytkownika
const { error } = await supabase
    .from('recipes')
    .update({ name: 'Hacked!' })
    .eq('id', someOtherUserRecipeId);

// Powinien zwrócić błąd lub 0 zaktualizowanych wierszy
```

### Test 3: Kategorie są publiczne

```typescript
// Niezalogowany użytkownik
const { data: categories } = await supabase
    .from('categories')
    .select('*');

// Powinien zwrócić wszystkie kategorie
```

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

---

## 📞 Pomoc

Jeśli masz problemy z RLS:

1. Sprawdź logi Supabase w Dashboard → Logs
2. Sprawdź czy użytkownik jest zalogowany (`auth.uid()` nie jest null)
3. Sprawdź czy polityki są poprawnie zdefiniowane
4. Użyj `EXPLAIN` do debugowania zapytań SQL

---

## 🎯 Pamiętaj

> **RLS to Twoja pierwsza linia obrony!**
> 
> Nawet jeśli frontend ma błędy, RLS zapewnia że użytkownicy nie mogą dostać się do cudzych danych na poziomie bazy.

**NIGDY** nie wdrażaj na produkcję bez włączonego RLS! 🔒

