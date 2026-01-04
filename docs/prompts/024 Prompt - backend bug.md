Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z dokumentamu projektu

<dokumnety_projektowe>



</dokumnety_projektowe>



<aktualne_zachowanie>

endpoint GET http://127.0.0.1:54331/functions/v1/recipes/1


zwraca
{
  "id": 1,
  "user_id": "c553b8d1-3dbb-488f-b610-97eb6f95d357",
  "category_id": 4,
  "name": "Bigos",
  "description": "Tradycyjna polska potrawa z kapusty i mięsa, idealna na chłodne dni.",
  "image_path": null,
  "created_at": "2026-01-03T22:38:16.317842+00:00",
  "updated_at": "2026-01-04T10:49:32.892167+00:00",
  "category_name": "Danie główne",
  "visibility": "PUBLIC",
  "ingredients": [
    {
      "type": "header",
      "content": "Mięso\r"
    },
    {
      "type": "item",
      "content": "500g wieprzowiny (karkówka lub szynka)\r"
    },
    {
      "type": "item",
      "content": "200g kiełbasy\r"
    },
    {
      "type": "item",
      "content": "100g boczku wędzonego\r"
    },
    {
      "type": "header",
      "content": "Warzywa\r"
    },
    {
      "type": "item",
      "content": "1 kg kapusty kiszonej\r"
    },
    {
      "type": "item",
      "content": "500g kapusty świeżej\r"
    },
    {
      "type": "item",
      "content": "2 cebule\r"
    },
    {
      "type": "item",
      "content": "2 łyżki koncentratu pomidorowego\r"
    },
    {
      "type": "header",
      "content": "Przyprawy\r"
    },
    {
      "type": "item",
      "content": "2 liście laurowe\r"
    },
    {
      "type": "item",
      "content": "5 ziaren ziela angielskiego\r"
    },
    {
      "type": "item",
      "content": "sól, pieprz\r"
    },
    {
      "type": "item",
      "content": "1 łyżka majeranku"
    }
  ],
  "steps": [
    {
      "type": "header",
      "content": "Przygotowanie\r"
    },
    {
      "type": "item",
      "content": "Mięso pokrój na kawałki i podsmaż na patelni.\r"
    },
    {
      "type": "item",
      "content": "Cebulę pokrój w kostkę i zeszklij na tłuszczu z mięsa.\r"
    },
    {
      "type": "item",
      "content": "Kapustę kiszoną przepłucz i odciśnij, świeżą poszatkuj.\r"
    },
    {
      "type": "item",
      "content": "Wszystko połącz w dużym garnku, dodaj przyprawy.\r"
    },
    {
      "type": "item",
      "content": "Gotuj na małym ogniu przez 2-3 godziny, często mieszając.\r"
    },
    {
      "type": "item",
      "content": "Pod koniec dodaj pokrojoną kiełbasę i boczek.\r"
    },
    {
      "type": "item",
      "content": "Dopraw do smaku solą, pieprzem i majerankiem."
    }
  ],
  "tags": [],
  "servings": null,
  "is_termorobot": false,
  "in_my_plan": true,
  "prep_time_minutes": null,
  "total_time_minutes": null,
  "diet_type": null,
  "cuisine": null,
  "difficulty": null
}


nie zwraca flagi "is_grill"

</aktualne_zachowanie>


<oczekiwane_zachowanie>

zwraca flagę "is_grill"

</oczekiwane_zachowanie>


<implementation_rules>



</implementation_rules>



Przeanalizuj przedstawiony bug, porównując aktualne zachowanie z oczekiwanym zachowaniem. Uwzględnij wszystkie dostarczone materiały: PRD, stos technologiczny, plan API, typy oraz aktualną implementację.

Przed podaniem rozwiązania, użyj tagów <analiza> do przemyślenia problemu:
- Zidentyfikuj różnice między aktualnym a oczekiwanym zachowaniem
- Przeanalizuj aktualną implementację w kontekście planu API i typów
- Określ prawdopodobną przyczynę buga
- Zaplanuj kroki naprawy

Następnie napraw buga.

Pamiętaj, że wszystkie odpowiedzi, komentarze w kodzie i wyjaśnienia mają być w języku polskim. Kod powinien być gotowy do implementacji i zgodny z przedstawionym stosem technologicznym oraz planem API.

