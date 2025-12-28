Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z dokumentamu projektu

<dokumnety_projektowe>



</dokumnety_projektowe>



<aktualne_zachowanie>
na produkcji endpoint 

https://fxgonghylivohevdrdnt.supabase.co/functions/v1/ai/recipes/draft

zwraca  CORS ERROR


payload
{
  "source": "text",
  "text": "Ogórki konserwowe z curry siostry Anastazji – przepis na smakowite przetwory\nLiczba porcji: ok. 3-4 słoiki po 500 ml.\n\nCzas przygotowania: 30-40 minut (łącznie z pasteryzacją).\n\nStopień trudności: łatwy.\n\nSkładniki:\n\n1 kg ogórków gruntowych,\n\n2-3 łodygi zielonego selera (pokrojone na kawałki po 3–4 cm),\n\n1-1,5 łyżeczki ziaren gorczycy (ok. 5–7 g),\n\n1 średnia cebula (ok. 100 g).\n\nZalewa:\n\n750 ml wody,\n\n125 ml octu 10 procent,\n\n250 g cukru,\n\n7 g soli (ok. 1/2 łyżki stołowej),\n\n2 łyżeczki przyprawy curry (ok. 4–5 g).\n\nLepsze niż kiszone? Ogórki po watykańsku to hit wśród przetworów\nLepsze niż kiszone? Ogórki po watykańsku to hit wśród przetworów\nJak zrobić ogórki konserwowe siostry Anastazji?\nSposób przygotowania:\n\nNa początku ogórki dokładnie umyj, opcjonalnie obierz. Większe ogórki przekrój wzdłuż na 2 lub 4 części.\n\nNa dno wyparzonych słoików (najlepiej 500 ml) włóż po kawałku łodygi selera, kilku ziarnach gorczycy, 1-2 plasterki cebuli.\n\nNapełnij słoiki ogórkami ciasno, ale nie zgniataj ich.\n\nPrzygotuj zalewę: zagotuj wodę, ocet, cukier, sól i curry, mieszaj do całkowitego rozpuszczenia składników.\n\nGorącą zalewą oblej ogórki w słoikach.\n\nSzczelnie zakręć i pasteryzuj przez ok. 3 minuty od momentu zagotowania wody.\n\nGotowe ogórki konserwowe z curry przechowuj w chłodnym, ciemnym miejscu. Najlepsze są po kilku tygodniach macerowania, gdy przejdą smakiem.",
  "output_format": "pycha_recipe_draft_v1",
  "language": "pl"
}





</aktualne_zachowanie>


<oczekiwane_zachowanie>

endpoint zwraca draft przepisu obrobiony przez ai (open ai api)

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

