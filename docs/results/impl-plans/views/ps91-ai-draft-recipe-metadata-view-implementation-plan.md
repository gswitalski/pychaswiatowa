# Plan implementacji widoku — metadane draftu przepisu AI (PS-91)

## 1. Przegląd

PS-91 rozszerza istniejący przepływ asystowanego dodawania przepisu:

`/recipes/new/assist` → `POST /ai/recipes/draft` → `RecipeDraftStateService` → `/recipes/new`.

Po wygenerowaniu draftu formularz nowego przepisu ma zostać automatycznie uzupełniony nie tylko nazwą, opisem, składnikami, krokami, wskazówkami, kategorią i tagami, ale również:

- liczbą porcji,
- czasem przygotowania,
- czasem całkowitym,
- typem diety,
- kuchnią,
- stopniem trudności,
- flagą Termorobot,
- flagą Grill.

Zmiana nie wymaga nowego widoku, komponentu wizualnego, dialogu, stylów ani mechanizmu zarządzania stanem. Wszystkie kontrolki i walidatory docelowe istnieją już w formularzu. Główna praca frontendowa obejmuje rozszerzenie mapowania w `RecipeFormPageComponent` i dodanie testów zachowania.

Po wypełnieniu formularza użytkownik nadal może zmienić każdą wartość. Podczas zapisu źródłem danych jest aktualny stan formularza, a nie pierwotny obiekt draftu.

Poza zakresem pozostają:

- zmiany ekranu asysty AI,
- prezentowanie `meta.warnings`,
- oznaczanie, które wartości zostały odczytane, a które wywnioskowane,
- import Markdown bez LLM,
- edycja istniejącego przepisu,
- zmiany w kredytach AI, parametrach żądania lub routingu,
- zmiany schematu bazy danych.

## 2. Routing widoku

PS-91 nie dodaje ani nie modyfikuje tras.

- `/recipes/new/assist` — istniejący ekran przyjmujący tekst lub obraz i wywołujący endpoint draftu.
- `/recipes/new` — istniejący formularz tworzenia przepisu, który jednorazowo konsumuje draft z `RecipeDraftStateService`.
- `/recipes/:id/edit` — bez zmian; PS-91 nie wpływa na wypełnianie formularza danymi istniejącego przepisu.

Obie trasy tworzenia przepisu pozostają dziećmi lazy-loaded `recipesRoutes` i są chronione na poziomie nadrzędnej trasy `/recipes` przez `usernameCompleteMatchGuard`.

Istnieje rozbieżność wymagająca odnotowania: dokumentacja historyjki i plan UI wskazują dostęp do `/recipes/new/assist` wyłącznie dla `premium/admin`, natomiast aktualny `recipes.routes.ts` nie ma lokalnego `premiumRoleMatchGuard`, a `recipes.routes.spec.ts` jawnie potwierdza dostęp dla wszystkich zalogowanych użytkowników. PS-91 nie powinno przy okazji zmieniać tej polityki. Jeżeli ograniczenie roli ma zostać przywrócone, należy zrealizować je jako osobną decyzję produktową i zmianę routingu.

## 3. Struktura komponentów

```text
/recipes/new/assist
└── RecipeNewAssistPageComponent                         [bez zmian]
    ├── AiRecipeDraftService                             [bez zmian]
    │   └── POST /ai/recipes/draft
    └── RecipeDraftStateService.setDraft(...)            [bez zmian]
        └── przechowuje cały AiRecipeDraftDto

/recipes/new
└── RecipeFormPageComponent                              [modyfikacja]
    ├── RecipeDraftStateService.consumeDraft()           [bez zmian]
    ├── populateFormFromDraft(...)                       [modyfikacja]
    ├── RecipeBasicInfoFormComponent                     [bez zmian]
    │   ├── pola liczbowe: porcje i czasy
    │   ├── select: dieta i trudność
    │   ├── autocomplete: kuchnia
    │   └── przełączniki: Termorobot i Grill
    ├── RecipeCategorizationFormComponent                [bez zmian]
    └── EditableListComponent                            [bez zmian]
```

Przepływ danych:

1. `RecipeNewAssistPageComponent` otrzymuje `AiRecipeDraftResponseDto`.
2. `response.draft` i `response.meta` są przekazywane do `RecipeDraftStateService.setDraft()`.
3. Następuje nawigacja do `/recipes/new`.
4. `RecipeFormPageComponent` wywołuje `consumeDraft()` w trybie tworzenia.
5. `populateFormFromDraft()` mapuje wszystkie dane draftu na reaktywny formularz.
6. Komponenty formularza wyświetlają wartości przez przekazane instancje `FormControl`.
7. `onSubmit()` mapuje bieżący stan formularza do `CreateRecipeCommand`.

