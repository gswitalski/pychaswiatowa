Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z dokumentamu projektu

<dokumnety_projektowe>



</dokumnety_projektowe>



<aktualne_zachowanie>
endpoint GET
http://127.0.0.1:54331/functions/v1/public/recipes/feed?limit=12&sort=created_at.desc

zwraca tylko publiczce przepisy

</aktualne_zachowanie>


<oczekiwane_zachowanie>

zwraca publiczce przepisy oraz moje (zalogowanego użytkownika) bez zwzgledu na vidzialność przepisu

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

