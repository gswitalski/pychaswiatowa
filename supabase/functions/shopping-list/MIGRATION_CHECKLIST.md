# Shopping List - Migration Checklist

## ✅ Migracje bazy danych

### Wymagane migracje (w kolejności):

1. **20260119120000_create_shopping_list_tables.sql** ✅
   - Tworzy tabelę `shopping_list_items` z polami dla RECIPE i MANUAL items
   - Constraint `check_recipe_kind_fields` wymusza poprawne pola dla każdego kind
   - RLS policies dla SELECT, INSERT, UPDATE, DELETE
   - Trigger `set_updated_at_shopping_list_items` dla auto-update `updated_at`
   - Indeksy: merge key dla RECIPE, user_id+kind, user_id+is_owned

2. **20260119180100_add_text_length_constraint_to_shopping_list.sql** ✅ (NEW)
   - Dodaje constraint `check_manual_text_length` dla pola `text` (1-200 znaków)
   - Defense in depth - dodatkowa walidacja na poziomie DB

### Weryfikacja struktury tabeli

```sql
-- Expected columns for shopping_list_items:
id              bigserial       PRIMARY KEY
user_id         uuid            NOT NULL DEFAULT auth.uid()
kind            text            NOT NULL CHECK (kind in ('RECIPE', 'MANUAL'))
name            text            NULL (RECIPE kind only)
amount          numeric         NULL (RECIPE kind only)
unit            text            NULL (RECIPE kind only)
text            text            NULL (MANUAL kind only)
is_owned        boolean         NOT NULL DEFAULT false
created_at      timestamptz     NOT NULL DEFAULT now()
updated_at      timestamptz     NOT NULL DEFAULT now()
```

### Constraints weryfikacja

- ✅ `check_recipe_kind_fields`: Wymusza poprawne pola per kind
- ✅ `check_manual_text_length`: Limit 1-200 znaków dla MANUAL text
- ✅ Unique index dla RECIPE merge key: (user_id, name, coalesce(unit, ''))

### RLS Policies weryfikacja

- ✅ SELECT: `auth.uid() = user_id`
- ✅ INSERT: `auth.uid() = user_id`
- ✅ UPDATE: `auth.uid() = user_id`
- ✅ DELETE: `auth.uid() = user_id AND kind = 'MANUAL'`

## 📝 Następne kroki (po zastosowaniu migracji)

1. **Zastosuj migracje lokalnie**:
   ```bash
   supabase db reset  # lub supabase db push
   ```

2. **Wygeneruj typy TypeScript**:
   ```bash
   supabase gen types typescript --local > supabase/functions/_shared/database.types.ts
   ```

3. **Weryfikuj typy w service**:
   - `shopping-list.service.ts` powinien mieć poprawny TypeScript type dla insert/select

4. **Uruchom Edge Function lokalnie**:
   ```bash
   supabase functions serve shopping-list
   ```

5. **Testuj endpoint** używając `test-requests.http`

## 🔍 Troubleshooting

### Problem: TypeScript error w service - brak typu dla shopping_list_items
**Rozwiązanie**: Uruchom `supabase gen types typescript --local`

### Problem: INSERT zwraca null zamiast rekordu
**Rozwiązanie**: Sprawdź czy RLS policy dla INSERT jest aktywna i poprawna

### Problem: Constraint violation przy INSERT
**Rozwiązanie**: Sprawdź czy:
- `kind` jest ustawione na 'MANUAL'
- `text` nie jest null i ma 1-200 znaków
- Pola `name`, `amount`, `unit` są null