## 4. Szczegóły komponentów

### `RecipeFormPageComponent`

- **Plik:** `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`
- **Opis:** Kontener formularza tworzenia i edycji przepisu. W trybie tworzenia konsumuje jednorazowy draft AI, mapuje dane na formularz, a następnie zapisuje wartości zweryfikowane lub zmienione przez użytkownika.
- **Główne elementy:** typowany `FormGroup<RecipeFormViewModel>`, sekcja podstawowych informacji, zdjęcie, kategoria i tagi oraz listy składników, kroków i wskazówek.
- **Zmiana:** rozszerzenie pierwszego `patchValue()` w `populateFormFromDraft()` o osiem pól:
    - `servings: draft.servings ?? null`,
    - `prepTimeMinutes: draft.prep_time_minutes ?? null`,
    - `totalTimeMinutes: draft.total_time_minutes ?? null`,
    - `dietType: draft.diet_type ?? null`,
    - `cuisine: draft.cuisine ?? null`,
    - `difficulty: draft.difficulty ?? null`,
    - `isTermorobot: draft.is_termorobot === true`,
    - `isGrill: draft.is_grill === true`.
- **Obsługiwane zdarzenia:** inicjalizacja widoku, konsumpcja draftu, zmiana pól formularza, wyczyszczenie wartości w komponentach potomnych, wysłanie formularza i anulowanie.
- **Walidacja:** istniejące walidatory formularza mają zostać użyte bez zmian:
    - `servings`: liczba całkowita od 1 do 99 albo `null`,
    - `prepTimeMinutes`: liczba całkowita od 0 do 999 albo `null`,
    - `totalTimeMinutes`: liczba całkowita od 0 do 999 albo `null`,
    - jeśli oba czasy są podane, `totalTimeMinutes >= prepTimeMinutes`,
    - enumy i flagi są typowane przez kontrolki formularza.
- **Typy:** `AiRecipeDraftDto`, `RecipeFormViewModel`, `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty`, `CreateRecipeCommand`.
- **Propsy:** brak; jest to komponent routowany. Zależności pobiera przez `inject()`.
- **Ważne zachowanie:** użycie `??`, a nie `||`, zachowuje poprawną wartość czasu `0`. Dla flag należy stosować porównanie `=== true`, aby brak lub nieoczekiwana wartość nie włączyły przełącznika.

### `RecipeBasicInfoFormComponent`

- **Pliki:** `src/app/pages/recipes/recipe-form/components/recipe-basic-info-form/recipe-basic-info-form.component.ts` i `.html`.
- **Opis:** Prezentacyjna sekcja formularza pokazująca wszystkie metadane objęte PS-91. Nie wymaga zmian w szablonie ani stylach.
- **Główne elementy:** pola Angular Material typu number, `mat-select`, `mat-autocomplete` i `mat-slide-toggle`.
- **Obsługiwane zdarzenia:** wybór wartości enum, wpisywanie liczb, przełączanie flag i czyszczenie opcjonalnych pól.
- **Walidacja:** wyświetla istniejące błędy zakresów, całkowitości oraz relacji czasów przekazane przez kontrolki rodzica.
- **Typy:** `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty`.
- **Propsy:** wymagane kontrolki formularza:
    - `servingsControl: FormControl<number | null>`,
    - `prepTimeMinutesControl: FormControl<number | null>`,
    - `totalTimeMinutesControl: FormControl<number | null>`,
    - `dietTypeControl: FormControl<RecipeDietType | null>`,
    - `cuisineControl: FormControl<RecipeCuisine | null>`,
    - `difficultyControl: FormControl<RecipeDifficulty | null>`,
    - `isTermorobotControl: FormControl<boolean>`,
    - `isGrillControl: FormControl<boolean>`,
    - istniejące kontrolki nazwy i opisu.
- **Ważne zachowanie:** draft jest nakładany synchronicznie podczas `ngOnInit()` komponentu strony, przed inicjalizacją komponentu potomnego. Dzięki temu pomocnicza kontrolka `cuisineInputControl` odczyta już ustawioną kuchnię i pokaże jej polską etykietę.

### `RecipeNewAssistPageComponent`

