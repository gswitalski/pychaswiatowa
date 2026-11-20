# PS-109 — plan implementacji widoków

## Cel i zakres

Dodać sekcję „Warianty” na stronie `recipes/:id/edit`, widoczną wyłącznie
dla właściciela i przy aktywnej fladze zwróconej przez `/me`. Sekcja zarządza
listą wariantów oraz operacjami grupowymi, ale nie zmienia znaczenia
istniejącego formularza przepisu, szczegółów, list ani routingu publicznego.
Nie implementować przełącznika wariantów, `?variant=`, grupowania list,
wyszukiwania ani E2E.

## Etapy i pliki

1. **Kontrakt i dostępność funkcji**
   - rozszerzyć typ `/me` o stan `features.recipe_variants`;
   - dodać metodę w istniejącym `RecipesService` do listy i operacji
     wariantów, używając wyłącznie `supabase.functions.invoke`;
   - odświeżać flagę przy wejściu na ekran edycji, nie ufać stanowi starej
     sesji i nie renderować sekcji przy `disabled`.
2. **Sekcja zarządzania**
   - nowy standalone `recipe-variants-section` w
     `src/app/pages/recipes/recipe-form/components/`;
   - włączyć go do `recipe-form-page` tylko w trybie edycji;
   - lista kart/wierszy: nazwa wariantu, domyślny, miniatura, chipy cech,
     kolejność i akcje.
3. **Dialogi i stany**
   - dialog utworzenia pustego wariantu/kopii;
   - dialog zmiany nazwy grupy i widoczności z komunikatem o zasięgu;
   - potwierdzenie użycia i usunięcia wariantu/grupy;
   - loading, blokada akcji, empty/single variant, błędy domenowe,
     ostrzeżenie o nieudanej kopii zdjęcia.

Nazwy selektorów nowych komponentów mają prefiks `pych`, komponenty są
`standalone`, `OnPush` i używają sygnałów. Istniejący formularz pozostaje
źródłem edycji pełnej treści wariantu: akcja „Edytuj” przechodzi do
`/recipes/{variantId}/edit`, a po powrocie sekcja odświeża listę.

## Zachowanie UI według GWT

- **GWT 1–2, 23:** po otrzymaniu `/me` z włączoną flagą i wejściu w edycję
  własnego przepisu sekcja pokazuje listę; przy braku flagi nie tworzy
  widocznego ani dostępnego elementu. Stan ładowania pokazuje spinner,
  a akcje są zablokowane bez czyszczenia poprzednich danych.
- **GWT 3–7:** „Dodaj pusty” wymaga nazwy; „Utwórz kopię” pozwala wybrać
  źródło i nową nazwę. Przy drugim wariancie nazwa `Podstawowa` jest
  oznaczona jako wymagająca zmiany. Limit i zajęta nazwa pokazują komunikat
  domenowy z API, bez utraty listy.
- **GWT 8–11:** edycja otwiera istniejący formularz; nazwa grupy i widoczność
  są osobnymi akcjami. Widoczność pokazuje informację, że dotyczy wszystkich
  wariantów, a dla `PUBLIC` także że nowy wariant jest od razu publiczny.
  Nie pokazywać kontrolki widoczności pojedynczego wariantu.
- **GWT 12–13:** akcja „Ustaw domyślny” wymaga krótkiego potwierdzenia lub
  wykonuje się bez dialogu z jasnym stanem sukcesu; przy zmianie kolejności
  przyciski „w górę/w dół” wysyłają pełną kolejność i odświeżają listę.
  Klawiatura oraz `aria-label` muszą opisywać wariant i kierunek.
- **GWT 14–18:** przed usunięciem pobrać użycie i pokazać liczby planu,
  kolekcji oraz listy zakupów. Ostatni wariant nie ma aktywnej akcji
  usunięcia; usunięcie grupy jest osobną, wyraźnie destrukcyjną akcją.
  Po sukcesie usunięcia wariantu odświeżyć sekcję, a po grupie przekierować
  do listy przepisów.
- **GWT 19–21:** błędy `401/404/409` są czytelne i nie ujawniają cudzych
  zasobów; brak JWT obsługuje istniejąca warstwa autoryzacji.
- **GWT 22–25:** nie zmieniać istniejących widoków, jeśli flaga jest
  wyłączona. Na telefonie lista jest jednokolumnowa; wszystkie akcje mają
  fokus, etykietę ARIA i widoczny stan disabled/loading.

## Kontrakty i testy Vitest

Rozszerzyć kontrakty addytywnie o `RecipeVariantSummaryDto`,
`RecipeVariantsResponseDto`, komendy operacji i `RecipeUsageDto`.
`RecipesService` mapuje odpowiedzi i zachowuje błąd domenowy (kod/status,
jeśli dostępny), zamiast zastępować go ogólnym komunikatem.

Nowe testy jednostkowe:

- sekcja ukryta dla `disabled`, widoczna dla `admin`/dozwolonego trybu,
  oraz odświeżenie flagi przy wejściu — **GWT 1–2, 22–23**;
- pusty wariant, kopia, ostrzeżenie Storage, limit, `Podstawowa`,
  konflikt nazwy i loading — **GWT 3–7, 24**;
- nazwa/widoczność grupy, edycja, domyślny i kolejność — **GWT 8–13**;
- użycie, potwierdzenie, ostatni wariant, usunięcie grupy i przekierowanie —
  **GWT 14–18**;
- komunikaty błędów i brak ujawnienia obcych zasobów — **GWT 19–21**;
- testy serwisu sprawdzają metodę, URL, body i obsługę odpowiedzi.

Uruchomić Vitest dla zmienionych plików, `ng lint` i `ng build`. Nie planować
ani nie uruchamiać E2E.

## Założenia

- Sekcja jest osadzona pod istniejącym formularzem, bez nowej trasy.
  Każdy wariant jest edytowany przez istniejący `:id/edit`.
- Flaga jest pobierana z `/me` przy inicjalizacji ekranu; backend pozostaje
  źródłem prawdy i może odrzucić operację po zmianie flagi w trakcie sesji.
- Dla `disabled` sekcja jest całkowicie pomijana w DOM; dla braku/ładowania
  flagi nie pokazuje pustych akcji.
- Kolejność jest prezentowana jako akcje góra/dół, ale wysyłana jako pełna
  lista, zgodnie z kontraktem API.
- Nazwa grupy i widoczność nie są polami formularza wariantu; dialogi jasno
  informują, że zmiana dotyczy wszystkich aktywnych wariantów.
- UI nie próbuje lokalnie odtwarzać transakcji, limitu ani użycia; po każdej
  mutacji przyjmuje odpowiedź API i odświeża listę.
- Testy obejmują stany i dostępność komponentu, nie testują Storage ani bazy
  bezpośrednio.

## Czynności ręczne

Po zakończeniu planu API i lokalnym uruchomieniu aplikacji ustawić flagę
`tylko admin`. Zweryfikować jako admin: pusty wariant, kopię z obrazem,
zmianę nazwy/widoczności, domyślny, kolejność, użycie i usunięcie; następnie
jako zwykły użytkownik potwierdzić brak sekcji. Sprawdzić szerokość mobilną,
klawiaturę, fokus, etykiety czytnika ekranu oraz ostrzeżenie po błędzie
kopiowania zdjęcia. Zapisać status jako `PASS`, `FAIL`, `NIE_WYKONANO` lub
`WYMAGA_WERYFIKACJI`.
