Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z następującymi materiałami:

<prd>



</prd>

<stos_technologiczny>



</stos_technologiczny>

<plan_api>



</plan_api>

<typy>



</typy>


<aktualne_zachowanie>
endpoint PUT http://127.0.0.1:54331/functions/v1/recipes/2
{
  "name": "Szarlotka",
  "description": "Klasyczne polskie ciasto z jabłkami, idealne na każdą okazję.",
  "category_id": null,
  "visibility": "SHARED",
  "ingredients_raw": "# Ciasto\r\n300g mąki pszennej\r\n200g masła\r\n100g cukru\r\n1 jajko\r\n1 łyżeczka proszku do pieczenia\r\n# Nadzienie\r\n1 kg jabłek (najlepiej kwaśnych)\r\n3 łyżki cukru\r\n1 łyżeczka cynamonu\r\n2 łyżki bułki tartej",
  "steps_raw": "# Przygotowanie ciasta\r\nMasło pokrój w kostki i połącz z mąką, cukrem i proszkiem do pieczenia.\r\nDodaj jajko i zagnieć ciasto.\r\nPodziel na 2 części (2/3 i 1/3), schłódź w lodówce.\r\n# Przygotowanie nadzienia\r\nJabłka obierz, usuń gniazda nasienne i pokrój w plastry.\r\nWymieszaj z cukrem i cynamonem.\r\n# Pieczenie\r\nWiększą część ciasta rozwałkuj i ułóż na dnie formy (średnica 26cm).\r\nPosyp bułką tartą, ułóż jabłka.\r\nRozwałkuj mniejszą część ciasta i przykryj jabłka.\r\nPiecz w temperaturze 180°C przez około 45 minut.",
  "tags": []
}


zwraca
{
  "id": 2,
  "user_id": "c553b8d1-3dbb-488f-b610-97eb6f95d357",
  "category_id": 7,
  "name": "Szarlotka",
  "description": "Klasyczne polskie ciasto z jabłkami, idealne na każdą okazję.",
  "image_path": null,
  "created_at": "2025-12-14T20:54:45.266461+00:00",
  "updated_at": "2025-12-14T22:02:47.923681+00:00",
  "category_name": "Deser",
  "visibility": "SHARED",
  "ingredients": [
    {
      "type": "header",
      "content": "Ciasto\r"
    },
    {
      "type": "item",
      "content": "300g mąki pszennej\r"
    },
    {
      "type": "item",
      "content": "200g masła\r"
    },
    {
      "type": "item",
      "content": "100g cukru\r"
    },
    {
      "type": "item",
      "content": "1 jajko\r"
    },
    {
      "type": "item",
      "content": "1 łyżeczka proszku do pieczenia\r"
    },
    {
      "type": "header",
      "content": "Nadzienie\r"
    },
    {
      "type": "item",
      "content": "1 kg jabłek (najlepiej kwaśnych)\r"
    },
    {
      "type": "item",
      "content": "3 łyżki cukru\r"
    },
    {
      "type": "item",
      "content": "1 łyżeczka cynamonu\r"
    },
    {
      "type": "item",
      "content": "2 łyżki bułki tartej"
    }
  ],
  "steps": [
    {
      "type": "header",
      "content": "Przygotowanie ciasta\r"
    },
    {
      "type": "item",
      "content": "Masło pokrój w kostki i połącz z mąką, cukrem i proszkiem do pieczenia.\r"
    },
    {
      "type": "item",
      "content": "Dodaj jajko i zagnieć ciasto.\r"
    },
    {
      "type": "item",
      "content": "Podziel na 2 części (2/3 i 1/3), schłódź w lodówce.\r"
    },
    {
      "type": "header",
      "content": "Przygotowanie nadzienia\r"
    },
    {
      "type": "item",
      "content": "Jabłka obierz, usuń gniazda nasienne i pokrój w plastry.\r"
    },
    {
      "type": "item",
      "content": "Wymieszaj z cukrem i cynamonem.\r"
    },
    {
      "type": "header",
      "content": "Pieczenie\r"
    },
    {
      "type": "item",
      "content": "Większą część ciasta rozwałkuj i ułóż na dnie formy (średnica 26cm).\r"
    },
    {
      "type": "item",
      "content": "Posyp bułką tartą, ułóż jabłka.\r"
    },
    {
      "type": "item",
      "content": "Rozwałkuj mniejszą część ciasta i przykryj jabłka.\r"
    },
    {
      "type": "item",
      "content": "Piecz w temperaturze 180°C przez około 45 minut."
    }
  ],
  "tags": []
}

nie zeruje kategorii
</aktualne_zachowanie>


<oczekiwane_zachowanie>

endpoint ustawia kategorię na null


</oczekiwane_zachowanie>


<implementation_rules>



</implementation_rules>


## Rozwiązanie

Bug został zidentyfikowany i naprawiony. 

### Przyczyna buga:

Funkcja PostgreSQL `update_recipe_with_tags` nie rozróżniała między dwoma przypadkami:
1. Parametr `category_id` nie został przekazany w request (undefined w TypeScript → null w SQL)
2. Parametr `category_id` został explicite ustawiony na null (null w TypeScript → null w SQL)

W obu przypadkach SQL otrzymywał `p_category_id = null`, a logika w linii 85-88:
```sql
category_id = case
    when p_category_id is not null then nullif(p_category_id, 0)
    else category_id
end,
```
wykonywała `else category_id`, pozostawiając starą wartość.

### Implementacja naprawy:

1. **Migracja SQL** (`20251214200000_fix_update_recipe_category_null.sql`):
   - Dodano nowy parametr `p_update_category boolean default false`
   - Zmieniono logikę aktualizacji category_id na:
     ```sql
     category_id = case
         when p_update_category then p_category_id
         else category_id
     end,
     ```
   - Zaktualizowano walidację category_id, aby sprawdzała flagę `p_update_category`

2. **Kod TypeScript** (`recipes.service.ts`):
   - Dodano zmienną `updateCategory = input.category_id !== undefined`
   - Przekazywanie `p_update_category: updateCategory` do funkcji RPC

### Jak to działa:

- Gdy `category_id` nie jest w payloadzie → `input.category_id === undefined` → `updateCategory = false` → SQL nie aktualizuje pola
- Gdy `category_id: null` jest w payloadzie → `input.category_id === null` (ale !== undefined) → `updateCategory = true` → SQL ustawia pole na `null`
- Gdy `category_id: 7` jest w payloadzie → `input.category_id === 7` → `updateCategory = true` → SQL ustawia pole na `7`

To rozwiązanie jest spójne z istniejącym podejściem użytym dla tagów (`p_update_tags`).


Przeanalizuj przedstawiony bug, porównując aktualne zachowanie z oczekiwanym zachowaniem. Uwzględnij wszystkie dostarczone materiały: PRD, stos technologiczny, plan API, typy oraz aktualną implementację.

Przed podaniem rozwiązania, użyj tagów <analiza> do przemyślenia problemu:
- Zidentyfikuj różnice między aktualnym a oczekiwanym zachowaniem
- Przeanalizuj aktualną implementację w kontekście planu API i typów
- Określ prawdopodobną przyczynę buga
- Zaplanuj kroki naprawy

Następnie napraw buga.

Pamiętaj, że wszystkie odpowiedzi, komentarze w kodzie i wyjaśnienia mają być w języku polskim. Kod powinien być gotowy do implementacji i zgodny z przedstawionym stosem technologicznym oraz planem API.

