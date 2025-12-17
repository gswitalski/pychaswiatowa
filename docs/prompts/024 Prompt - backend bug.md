Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z dokumentamu projektu

<dokumnety_projektowe>



</dokumnety_projektowe>



<aktualne_zachowanie>
endpoint POST http://127.0.0.1:54331/functions/v1/recipes/import
z body:
{
  "raw_text": "# Za’atar – wersja dostępna w polskich sklepach\n\n## Opis\nBliskowschodnia klasyka w sprytnej adaptacji: oregano i tymianek udają za’atar, a efekt jest zaskakująco autentyczny. Idealny dowód, że geografia nie musi ograniczać smaku.\n\n## Składniki\n- 1/2 szklanki suszonego oregano\n- 2 łyżki suszonego tymianku\n- 3 łyżki sezamu niesolonego\n- 2 łyżki sumaku\n- 1/2 łyżeczki soli morskiej\n\n## Kroki\n- Prażyć sezam na suchej patelni na średnim ogniu przez 5–10 minut, mieszając, aż lekko zbrązowieje i zacznie pachnieć orzechowo\n- Zmielić oregano i tymianek w młynku do kawy lub moździerzu na drobny proszek\n- Połączyć wszystkie składniki w misce i dokładnie wymieszać\n\n## Przechowywanie i użycie\n- Przechowywać w szczelnym słoiku, w suchym i ciemnym miejscu, do 6 miesięcy  \n- Używać do oliwy z chlebem, hummusu, grillowanych warzyw lub mięs; można posypywać bezpośrednio lub mieszać z oliwą"
}
zwraca
{
  "id": 52,
  "user_id": "c553b8d1-3dbb-488f-b610-97eb6f95d357",
  "category_id": null,
  "name": "Za’atar – wersja dostępna w polskich sklepach",
  "description": null,
  "image_path": null,
  "created_at": "2025-12-17T21:12:47.637536+00:00",
  "updated_at": "2025-12-17T21:12:47.637536+00:00",
  "category_name": null,
  "visibility": "PRIVATE",
  "ingredients": [
    {
      "type": "item",
      "content": "1/2 szklanki suszonego oregano"
    },
    {
      "type": "item",
      "content": "2 łyżki suszonego tymianku"
    },
    {
      "type": "item",
      "content": "3 łyżki sezamu niesolonego"
    },
    {
      "type": "item",
      "content": "2 łyżki sumaku"
    },
    {
      "type": "item",
      "content": "1/2 łyżeczki soli morskiej"
    }
  ],
  "steps": [
    {
      "type": "item",
      "content": "Prażyć sezam na suchej patelni na średnim ogniu przez 5–10 minut, mieszając, aż lekko zbrązowieje i zacznie pachnieć orzechowo"
    },
    {
      "type": "item",
      "content": "Zmielić oregano i tymianek w młynku do kawy lub moździerzu na drobny proszek"
    },
    {
      "type": "item",
      "content": "Połączyć wszystkie składniki w misce i dokładnie wymieszać"
    }
  ],
  "tags": [],
  "servings": null
}

</aktualne_zachowanie>


<oczekiwane_zachowanie>

endpoin zwaca description takie jak było podane na wejści (nie zapisuje się w bazie)

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

