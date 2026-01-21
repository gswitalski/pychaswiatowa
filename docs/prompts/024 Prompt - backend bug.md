Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z  projektem

<project_summary>



</project_summary>



<aktualne_zachowanie>

endpoint
- **`DELETE /plan/recipes/{recipeId}`**
    -  po usunięciu przepisu z planu backend powinien odejmujmować jego skłądniki  składników z listy zakupów (tyylko te które są w przepisie wg skłądników znormalizowanych i tylko taką ilsc jaka jest w przepisi
    np jeśli wprzepisi jest 200 g cukru an na liscie 700 g cukru to poodjeciu przepisu powinnno być 500 g cukru

    aktualnie usuniecie przepisu nie usuwa niczego z planu zakupów



</aktualne_zachowanie>


<oczekiwane_zachowanie>

usinięcei przepisu usuwa elementy z listy zakupów

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

