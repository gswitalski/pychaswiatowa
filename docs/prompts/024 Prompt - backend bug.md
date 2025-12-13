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

<aktualna_implementacja>




</aktualna_implementacja>

<aktualne_zachowanie>
wywołuj  eendpoint PUT
http://127.0.0.1:54331/functions/v1/recipes/1
z wartosciami:
{
  "name": "Bigos",
  "description": "Tradycyjna polska potrawa z kapusty i mięsa, idealna na chłodne dni.",
  "category_id": 4,
  "visibility": "PUBLIC",
  "ingredients_raw": "# Mięso\r\n500g wieprzowiny (karkówka lub szynka)\r\n200g kiełbasy\r\n100g boczku wędzonego\r\n# Warzywa\r\n1 kg kapusty kiszonej\r\n500g kapusty świeżej\r\n2 cebule\r\n2 łyżki koncentratu pomidorowego\r\n# Przyprawy\r\n2 liście laurowe\r\n5 ziaren ziela angielskiego\r\nsól, pieprz\r\n1 łyżka majeranku",
  "steps_raw": "# Przygotowanie\r\nMięso pokrój na kawałki i podsmaż na patelni.\r\nCebulę pokrój w kostkę i zeszklij na tłuszczu z mięsa.\r\nKapustę kiszoną przepłucz i odciśnij, świeżą poszatkuj.\r\nWszystko połącz w dużym garnku, dodaj przyprawy.\r\nGotuj na małym ogniu przez 2-3 godziny, często mieszając.\r\nPod koniec dodaj pokrojoną kiełbasę i boczek.\r\nDopraw do smaku solą, pieprzem i majerankiem.",
  "tags": [],
  "image_path": "http://127.0.0.1:54331/storage/v1/object/public/recipe-images/c553b8d1-3dbb-488f-b610-97eb6f95d357/1765627888169.jpg"
}

w odpowiedzi dostaję
{
  "id": 1,
  "user_id": "c553b8d1-3dbb-488f-b610-97eb6f95d357",
  "category_id": 4,
  "name": "Bigos",
  "description": "Tradycyjna polska potrawa z kapusty i mięsa, idealna na chłodne dni.",
  "image_path": null,
  "created_at": "2025-12-13T12:06:36.252031+00:00",
  "updated_at": "2025-12-13T12:11:28.308255+00:00",
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
  "tags": []
}

</aktualne_zachowanie>

<oczekiwane_zachowanie>

zamiast "image_path": null, powinienem miec sciezke do obrazka. ścieżka nie zapisuje się w bazie


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

