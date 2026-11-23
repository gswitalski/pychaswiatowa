# PS-111 — plan implementacji widoków

## Cel i zakres

Wyświetlać jedną kartę na grupę w Explore, „Moje przepisy”, kolekcjach i
wyszukiwarce globalnej. Karta pokazuje reprezentanta, N, opcjonalnie K i
skrócone nazwy pasujących wariantów oraz prowadzi do reprezentanta z
`?variant=` przy `N >= 2`. Zakres obejmuje GWT 14–21 i 23 oraz integrację z
kontraktem API; tylko Vitest, bez E2E.

## Etapy i pliki

1. **Modele i mapowanie** — addytywnie użyć pól PS-111 z
   `shared/contracts/types.ts`; rozszerzyć modele list w
   `src/app/pages/recipes/recipes-list/`, Explore oraz
   `collections/collection-details/models/`. Wspólny mapper karty powinien
   budować tytuł grupy, podtytuł reprezentanta, etykietę N/K, `title` i
   `aria-label`, bez deduplikacji po stronie klienta.
2. **Karty i linki** — rozszerzyć istniejące komponenty kart/list (w tym
   `src/app/shared/components/recipe-list/` i komponent wyników publicznych)
   o metadane wariantu. Dla `N=1` zachować obecny wygląd i adres; dla `N>=2`
   renderować nazwę reprezentanta, „N wariantów”, a przy aktywnym
   wyszukiwaniu/filtrze i `K<N`: „pasują K z N: …” z maksymalnie trzema
   nazwami i `+X`. Link generować przez istniejący mechanizm slugów z
   `?variant={id}`; nie zmieniać szczegółów ani przełącznika PS-110.
3. **Explore i „Moje przepisy”** — dostosować
   `public-recipe-results`, `PublicRecipesFacade`,
   `recipes-list-page.component` oraz dashboardowe użycia modelu do nowych
   pól. Zachować loading/error/empty, paginację stron i kursora oraz
   stabilne `trackBy` po id reprezentanta. Nie próbować łączyć kart po nazwie.
4. **Kolekcje** — w `collection-details-page.component`,
   `recipe-list` i modelu pokazać „zapisano K z N”, podtytuł wariantu i link
   reprezentanta. Dialog usuwania ma nazwę `Nazwa · wariant`; istniejąca akcja
   wysyła id reprezentanta, a po sukcesie odświeża grupę. Sidebar używa
   jednego DTO na grupę i zachowuje `truncated` po grupach.
5. **Wyszukiwarka globalna** — zaktualizować modele/komponent dropdownu i
   nawigację, aby renderować `Nazwa · wariant` dla grup wielowariantowych,
   korzystać z id reprezentanta i nie tworzyć drugiego wiersza.
6. **Dostępność i testy** — nazwa karty dla czytnika zawiera nazwę przepisu,
   wariant i N; skrót ma pełną wartość w `title`/`aria-label`. Sprawdzić
   mobile, stany ładowania i zmianę filtrów. Dodać Vitest dla mapperów,
   progów N/K, skracania, linku, `trackBy`, dialogu kolekcji, stanów listy,
   wyszukiwarki i regresji bez flagi. Uruchomić Vitest, `ng lint` i `ng build`;
   bez Playwrighta i `e2e/**`.

## Kontrakt UI

Komponenty nie zakładają obecności nowych pól: przy fladze wyłączonej
renderują dotychczasową kartę. `id` jest id reprezentanta, a `variant_name`
jest podtytułem tylko dla grup wielowariantowych. K oznacza dopasowane
warianty, nie liczbę kart. Pełny tekst skróconych nazw pozostaje dostępny
bez rozwijania.

## Założenia

- Backend gwarantuje jedną pozycję na grupę; frontend nie sortuje ani nie
  deduplikuje wyników.
- Istniejący `RecipeCardComponent`/`RecipeListComponent` zostanie rozszerzony
  addytywnie o metadane, bez duplikowania osobnej karty grupy dla każdego
  kontekstu.
- Link zachowuje aktualny slug i ścieżkę, a parametr `variant` jest dodawany
  tylko dla `N>=2`; parametr nie omija widoczności. Przy `N=1` zachowanie URL
  jest dokładnie dotychczasowe.
- Wskaźniki ulubionego, planu i oceny pokazują reprezentanta. Szczegóły
  pozostają bez oznaczenia spełnionego filtra zgodnie z zakresem historyjki.
- Nazwy techniczne są wykluczone przez API z dopasowania, ale mogą być
  pokazane jako nazwa reprezentanta.
- W razie przejściowej nieobecności pól UI używa bezpiecznych wartości
  domyślnych i nie pokazuje pustych etykiet.

## Czynności ręczne widoku

Po uruchomieniu lokalnego API ustawić flagę `admin` i sprawdzić jako
administrator: N=1/2/4, dopasowanie nazwy wariantu, K<N, długie nazwy,
link i parametr `variant`, kolekcję z A/B oraz usunięcie A. Powtórzyć
Explore i „Moje przepisy” na mobile, z klawiaturą i czytnikiem ekranu;
sprawdzić loading bez białego flasha, pusty wynik, błąd i brak zmian przy
fladze wyłączonej. Wynik oznaczyć `PASS`, `FAIL`, `NIE_WYKONANO` albo
`WYMAGA_WERYFIKACJI`. Nie wykonywać E2E.
