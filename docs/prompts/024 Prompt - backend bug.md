Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z dokumentamu projektu

<dokumnety_projektowe>



</dokumnety_projektowe>



<aktualne_zachowanie>


generowanie obrazu na podstawie obrazu wklejonego do frmularza przepisu nie używa obrazu rferencyjnego

[Warning] {"level":"warn","message":"Failed to download reference image from storage","timestamp":"2026-01-16T16:21:23.310Z","context":{"userId":"c553b8d1-3dbb-488f-b610-97eb6f95d357","recipeId":54,"error":"{}"}}
2026-01-16T16:21:23.310582432Z 
2026-01-16T16:21:23.310587307Z [Info] {"level":"info","message":"Falling back to recipe_only mode","timestamp":"2026-01-16T16:21:23.310Z","context":{"userId":"c553b8d1-3dbb-488f-b610-97eb6f95d357","recipeId":54}}
2026-01-16T16:21:23.310591312Z
2026-01-16T16:21:23.310706688Z [Info] {"level":"info","message":"Starting recipe image generation","timestamp":"2026-01-16T16:21:23.310Z","context":{"userId":"c553b8d1-3dbb-488f-b610-97eb6f95d357","recipeId":54,"recipeName":"Schab chrzanowy","language":"pl","mode":"recipe_only","hasReferenceImage":false,"ingredientsCount":15,"stepsCount":7}}

</aktualne_zachowanie>


<oczekiwane_zachowanie>

do generowania juset użyty obraz referencyjny (model gemini)

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

