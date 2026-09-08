Zaczynam projektowanie aplikacji webowej dla osób gotujących w domu o nazwie PychaŚwiatowa. 
Jako domowy kucharz mam przepisy i porady rozrzucone w różnych miejscach: notatnik OneNote, książki kucharskie,
czasopisma kulinarne, programy kulinarne na streamingu, liczne zapamiętane strony internetowe, portal thermomiksa itd.
Chciałbym mieć system w którym w łatwy sposób będę mógł:
- zebrać wszytkie przepisy w jednym mijscu
- układać menu na wybrany dzień lub wydarzenie (z widokiem na kilka dni w przód)
- planować zakupy i zarządzać nimi
- zarządzać domową spiżarnią w tym artykułami przemysłowymi takimi jak ręczniczki papierowe, papier do pieczenia 
  - produkty ze spiżarni ze stanem: brak, mało, dużo.  
- importowac przepisy w miarę automatycznie (za pomocą AI, skany, z książek, zrzuty ekranu).
- automatycznie (za pomocą AI) modyfikować przepisy:
    - zmieniać liczbę porcji
    - stosować zamienniki
    - modyfikować pod kątem wybranej diety
    - konwertować zwykłe przepisy na przepis do thermomiksa i na odwrót
    - przytaczać ciekawostki o danym daniu (wyszukane w internecie) w tym o historii, jakie wino do tego pasuje itd.
- planować prace nad wybranym menu, chcę aby AI połączyło kroki do wakowania wszystkich przepisów na raz i zaplanowało prace razem tak aby wszystkie potrawy były gotowe na daną godzinę
- automatyczne propozycje mnu na podstawie wprowadzonych preferencji, sezonowości i dostępności składników 
- mieć liste zakupów na podstawie menu oraz na podstawie zapasów w domu
  - lista zakupów robiona na podstawie tego co jest zaplanowane w menu plus zapasy ze stanem 'mało'
  - produktu z menu które znajdują się w spiżarni ze stanem "dużo" nie są uwzględniane na liście zakupów (bo jest ich dużo w domu)
 - przepisy mogą być opatrzone zdjęciami użytkownika lub geberowanymi automatycznie przez LLM
 - przpisy mają byc podzielone na podstawowe kategorie orz tagowane
 - możliwość budowania kolekksji z okreslonych przepisów np. "szybkie obiady wegetariańskie", albo "kuchnia bliskowschodnia"
 - użytkownków systemu może być wiele
    - kązdy użytkonk może tworzyć własne przepisy z zakresm: prewatny, znajomi, publiczny. pryatne widzi tylko on , 'znajomi' on i uzytkownicy połączenie jako znajomi, publiczny - moga wyszukac wszyscy.
- na stronie gółwej można wyszukiwać przepsy wwyneksponowanym inpucie
    - użytkownikcy niezalogowani moga wyszukac tylko przepisy publiczne
    - użytkownicy zalogowanie moga wyszukac przepisy publiczne, swoje oraz przepisy znjomych udostenione jko 'znajomi'
- przepisy powinny miec stany 'w przygotowaniu'  oraz 'gotowe'
- użytkownik w roli administrator mże w oddzielnym panelu administracyjnym może zarządzać wszystkimi obiektami biznesowy, (użytkownikami, przepisami kolekcjami itd.)
- przepisy powinnm mieć mozliwosc zapisu informacji dodatkowych:
  - wartosci odżywcze
  - czas zaanagżowania kucharza
  - całkowity czas przygotowania potrawy 
  - listę sprętów i akcesoriów potrzebnych do przygotowania przepisu
  - ocena za pomocą gwiazdek od 1 do 5 (oaraz wyświetlanie przy przepisach średniej oceny przepisu)

Wszystkie pomysły będą tworzyć dość rozbudowaną aplikację. Ja chcę jednak na początku przygotować MVP z minimalnym zestawem funkcjonalności na początek.
Na początek nie będzie funkcjonalności opartej na LLM oraz innych niezbędych w pierwszej wersji systemu
