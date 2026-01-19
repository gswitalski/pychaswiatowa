Jesteś doświadczonym analitykiem produktowym i architektem oprogramowania. Twoim zadaniem jest przeanalizowanie dokumentów projektu aplikacji webowej i dodanie nowej funkcjonalności do istniejącego projektu.

Oto dokumenty projektu, które musisz przeanalizować:

<dokumenty_projektu>



</dokumenty_projektu>

Oto opis nowej funkcjonalności, którą należy dodać do projektu:

<nowa_funkcjonalnosc>

1. użytkownik może obsługiwać listę zakupów ze składnikami do przepisów które ma w swoim  planie
2. Każde dodanei przepisu do planu ododaje składniki do listy zakupów.
3. elementy na liście zakupów są brane z list składników znormalizowanych
4. każdy składnik który jest powtórzeinirm innego składnika z tego samego przepisu lub z innego juest scalany w jeden element listy zakupów pod warucnkiem że jednostki smiary są takie same. ilosci jest sumowana
np jesli w jednym przepisie jest cukier 200 g, a w drugim przepisie cukier 50 g, w czecim przepisie 1 łyżeczka cukru a w czwartym przepisie po prostu cukier bez ilości i jednostki to na liście zakupów ma się pojawić
- cukier, 250 g
- cukier, 1 łyżeczka 
- cukier

5. użytkowniek ma mozliwosc zaznaczenia które składniki juz posiada
6. Skłądniki zaznaczone jako posiadane są przesortowane na sam dół
7. uzytkownik może ddodac dowolny element do listu zakupów, który nie jest zwiazany z żadnym przepisem opisujac swoimi słowami co i ile ma kupić.
8. Lista zakupów mna odzielny element w głównym menu : 'Zakupy'.
9. Usunięcie przepisu z planu usuwa odpowiednie ilości składników z listy zakupów.


</nowa_funkcjonalnosc>

Twoim zadaniem jest:

1. Dokładnie przeanalizować wszystkie dostarczone dokumenty projektu, aby zrozumieć obecną architekturę, funkcjonalności i strukturę aplikacji
2. Na podstawie opisu nowej funkcjonalności, dodać odpowiednie elementy do (zmodyfikuj bezpośrednio dokumenty):
   - PRD (Product Requirements Document) - dodaj nowe funkcje i historyjki użytkownika
   - Planu UI - dodaj nowy widok/widoki
   - Planu API - dodaj nowe endpointy API

Przed przystąpieniem do tworzenia rozszerzeń, użyj scratchpad do zaplanowania swojego podejścia:

<scratchpad>
[Tutaj przeanalizuj dokumenty, zidentyfikuj kluczowe elementy obecnej architektury, zastanów się jak nowa funkcjonalność wpasuje się w istniejący system, zaplanuj jakie konkretnie elementy trzeba dodać do każdego dokumentu]
</scratchpad>

Wymagania dotyczące odpowiedzi:
- Wszystko ma być napisane w języku polskim
- Zachowaj spójność ze stylem i formatem istniejących dokumentów
- Upewnij się, że nowe elementy logicznie wpasowują się w obecną architekturę
- Dla PRD: dodaj konkretne funkcje i przynajmniej jedną szczegółową historyjkę użytkownika
- Dla planu UI: opisz nowy widok/widoki z uwzględnieniem UX i interfejsu
- Dla planu API: dodaj konkretne endpointy z metodami HTTP, parametrami i odpowiedziami
- Masz bezpośrednio zmodyfikować dokumenty: PRD plan UI oraz plan API

Twoja końcowa odpowiedź powinna zawierać trzy wyraźnie oznaczone sekcje:
1. Rozszerzenia do PRD
2. Nowy widok w planie UI  
3. Nowe API w planie API


Sformatuj swoją odpowiedź używając odpowiednich nagłówków i zachowując czytelną strukturę.


Dodatkowo  stwórz dokument w doc/results/changes/{nazwa-ficzera-po-angielsku}-changes.md
W tym dokumence umieść 3 rozdziały:
1. historyjki użytkownika
2. Widoki.
3. API

W każdym rozdziale umieść odpowiednio opisy historyjek, widoków i endpointów które są nowe lub zmienione. dla zmienionych dopisz notatkę co się zmieniło.


UWAGA:
Zanim przystapisz do pracy, ale po zapoznaniu się zdokumentami projektu, zadaj mi kilka pytań uszczegóławiających moje wymagania co do nowej funkcjonalności oraz twoje rekomenacje co do oddpoiwiedzi. 
pytania zadaj w formacie
1. {Treść pyutania pierwszego}
Moja rekomendacja:
{treść rekomendacji}

2. {Treść pyutania drugiegoo}
Moja rekomendacja:
{treść rekomendacji}

dopiero po udzieleniu prze zużytkownika odpowiedzi przystąp do wykonywannia powyższych poleceń. W swojej pracy uzyj odpowiedzi udzielonych przez użytkownika.