- **Plik:** `src/app/pages/recipes/recipe-new-assist/recipe-new-assist-page.component.ts`.
- **Opis:** Zbiera tekst lub obraz, buduje niezmienione `AiRecipeDraftRequestDto`, wywołuje API i przekazuje cały otrzymany draft do serwisu stanu.
- **Zmiany:** brak. Komponent nie powinien ręcznie wybierać pól odpowiedzi; istniejące `setDraft(response.draft, response.meta)` przenosi również nowe metadane.
- **Obsługiwane zdarzenia:** wybór źródła, wklejenie lub usunięcie obrazu, generowanie draftu, przejście dalej i powrót.
- **Walidacja:** typ MIME, limit obrazu 10 MB, obecność wejścia, kredyty AI i błędy endpointu — bez zmian.
- **Typy:** `AiRecipeDraftRequestDto`, `AiRecipeDraftResponseDto`.
- **Propsy:** brak; komponent routowany.

### `RecipeDraftStateService`

- **Plik:** `src/app/pages/recipes/services/recipe-draft-state.service.ts`.
- **Opis:** Tymczasowy magazyn całego draftu i jego metadanych oparty na sygnałach.
- **Zmiany:** brak. `AiRecipeDraftDto` jest przechowywany bez transformacji, więc nowe pola przechodzą automatycznie.
- **Publiczne API:** `setDraft()`, `consumeDraft()`, `clearDraft()`, `draft`, `meta`, `hasDraft`.
- **Warunki:** draft jest jednorazowy i wygasa po 10 minutach.

### `AiRecipeDraftService`

- **Plik:** `src/app/pages/recipes/services/ai-recipe-draft.service.ts`.
- **Opis:** Wywołuje `POST /functions/v1/ai/recipes/draft` i zwraca typowany `AiRecipeDraftResponseDto`.
- **Zmiany:** brak. Schemat żądania, obsługa statusów i sposób deserializacji odpowiedzi pozostają takie same.
- **Obsługiwane błędy:** `401/403`, `402`, `413`, `422`, `429` oraz pozostałe błędy API.

## 5. Typy

### Typy kontraktowe

W `shared/contracts/types.ts` interfejs `AiRecipeDraftDto` powinien zawierać wymagane pola:

```typescript
servings: number | null;
prep_time_minutes: number | null;
total_time_minutes: number | null;
diet_type: RecipeDietType | null;
cuisine: RecipeCuisine | null;
difficulty: RecipeDifficulty | null;
is_termorobot: boolean;
is_grill: boolean;
```

W aktualnym stanie repozytorium pola te są już dodane do współdzielonego kontraktu. Implementacja frontendowa powinna korzystać bezpośrednio z istniejących typów `RecipeDietType`, `RecipeCuisine` i `RecipeDifficulty`; nie należy tworzyć zduplikowanych enumów ani modeli tylko dla widoku.

Pola pozostają wymaganymi właściwościami DTO, ale wartości liczbowe i enumy mogą być `null`. Nie należy zmieniać ich na opcjonalne wyłącznie na potrzeby defensywnego mapowania. Operator `??` zapewni bezpieczny fallback również dla odpowiedzi, w której pole nieoczekiwanie pominięto w czasie wykonywania.

### Typ formularza

Istniejący `RecipeFormViewModel` ma już wszystkie potrzebne kontrolki:

- `servings: FormControl<number | null>`,
- `prepTimeMinutes: FormControl<number | null>`,
- `totalTimeMinutes: FormControl<number | null>`,
- `dietType: FormControl<RecipeDietType | null>`,
- `cuisine: FormControl<RecipeCuisine | null>`,
- `difficulty: FormControl<RecipeDifficulty | null>`,
- `isTermorobot: FormControl<boolean>`,
- `isGrill: FormControl<boolean>`.

Nie jest wymagany nowy ViewModel. Nazwy snake_case są używane wyłącznie w DTO API, a nazwy camelCase w formularzu.

### Mapowanie do zapisu

Istniejący `mapFormToCommand()` już przekazuje metadane do `CreateRecipeCommand`:

- wartości puste jako `null`,
- liczby jako liczby całkowite,
- enumy bez transformacji,
- flagi jako `boolean`.

Ta metoda nie wymaga modyfikacji, ale musi zostać objęta testem regresyjnym potwierdzającym, że po ręcznej edycji wysyłane są wartości formularza.

## 6. Zarządzanie stanem

Nie jest potrzebny nowy serwis, NgRx, Component Store ani odpowiednik customowego hooka.

Stan jest rozdzielony na dwa istniejące poziomy:

1. `RecipeDraftStateService` przechowuje draft między dwiema trasami:
    - używa Angular Signals,
    - przechowuje obiekt bez kopiowania pól,
    - ma TTL 10 minut,
    - usuwa dane po `consumeDraft()`.
2. `FormGroup<RecipeFormViewModel>` staje się źródłem prawdy po wejściu na `/recipes/new`:
    - draft jest nakładany tylko raz,
    - kolejne zmiany należą do użytkownika,
    - zapis korzysta z `getRawValue()`.

