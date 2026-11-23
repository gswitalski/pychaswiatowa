# PS-112 — plan implementacji widoków

## Cel i granice

Pokazać użytkownikowi stan akcji dla właściwego wariantu, czytelnie odróżnić
warianty w szczegółach, planie, kolekcji i źródle zakupów oraz obsłużyć
wariantowe dane w panelu admina. Karty list pozostają zgodne z PS-111:
pokazują reprezentanta i podtytuł wariantu, bez nowych znaczników akcji.
Zakres obejmuje GWT 1–8, 12–21 i 23; tylko Vitest, bez E2E.

## Kontrakt prezentacji

- Przełącznik szczegółów korzysta z `RecipeVariantSummaryDto` i
  `user_action_state`; pokazuje przy każdym wariancie tekstowe znaczniki:
  ulubiony, chcę wypróbować, w planie, w kolekcji, notatka i `ocena N`.
- Stan jest aktualizowany lokalnie po udanej akcji bez przeładowania strony.
  Akcje zawsze dostają bieżący `recipe.id`, a tekst pomocniczy brzmi
  „Zapisujesz wariant: X”.
- Dla grupy z co najmniej dwoma aktywnymi wariantami plan, kolekcja i źródło
  zakupów renderują `Nazwa · wariant`; dla jednego wariantu zachowują obecny
  tekst. Nie zmieniać nazwy snapshotu w bazie po stronie klienta.
- Admin recipes renderuje kolumnę „Wariant”, `—` przy jednym wariancie oraz
  link do dokładnego wariantu z `?variant={id}`. Admin users renderuje grupy
  jako `recipesCount` i obok liczbę wariantów.
- Gość, flaga wyłączona i cudze dane nie renderują znaczników osobistych.
  Brak nowych pól API nie może powodować pustych etykiet ani błędu.

## Etapy i pliki

1. **Modele i wspólny formatter** — rozszerzyć modele stron szczegółów,
   planu, kolekcji, zakupów i admina o opcjonalne pola z kontraktu. Dodać
   czystą funkcję budującą nazwę `Nazwa · wariant` z progiem
   `active_variant_count >= 2`, pełnym `aria-label` i bez zmian dla starego
   DTO.
2. **Szczegóły i znaczniki** — w
   `src/app/shared/components/recipe-detail-view/` rozszerzyć przełącznik o
   znaczniki z tekstem dla czytnika ekranu, skracaniem wizualnym i pełnym
   `title`/`aria-label`. Po każdej akcji aktualizować tylko stan aktywnego
   `recipe_id`; po zmianie wariantu zachować dotychczasową logikę URL, loading,
   unsaved note i ratunek PS-110.
3. **Plan i zakupy** — w stronach/komponentach planu oraz shopping list
   mapować nazwę wariantu, renderować źródło zakupów jako `Nazwa · wariant`
   i nie grupować ani nie usuwać pozycji po nazwie. Po usunięciu wariantu
   odświeżyć dane, zachowując ręczne pozycje i pozycje innych wariantów.
4. **Kolekcje i listy** — w `collection-details-page.component.ts`, kartach
   i sidebarze zachować grupowanie PS-111, ale w kontekście kolekcji
   wyświetlić zapisany wariant i nazwę z progiem N≥2. Dialog usuwania używa
   dokładnego `recipe_id`; listy Explore, „Moje przepisy” i wyszukiwarka nie
   dostają znaczników akcji.
5. **Admin recipes** — rozszerzyć modele, mapper, tabelę i kolumny o
   `variantName`; link budować przez istniejącą trasę z `?variant`. Nie
   deduplikować w UI, nie zmieniać filtrów, totalu ani paginacji.
6. **Admin users** — rozszerzyć DTO/VM/serwis tabeli o `variantsCount`,
   pokazać `12 (17 wariantów)` oraz zachować sortowanie po 12 grupach.
   Przy starej odpowiedzi wyświetlić dotychczasową liczbę bez pustego tekstu.
7. **Testy i dostępność** — Vitest dla mappera nazwy, progów 1/2, stanu
   znaczników, akcji per id, aktualizacji bez reloadu, URL, loading/error,
   planu, zakupów, kolekcji, obu tabel admina, linku `?variant`, flaga/głęboki
   fallback i regresja jednego wariantu. Sprawdzić klawiaturę, focus,
   `aria-label`, `aria-live`, długie nazwy i szerokość poniżej 600 px.
   Uruchomić Vitest, `ng lint` i `ng build`; bez Playwrighta i `e2e/**`.

## Założenia planu

- Backend gwarantuje dane per wariant; frontend nie deduplikuje, nie grupuje
  i nie wylicza stanu z innych wariantów.
- Lista kart zachowuje wskaźniki reprezentanta z PS-111; znaczniki PS-112 są
  wyłącznie na przełączniku szczegółów.
- `Nazwa · wariant` jest generowana tylko dla N≥2, także gdy nazwa wariantu
  jest techniczna; przy N=1 działa dotychczasowy adres i wygląd.
- Przy błędzie akcji stan lokalny nie jest zmieniany; po błędzie przełączania
  pozostają poprzednia treść, zaznaczenie i URL.
- W panelu admina „N wariantów” jest informacją pomocniczą, a nie nowym
  filtrem; kolumna Wariant nie wpływa na istniejący filtr po nazwie przepisu.
- Mobile nie może wypchnąć głównej akcji planu poza pierwszy kontekst;
  znaczniki mają skróconą formę wizualną i pełną treść dostępną.

## Czynności ręczne widoku

Po uruchomieniu lokalnego API ustawić flagę `admin` i sprawdzić szczegóły z
A/B/C: różne znaczniki, akcje na B, przełączenie na A, czytnik ekranu i
klawiaturę. Następnie zweryfikować plan z A+B, kolekcję z A+B, źródła zakupów,
usunięcie A oraz zachowanie ręcznych pozycji. W adminie sprawdzić kolumnę
wariantu, link dokładnego wariantu, `12 (17 wariantów)`, paginację i sortowanie.
Powtórzyć jeden wariant, gościa i flagę wyłączoną; sprawdzić mobile, loading,
błąd i długie nazwy. Wynik oznaczyć `PASS`, `FAIL`, `NIE_WYKONANO` albo
`WYMAGA_WERYFIKACJI`; nie wykonywać E2E.
