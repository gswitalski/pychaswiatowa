Jesteś doświadczonym analitykiem produktowym i architektem oprogramowania. Twoim zadaniem jest przeanalizowanie dokumentów projektu aplikacji webowej i dodanie nowej funkcjonalności do istniejącego projektu.

Oto dokumenty projektu, które musisz przeanalizować:

<dokumenty_projektu>



</dokumenty_projektu>

Oto opis nowej funkcjonalności, którą należy dodać do projektu:

<nowa_funkcjonalnosc>


na formularzu edycji przepisu mam przycisk do generowania zddjęcia potrawy za pomocą AI.
chcę aby ten przycisk działałw dwóch trybach.

Tryb 1
gdy przepis nie ma jeszcze załadowanego zdjęcia - ma działac tak jak teraz czyli generuje się zdjęcie potrawy na podstawie przepisu

Tryb 2. Gdy zdjęcie jest załadowane (może być załadowane tylko w formularzu) to generowanie ma sie odbyć za pomocą innego prompta który korzysta z załadowanego zdjęcia jako referencji.

całe zdjecia ma być wyugenerowane od nowa zdjexie ma tylko dać wyobrażenie o wyglądzie potrawy


użyj do tego następującego prompta

<prompt>

You will be generating an image of a dish based on a recipe provided below. You have been given a reference image that shows the dish, but you should NOT copy this image. Instead, use it only to understand what the dish looks like, and create an entirely new photograph with a different composition, angle, and setting.

Here is the reference image to help you understand the dish

Here is the recipe for the dish you need to photograph:
<recipe>



</recipe>

Requirements for the image you generate:

WHAT TO INCLUDE:
- The finished dish from the recipe as the main subject
- An elegant kitchen or dining setting/arrangement
- Professional food photography composition
- Appropriate lighting that makes the food look appetizing
- Complementary props like plates, utensils, ingredients, or table settings that enhance the presentation

WHAT NOT TO INCLUDE:
- Do not include any text, words, or writing of any kind
- Do not include any logos or brand names
- Do not include any people or parts of people (hands, faces, etc.)
- Do not copy the exact composition, angle, or setting from the reference image

STYLE GUIDELINES:
- Create a fresh, original composition
- Use an elegant, sophisticated kitchen or dining aesthetic
- Ensure the dish is the clear focal point
- Make the image look professional and appetizing
- Consider interesting angles, depth of field, and artistic plating

Generate the image now based on these instructions.


</prompt>

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

