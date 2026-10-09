 Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z  projektem

<project_summary>

@docs/results/project-summary.md 

</project_summary>


<aktualne_zachowanie>

endpoint 
DELETE https://fxgonghylivohevdrdnt.supabase.co/functions/v1/recipes/348


zwraca bład 500

{
  "code": "INTERNAL_ERROR",
  "message": "Failed to delete recipe"
}

dziej sie tak tylko na produkcji. lokalnie dział 

</aktualne_zachowanie>


<oczekiwane_zachowanie>

brak błedu

</oczekiwane_zachowanie>


<implementation_rules>

@.cursor/rules/backend.mdc 

</implementation_rules>



Przeanalizuj przedstawiony bug, porównując aktualne zachowanie z oczekiwanym zachowaniem. Uwzględnij wszystkie dostarczone materiały: PRD, stos technologiczny, plan API, typy oraz aktualną implementację.

Przed podaniem rozwiązania, użyj tagów <analiza> do przemyślenia problemu:
- Zidentyfikuj różnice między aktualnym a oczekiwanym zachowaniem
- Przeanalizuj aktualną implementację w kontekście planu API i typów
- Określ prawdopodobną przyczynę buga
- Zaplanuj kroki naprawy

Następnie napraw buga.

Pamiętaj, że wszystkie odpowiedzi, komentarze w kodzie i wyjaśnienia mają być w języku polskim. Kod powinien być gotowy do implementacji i zgodny z przedstawionym stosem technologicznym oraz planem API.