`meta.confidence` i `meta.warnings` pozostają w `RecipeDraftStateService`, lecz po konsumpcji nie są wykorzystywane przez formularz. PS-91 nie wprowadza dla nich stanu UI.

Nie należy przechowywać oryginalnego draftu do późniejszego zapisu ani ponownie nakładać go po zmianach użytkownika.

## 7. Integracja API

Wykorzystywany jest istniejący endpoint:

- **Metoda:** `POST`
- **URL:** `/functions/v1/ai/recipes/draft`
- **Autoryzacja:** Bearer JWT
- **Żądanie:** `AiRecipeDraftRequestDto`
- **Odpowiedź sukcesu:** `AiRecipeDraftResponseDto`

Żądanie pozostaje bez zmian:

- tekst: `source: 'text'`, `text`, `output_format: 'pycha_recipe_draft_v1'`, `language: 'pl'`,
- obraz: `source: 'image'`, `image.mime_type`, `image.data_base64`, ten sam `output_format` i język.

Frontend wykorzystuje z odpowiedzi:

- `response.draft` — przekazywany w całości do `RecipeDraftStateService`,
- `response.meta` — przechowywany bez nowej prezentacji w UI.

Backend gwarantuje tolerancyjną normalizację metadanych. Odpowiedź `200` może zawierać `null` dla liczb i enumów oraz `false` dla flag. Frontend nie powinien ponownie implementować list enumów, naprawiać relacji czasów ani odrzucać całego draftu z powodu pojedynczego pola. Istniejące walidatory formularza pełnią rolę ostatniej ochrony przed zapisaniem danych niezgodnych z zakresem.

Kody odpowiedzi i zachowanie pozostają bez zmian:

- `200` — draft, również z brakującymi lub skorygowanymi metadanymi,
- `402 AI_CREDITS_EXHAUSTED` — istniejący dialog kredytów,
- `422` — materiał nie opisuje pojedynczego przepisu,
- `413` — zbyt duży obraz,
- `429` — limit zapytań,
- `401/403` i błędy infrastruktury — istniejąca obsługa błędów.

## 8. Interakcje użytkownika

1. Użytkownik otwiera `/recipes/new/assist`.
2. Wkleja tekst albo wybiera/wkleja obraz.
3. Klika „Dalej”.
4. Frontend wywołuje endpoint draftu i pokazuje istniejący stan ładowania.
5. Po sukcesie cały draft zostaje zapisany w `RecipeDraftStateService`, a aplikacja przechodzi do `/recipes/new`.
6. Formularz automatycznie pokazuje:
    - porcje i czasy w polach liczbowych,
    - dietę i trudność w selectach,
    - kuchnię w autocomplete z polską etykietą,
    - stan przełączników Termorobot i Grill.
7. Wartości `null` pozostawiają odpowiednie pola puste; flagi brakujące lub inne niż `true` pozostają wyłączone.
8. Użytkownik przegląda i może zmienić każdą wartość.
9. Wyczyszczenie pola przyciskiem z ikoną usuwa wartość i ustawia `null`.
10. Próba zapisu niepoprawnych zakresów lub relacji czasów pokazuje istniejące komunikaty walidacyjne i blokuje wysłanie.
11. Po poprawnym zapisie `POST /recipes` otrzymuje bieżące wartości formularza.

Interakcje i układ są takie same na desktopie i urządzeniach mobilnych. Brak nowych elementów oznacza brak zmian responsywności i dostępności.

## 9. Warunki i walidacja

### Mapowanie wartości

- Poprawna liczba lub enum z draftu trafia bez zmian do odpowiadającej kontrolki.
- `null` lub brak liczby/enumu ustawia `null`.
- `cuisine = null` pozostawia pole kuchni puste i nie powoduje błędu.
- Tylko literalne `true` włącza przełącznik; `false`, `null` lub brak pola daje `false`.
- Czas `0` jest poprawną wartością i nie może zostać zamieniony na `null`.
- Mapowanie metadanych nie może naruszyć dotychczasowego mapowania nazwy, opisu, składników, kroków, wskazówek, tagów i kategorii.

### Walidacja formularza

- `servings`: opcjonalne, integer, minimum 1, maksimum 99.
- `prepTimeMinutes`: opcjonalne, integer, minimum 0, maksimum 999.
- `totalTimeMinutes`: opcjonalne, integer, minimum 0, maksimum 999.
- Relacja czasów jest sprawdzana tylko wtedy, gdy obie wartości są niepuste.
- `totalTimeMinutes < prepTimeMinutes` ustawia błąd `totalLessThanPrep` na kontrolce czasu całkowitego.
- `dietType`, `cuisine` i `difficulty` mogą pozostać puste.
- Flagi mają zawsze wartość logiczną dzięki kontrolkom `nonNullable`.

