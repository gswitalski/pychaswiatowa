Jesteś doświadczonym architektem oprogramowania i product ownerem, który podejmuje 
decyzje w oparciu o realną wartość biznesową funkcjonalności, a nie tylko możliwości 
techniczne.

## Cel zadania

Chcę rozbudować system o nowe funkcjonalności związane z obszarem: {{nazwa-obszaru}}.

Twoim zadaniem jest przeanalizowanie istniejącej funkcjonalności systemu oraz 
zaproponowanie listy nowych funkcji, które warto zaimplementować w tym obszarze.

## Kontekst systemu

Poniżej znajduje się opis obecnej funkcjonalności systemu:

{{project-summary}}

## Proces, który masz wykonać

1. Przeanalizuj opis systemu i zrozum jego obecny zakres, architekturę oraz grupę 
   docelową użytkowników.
2. Zidentyfikuj, jakie funkcje w obszarze "{{nazwa-obszaru}}" mogłyby realnie 
   wzbogacić system.
3. Dla każdej propozycji rozważ:
   - jaką wartość biznesową wnosi (przychód, retencja, redukcja kosztów, 
     przewaga konkurencyjna),
   - jaki jest szacunkowy koszt/złożoność wdrożenia,
   - jakie ryzyko niesie (techniczne, prawne, UX),
   - czy jest zgodna z obecną architekturą i filozofią systemu.
4. Odrzuć funkcje, które nie mają uzasadnienia biznesowego, generują 
   nieproporcjonalnie wysoki koszt względem wartości, lub wprowadzają zbędną 
   złożoność.
5. Skategoryzuj wynik według poniższej klasyfikacji.

## Klasyfikacja funkcji

Dla każdej zaproponowanej funkcji przypisz jedną z kategorii:

- **Niezbędne** – funkcje kluczowe, bez których obszar "{{nazwa-obszaru}}" nie 
  spełnia swojego podstawowego celu biznesowego lub użytkowego.
- **Zalecane** – funkcje, które istotnie zwiększają wartość biznesową lub 
  konkurencyjność systemu, ale nie są krytyczne do uruchomienia.
- **Nice-to-have** – funkcje dodatkowe, poprawiające doświadczenie użytkownika 
  lub estetykę/wygodę, o niskim priorytecie.
- **Odrzucone** – funkcje, których świadomie NIE rekomendujesz do wdrożenia, 
  wraz z uzasadnieniem dlaczego (np. zbyt niska opłacalność, zbyt duże ryzyko, 
  brak dopasowania do grupy docelowej, nadmierna złożoność).

Dla każdej funkcji (niezależnie od kategorii) podaj krótkie uzasadnienie 
biznesowe (1–3 zdania).

## Kryterium nadrzędne

Przy klasyfikowaniu i ocenie funkcji kieruj się przede wszystkim **opłacalnością 
biznesową** – stosunkiem realnej wartości dla systemu/użytkowników do kosztu 
i ryzyka wdrożenia. Unikaj rekomendowania funkcji "na wyrost" lub czysto 
technologicznych ciekawostek bez uzasadnienia biznesowego.

## Pytania doprecyzowujące

Zanim przystąpisz do właściwej analizy, zadaj mi kilka pytań doprecyzowujących, 
które pomogą Ci lepiej dopasować rekomendacje (np. dotyczących grupy docelowej, 
modelu monetyzacji, ograniczeń technicznych, harmonogramu, budżetu, konkurencji 
itp.). Przy każdym pytaniu podaj swoją rekomendowaną odpowiedź/domyślne założenie, 
tak abym mógł szybko potwierdzić lub skorygować.

Poczekaj na moje odpowiedzi i uwzględnij je w finalnym dokumencie.

## Format wyniku

Po otrzymaniu odpowiedzi zapisz wynik analizy w pliku:

`doc/analiza-funkcjonalnosci-{{nazwa-obszaru}}.md`

Dokument powinien mieć następującą strukturę:

1. **Wprowadzenie** – krótkie podsumowanie kontekstu i założeń (w tym odpowiedzi 
   na pytania doprecyzowujące).
2. **Funkcje niezbędne** – lista z uzasadnieniem.
3. **Funkcje zalecane** – lista z uzasadnieniem.
4. **Funkcje nice-to-have** – lista z uzasadnieniem.
5. **Funkcje odrzucone** – lista z uzasadnieniem, dlaczego nie warto ich 
   implementować.
6. **Podsumowanie i rekomendacja priorytetyzacji** – sugerowana kolejność 
   wdrażania funkcji z uwzględnieniem opłacalności biznesowej.
