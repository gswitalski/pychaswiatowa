 Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z  projektem

<project_summary>

@docs/results/project-summary.md 

</project_summary>


<aktualne_zachowanie>

endpoint 
http://127.0.0.1:54331/functions/v1/profile/change-password

z body

{
    "current_password": "554G5rjnbdAanGR",
    "new_password": "tobitobi2626"
}

zwraca

błąd 500

{
    "code": "INTERNAL_ERROR",
    "message": "Failed to change password"
}


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
