Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z dokumentamu projektu

<dokumnety_projektowe>



</dokumnety_projektowe>



<aktualne_zachowanie>
endpoint PUT

http://127.0.0.1:54331/functions/v1/recipes/3






{
  "name": "Rosół",
  "description": "Tradycyjna polska zupa, podstawa wielu dań. Idealny na niedzielny obiad.",
  "category_id": 3,
  "visibility": "PRIVATE",
  "ingredients_raw": "# Mięso\r\n1 kg mięsa wołowego (np. mostek)\r\n500g mięsa drobiowego (skrzydełka, nóżki)\r\n# Warzywa\r\n2 marchewki\r\n1 pietruszka\r\n1 seler\r\n1 cebula\r\n1 por\r\n2 ząbki czosnku\r\n# Przyprawy\r\nliść laurowy\r\nziele angielskie\r\nsól, pieprz\r\nnatka pietruszki",
  "steps_raw": "# Przygotowanie\r\nMięso umyj i wrzuć do dużego garnka z zimną wodą.\r\nGotuj na małym ogniu, zbierając szumowiny.\r\nWarzywa umyj, obierz i pokrój na większe kawałki.\r\nPo około godzinie dodaj warzywa i przyprawy.\r\nGotuj jeszcze przez 1,5-2 godziny na małym ogniu.\r\nPod koniec dodaj sól i pieprz do smaku.\r\nPrzecedź przez sito, mięso pokrój i dodaj z powrotem.\r\nPodawaj z makaronem i posiekaną natką pietruszki.",
  "tags": [],
  "servings": null,
  "is_termorobot": true
}

nie zapisuje w bazie danych wartosci
"is_termorobot": true
</aktualne_zachowanie>


<oczekiwane_zachowanie>

endpoin zwaca description takie jak było podane na wejści (nie zapisuje się w bazie)

</oczekiwane_zachowanie>
zapisuje w bazie danych wartosc
"is_termorobot": true

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