Backend powinien dostarczać dane już znormalizowane, lecz walidatory muszą nadal działać dla ręcznych zmian użytkownika i jako ochrona przed niezgodną odpowiedzią runtime.

## 10. Obsługa błędów

- **Draft bez części nowych właściwości:** formularz nie rzuca wyjątku; liczby i enumy pozostają `null`, flagi `false`.
- **Draft z `null`:** pole pozostaje puste, a pozostałe wartości są mapowane normalnie.
- **Niepoprawny zakres runtime:** istniejący walidator oznacza kontrolkę jako niepoprawną i blokuje zapis.
- **Niespójne czasy runtime:** walidator relacji blokuje zapis, mimo że backend standardowo koryguje tę sytuację.
- **Nieznany enum runtime:** nie należy dodawać lokalnego mapowania lub wartości zastępczej. Backend odpowiada za normalizację do `null`; przypadek niezgodnego kontraktu powinien zostać wykryty przez testy integracyjne lub monitoring.
- **`meta.warnings`:** bez prezentacji w interfejsie zgodnie z zakresem. Ostrzeżenia nie blokują formularza.
- **Draft wygasł lub został już skonsumowany:** `/recipes/new` otwiera pusty formularz, zgodnie z obecnym zachowaniem.
- **Błąd API, kredytów lub autoryzacji:** pozostaje na ekranie asysty i korzysta z istniejącej obsługi; nie powstaje częściowo wypełniony formularz.
- **Błąd ładowania kategorii:** metadane podstawowe nadal pozostają w formularzu; jedynie mapowanie `category_name` może nie zostać wykonane.

## 11. Kroki implementacji

1. Zweryfikować, że backendowy kontrakt `POST /ai/recipes/draft` i `shared/contracts/types.ts` zawierają osiem pól PS-91 z właściwą nullowalnością i enumami. Nie dublować typów po stronie widoku.
2. W `RecipeFormPageComponent.populateFormFromDraft()` rozszerzyć istniejący `patchValue()` o mapowanie porcji, czasów, diety, kuchni, trudności oraz obu flag.
3. Zastosować `?? null` dla liczb i enumów oraz `=== true` dla flag, aby zachować wartość `0` i bezpiecznie obsłużyć niepełną odpowiedź runtime.
4. Nie zmieniać kolejności istniejącego mapowania list, tagów i kategorii. Zachować mechanizm `pendingDraft` dla kategorii ładowanych asynchronicznie.
5. Nie modyfikować `RecipeNewAssistPageComponent`, `AiRecipeDraftService` ani `RecipeDraftStateService`, ponieważ już przenoszą cały typowany obiekt.
6. Rozbudować `recipe-form-page.component.spec.ts` o konfigurację komponentu z mockami zależności i test przepływu przez publiczne zachowanie: wstawić draft do `RecipeDraftStateService`, uruchomić inicjalizację strony w trybie tworzenia i sprawdzić kontrolki formularza.
7. Dodać test draftu z kompletem metadanych, obejmujący wszystkie osiem pól.
8. Dodać test wartości `null`, w tym `cuisine = null`, oraz sprawdzić puste kontrolki i wyłączone przełączniki.
9. Dodać defensywny test odpowiedzi bez nowych właściwości, przygotowanej jako świadomie niepełny obiekt runtime, bez osłabiania produkcyjnego typu `AiRecipeDraftDto`.
10. Dodać test wartości granicznych i walidacji formularza: porcje `1/99`, czasy `0/999`, wartości poza zakresem oraz `total < prep`.
11. Dodać test regresyjny dotychczasowych pól draftu: nazwy, opisu, składników, kroków, wskazówek, tagów i kategorii.
12. Dodać test zapisu po ręcznej zmianie metadanych: mock `RecipesService.createRecipe()` powinien otrzymać wartości zmienione w formularzu, a nie pierwotne wartości draftu.
13. Sprawdzić wizualnie oba warianty źródła — tekst i obraz — ponieważ oba korzystają z tego samego mapowania odpowiedzi, oraz potwierdzić prawidłową etykietę pola kuchni.
14. Uruchomić testy jednostkowe dla formularza, pełny zestaw Vitest oraz build TypeScript/Angular. E2E nie jest wymagane przez zakres PS-91, ale zalecany jest ręczny smoke test przepływu `/recipes/new/assist` → `/recipes/new`.
