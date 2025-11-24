# Cursor Commands - Jak używać

## Czym są Cursor Commands?

Cursor Commands to niestandardowe komendy, które możesz tworzyć w edytorze Cursor. Pozwalają one na automatyzację powtarzalnych zadań i szybkie wykonywanie często używanych operacji przy użyciu AI.

## Struktura katalogów

Cursor Commands są przechowywane w katalogu `.cursor/commands/` w głównym katalogu projektu. Każda komenda to osobny plik markdown (`.md`).

```
.cursor/
  └── commands/
      ├── moja-komenda.md
      ├── refactor-code.md
      └── generate-tests.md
```

## Jak utworzyć Cursor Command?

### 1. Utworzenie pliku komendy

Utwórz nowy plik markdown w katalogu `.cursor/commands/` z nazwą opisującą działanie komendy (np. `refactor-code.md`, `add-comments.md`).

### 2. Struktura komendy

Każda komenda to plik markdown zawierający instrukcje dla AI. Przykład:

```markdown
# Refaktoryzacja kodu

Przeanalizuj zaznaczony kod i:
1. Zidentyfikuj możliwości refaktoryzacji
2. Zastosuj najlepsze praktyki
3. Popraw czytelność kodu
4. Zachowaj istniejącą funkcjonalność
```

### 3. Wywołanie komendy

Aby użyć komendy:

1. **Zaznacz kod** (jeśli komenda wymaga kontekstu)
2. Otwórz **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Wpisz `@` i nazwę swojej komendy
4. Lub użyj skrótu klawiszowego przypisanego do komendy

## Przykłady użytecznych komend

### Przykład 1: Dodawanie komentarzy dokumentacyjnych

**Plik:** `.cursor/commands/add-docs.md`

```markdown
# Dodaj dokumentację

Dla zaznaczonej funkcji/metody:
- Dodaj docstring zgodny z konwencją projektu
- Opisz parametry i zwracaną wartość
- Dodaj przykłady użycia jeśli to możliwe
```

### Przykład 2: Generowanie testów

**Plik:** `.cursor/commands/generate-tests.md`

```markdown
# Generuj testy

Na podstawie zaznaczonego kodu:
1. Utwórz kompleksowe testy jednostkowe
2. Przetestuj wszystkie ścieżki wykonania
3. Uwzględnij przypadki brzegowe
4. Użyj frameworka testowego projektu
```

### Przykład 3: Refaktoryzacja

**Plik:** `.cursor/commands/refactor.md`

```markdown
# Refaktoryzacja kodu

Przeanalizuj zaznaczony kod i:
- Zidentyfikuj duplikacje
- Wyodrębnij wspólne funkcjonalności
- Popraw nazewnictwo zmiennych i funkcji
- Zastosuj zasady SOLID
- Zachowaj 100% zgodności funkcjonalnej
```

### Przykład 4: Optymalizacja wydajności

**Plik:** `.cursor/commands/optimize.md`

```markdown
# Optymalizacja wydajności

Przeanalizuj zaznaczony kod pod kątem:
- Wąskich gardeł wydajnościowych
- Nieefektywnych zapytań do bazy danych
- Zbędnych operacji w pętlach
- Możliwości cache'owania
- Leniwego ładowania danych
```

## Najlepsze praktyki

### 1. **Jasne i konkretne instrukcje**
Pisz precyzyjne instrukcje. Im bardziej szczegółowe, tym lepsze rezultaty.

### 2. **Uwzględnij kontekst projektu**
Możesz odwoływać się do:
- Stacku technologicznego
- Konwencji nazewnictwa
- Architektury projektu
- Istniejących wzorców

### 3. **Użyj zmiennych kontekstu**
W komendach możesz używać:
- `@workspace` - cały workspace
- `@file` - aktualny plik
- `@code` - zaznaczony kod
- `@docs` - dokumentacja projektu

### 4. **Testuj komendy**
Po utworzeniu komendy przetestuj ją na różnych przykładach, aby upewnić się, że działa zgodnie z oczekiwaniami.

## Zaawansowane użycie

### Komendy z parametrami

Możesz tworzyć komendy, które wymagają dodatkowych informacji od użytkownika. Parametry są przekazywane przez AI podczas wykonywania komendy.

#### Jak zdefiniować parametry w komendzie

Parametry definiujesz używając podwójnych nawiasów klamrowych `{{nazwa_parametru}}`. AI automatycznie rozpozna te miejsca i poprosi użytkownika o podanie wartości lub wywnioskuje ją z kontekstu.

**Przykład podstawowy:**

```markdown
# Konwertuj typ danych

Zamień zaznaczony kod na typ: {{target_type}}

Uwzględnij:
- Konwersję wszystkich wystąpień
- Aktualizację importów
- Poprawę typów w sygnaturach funkcji
```

#### Jak odwołać się do parametru w komendzie

Możesz używać tego samego parametru wielokrotnie w komendzie - wystarczy użyć tej samej nazwy w nawiasach klamrowych:

```markdown
# Zmień nazwę funkcji

Zmień nazwę funkcji z {{old_name}} na {{new_name}}.

Wykonaj następujące kroki:
1. Zmień nazwę funkcji {{old_name}} na {{new_name}}
2. Zaktualizuj wszystkie wywołania {{old_name}} na {{new_name}}
3. Zaktualizuj eksporty jeśli {{old_name}} była eksportowana
4. Zaktualizuj testy używające {{old_name}}
```

#### Praktyczne przykłady użycia parametrów

**Przykład 1: Komenda z jednym parametrem**

**Plik:** `.cursor/commands/rename-variable.md`

```markdown
# Zmień nazwę zmiennej

Zmień nazwę zmiennej na: {{new_name}}

Instrukcje:
1. Znajdź wszystkie wystąpienia zmiennej w zaznaczonym kodzie
2. Zamień na {{new_name}}
3. Zachowaj spójność nazewnictwa w całym pliku
4. Upewnij się, że nowa nazwa {{new_name}} jest zgodna z konwencją projektu
```

**Jak użyć:**
- Zaznacz kod zawierający zmienną do zmiany
- Wywołaj komendę `@rename-variable`
- AI zapyta o `new_name` lub wywnioskuje z kontekstu

**Przykład 2: Komenda z wieloma parametrami**

**Plik:** `.cursor/commands/create-component.md`

```markdown
# Utwórz komponent React

Utwórz komponent React o nazwie: {{component_name}}

Szczegóły:
- Typ komponentu: {{component_type}} (functional/class)
- Framework: {{framework}} (React/Next.js)
- Stylowanie: {{styling}} (CSS Modules/Tailwind/styled-components)

Wymagania:
1. Utwórz plik {{component_name}}.tsx
2. Użyj typu {{component_type}}
3. Zastosuj stylowanie {{styling}}
4. Dodaj podstawowe propsy TypeScript
5. Dodaj komentarze dokumentacyjne
```

**Jak użyć:**
- Wywołaj komendę `@create-component`
- AI poprosi o wartości parametrów lub użyje domyślnych wartości z kontekstu

**Przykład 3: Komenda z parametrem opcjonalnym**

**Plik:** `.cursor/commands/add-validation.md`

```markdown
# Dodaj walidację

Dodaj walidację dla pola: {{field_name}}

{{validation_rules}}

Instrukcje:
1. Dodaj walidację dla {{field_name}}
2. Zastosuj reguły: {{validation_rules}}
3. Dodaj komunikaty błędów w języku polskim
4. Zintegruj z istniejącym systemem walidacji
```

**Uwaga:** Jeśli parametr nie zostanie podany, AI może pominąć sekcję lub użyć domyślnych wartości.

#### Najlepsze praktyki dla parametrów

1. **Używaj opisowych nazw parametrów**
   - ✅ Dobrze: `{{component_name}}`, `{{target_type}}`, `{{validation_rules}}`
   - ❌ Źle: `{{x}}`, `{{param}}`, `{{value}}`

2. **Wyjaśnij oczekiwany format parametru**
   ```markdown
   # Konwertuj na język
   
   Konwertuj kod na język: {{target_language}}
   
   Uwaga: {{target_language}} powinien być jednym z: TypeScript, JavaScript, Python
   ```

3. **Użyj parametrów wielokrotnie dla spójności**
   ```markdown
   Zamień {{old}} na {{new}} we wszystkich miejscach.
   Upewnij się, że {{old}} nie występuje już w kodzie po zmianie na {{new}}.
   ```

4. **Dodaj kontekst dla parametrów**
   ```markdown
   # Dodaj test
   
   Dodaj test dla funkcji: {{function_name}}
   
   Kontekst:
   - Funkcja {{function_name}} znajduje się w pliku {{file_path}}
   - Typ zwracany przez {{function_name}}: {{return_type}}
   ```

#### Jak AI interpretuje parametry

Gdy używasz komendy z parametrami:

1. **Automatyczne wnioskowanie**: AI próbuje wywnioskować wartości parametrów z:
   - Zaznaczonego kodu
   - Kontekstu pliku
   - Nazw plików i folderów
   - Istniejącego kodu w projekcie

2. **Pytania użytkownika**: Jeśli AI nie może wywnioskować wartości, zapyta użytkownika w oknie czatu

3. **Wielokrotne użycie**: Jeśli używasz tego samego parametru wielokrotnie (np. `{{name}}`), AI użyje tej samej wartości we wszystkich miejscach

**Przykład praktyczny:**

```markdown
# Refaktoryzacja funkcji

Zrefaktoryzuj funkcję {{function_name}} używając wzorca {{pattern}}.

Kroki:
1. Przeanalizuj funkcję {{function_name}}
2. Zastosuj wzorzec {{pattern}} do {{function_name}}
3. Zaktualizuj testy dla {{function_name}}
4. Zweryfikuj, że {{function_name}} działa poprawnie z {{pattern}}
```

Gdy wywołasz tę komendę na funkcji `calculateTotal`, AI automatycznie:
- Ustawi `{{function_name}}` na `calculateTotal`
- Zapyta o `{{pattern}}` lub zaproponuje odpowiedni wzorzec
- Użyje tych wartości we wszystkich miejscach w komendzie

### Komendy wieloetapowe

Możesz tworzyć komendy wykonujące wiele kroków:

```markdown
# Kompletna refaktoryzacja

1. Przeanalizuj zaznaczony kod
2. Zidentyfikuj problemy
3. Zaproponuj rozwiązania
4. Zastosuj najlepsze rozwiązanie
5. Dodaj testy dla zmienionego kodu
6. Zaktualizuj dokumentację
```

### Odwoływanie się do plików w komendach

Tak, możesz odwoływać się do konkretnych plików w komendach! AI zawsze używa **najnowszej wersji pliku** z workspace podczas wykonywania komendy.

#### Metody odwoływania się do plików

**1. Używając zmiennych kontekstu**

Najprostszy sposób - użyj wbudowanych zmiennych kontekstu:

```markdown
# Zsynchronizuj typy

Przeanalizuj plik @file i zsynchronizuj typy z plikiem @types.

Instrukcje:
1. Otwórz aktualny plik (@file)
2. Porównaj typy z plikiem typów (@types)
3. Zaktualizuj typy w @file zgodnie z @types
```

**2. Używając ścieżek względnych**

Możesz odwoływać się do plików używając ścieżek względnych od katalogu głównego projektu:

```markdown
# Zaktualizuj importy

Przeanalizuj plik `src/components/Button.tsx` i zaktualizuj importy zgodnie z `src/types/index.ts`.

Instrukcje:
1. Otwórz `src/components/Button.tsx`
2. Sprawdź importy w `src/types/index.ts`
3. Zaktualizuj importy w Button.tsx zgodnie z najnowszymi eksportami z types/index.ts
```

**3. Używając ścieżek bezwzględnych**

Możesz również używać pełnych ścieżek (choć ścieżki względne są bardziej przenośne):

```markdown
# Porównaj implementacje

Porównaj implementację w `app/api/recipes/route.ts` z dokumentacją w `docs/results/004 prd.md`.

Sprawdź czy:
- Endpointy w route.ts są zgodne z wymaganiami z prd.md
- Wszystkie funkcjonalności z prd.md są zaimplementowane
```

**4. Kombinacja zmiennych kontekstu i ścieżek**

Możesz łączyć różne metody:

```markdown
# Zsynchronizuj z dokumentacją

Przeanalizuj aktualny plik (@file) i porównaj z dokumentacją w `docs/results/004 prd.md`.

Upewnij się, że:
- Implementacja w @file jest zgodna z wymaganiami z prd.md
- Wszystkie funkcjonalności są zaimplementowane
- Kod jest zgodny z architekturą opisaną w prd.md
```

#### Czy AI używa najnowszej wersji pliku?

**TAK!** AI zawsze używa najnowszej wersji pliku z workspace podczas wykonywania komendy. Oznacza to, że:

- ✅ Jeśli zmieniłeś plik przed wywołaniem komendy, AI zobaczy te zmiany
- ✅ AI ma dostęp do aktualnego stanu wszystkich plików w workspace
- ✅ Nie musisz zapisywać plików ręcznie - AI widzi nawet niezapisane zmiany w otwartych plikach
- ✅ Zmiany są odczytywane w czasie rzeczywistym podczas wykonywania komendy

#### Praktyczne przykłady

**Przykład 1: Komenda odwołująca się do konkretnego pliku**

**Plik:** `.cursor/commands/sync-with-types.md`

```markdown
# Zsynchronizuj z typami

Przeanalizuj aktualny plik (@file) i zsynchronizuj typy z `src/types/index.ts`.

Kroki:
1. Otwórz @file i zidentyfikuj używane typy
2. Sprawdź definicje w `src/types/index.ts`
3. Zaktualizuj importy i użycie typów w @file zgodnie z najnowszymi definicjami
4. Usuń nieużywane importy
5. Dodaj brakujące importy
```

**Jak użyć:**
- Otwórz plik, który chcesz zsynchronizować
- Wywołaj komendę `@sync-with-types`
- AI automatycznie użyje aktualnego pliku i najnowszej wersji `src/types/index.ts`

**Przykład 2: Komenda porównująca wiele plików**

**Plik:** `.cursor/commands/check-prd-compliance.md`

```markdown
# Sprawdź zgodność z PRD

Sprawdź czy implementacja w `app/api/recipes/route.ts` jest zgodna z wymaganiami w `docs/results/004 prd.md`.

Porównaj:
1. Endpointy w route.ts z wymaganiami API z prd.md
2. Walidację danych z wymaganiami walidacji z prd.md
3. Obsługę błędów z wymaganiami z prd.md
4. Strukturę odpowiedzi z definicjami z prd.md

Jeśli znajdziesz niezgodności:
- Wskaż konkretne miejsca
- Zaproponuj poprawki
- Zaktualizuj kod zgodnie z PRD
```

**Przykład 3: Komenda używająca parametru z ścieżką pliku**

**Plik:** `.cursor/commands/compare-files.md`

```markdown
# Porównaj pliki

Porównaj plik @file z plikiem: {{target_file}}

Instrukcje:
1. Otwórz aktualny plik (@file)
2. Otwórz plik {{target_file}}
3. Porównaj strukturę, typy i logikę
4. Zidentyfikuj różnice
5. Zaproponuj unifikację jeśli to możliwe
```

**Jak użyć:**
- Otwórz pierwszy plik do porównania
- Wywołaj komendę `@compare-files`
- Podaj ścieżkę do drugiego pliku (np. `src/utils/helpers.ts`)
- AI porówna oba pliki używając ich najnowszych wersji

**Przykład 4: Komenda aktualizująca wiele plików**

**Plik:** `.cursor/commands/update-api-endpoints.md`

```markdown
# Zaktualizuj endpointy API

Zaktualizuj endpointy API zgodnie z najnowszą wersją schematu.

Pliki do aktualizacji:
- `app/api/recipes/route.ts`
- `app/api/recipes/[id]/route.ts`
- `app/api/collections/route.ts`

Źródło prawdy:
- Schemat API: `docs/results/004 prd.md`
- Typy TypeScript: `src/types/api.ts`

Instrukcje:
1. Sprawdź aktualne definicje w prd.md i api.ts
2. Zaktualizuj każdy plik route.ts zgodnie z najnowszymi definicjami
3. Zachowaj spójność między wszystkimi endpointami
```

#### Najlepsze praktyki dla odwołań do plików

1. **Używaj ścieżek względnych** - są bardziej przenośne między różnymi środowiskami
   ```markdown
   ✅ Dobrze: `src/components/Button.tsx`
   ❌ Źle: `C:\dev\project\src\components\Button.tsx`
   ```

2. **Wyjaśnij relację między plikami**
   ```markdown
   Porównaj implementację w `app/api/recipes/route.ts` 
   z wymaganiami w `docs/results/004 prd.md`.
   ```

3. **Używaj zmiennych kontekstu gdy to możliwe**
   ```markdown
   ✅ `@file` - dla aktualnego pliku
   ✅ `@workspace` - dla całego workspace
   ✅ `@docs` - dla dokumentacji
   ```

4. **Sprawdzaj czy pliki istnieją**
   ```markdown
   Jeśli plik `src/types/index.ts` istnieje, zsynchronizuj typy.
   Jeśli nie istnieje, utwórz go zgodnie z konwencją projektu.
   ```

5. **Używaj parametrów dla dynamicznych ścieżek**
   ```markdown
   Porównaj @file z plikiem {{target_file}}.
   ```

#### Ważne uwagi

- **Aktualizacja w czasie rzeczywistym**: AI zawsze widzi najnowszą wersję plików, nawet jeśli są otwarte w innych zakładkach
- **Niezapisane zmiany**: AI widzi również niezapisane zmiany w otwartych plikach
- **Błędy ścieżek**: Jeśli plik nie istnieje, AI poinformuje Cię o tym i może zaproponować utworzenie go
- **Wielokrotne odwołania**: Możesz odwoływać się do tego samego pliku wielokrotnie w komendzie - AI użyje zawsze tej samej, najnowszej wersji

## Dostęp do komend

### Metoda 1: Command Palette
1. `Ctrl+Shift+P` (Windows/Linux) lub `Cmd+Shift+P` (Mac)
2. Wpisz `@` i nazwę komendy
3. Wybierz z listy

### Metoda 2: Chat z AI
W oknie czatu możesz odwołać się do komendy używając `@` i nazwy pliku.

### Metoda 3: Skróty klawiszowe
Możesz przypisać skróty klawiszowe do często używanych komend w ustawieniach Cursor.

## Wskazówki

- **Nazywaj komendy opisowo** - łatwiej będzie je znaleźć
- **Dziel duże zadania** - lepiej mieć kilka małych komend niż jedną ogromną
- **Aktualizuj komendy** - dostosowuj je do potrzeb projektu
- **Dziel się komendami** - dodawaj je do repozytorium, aby zespół mógł z nich korzystać

## Przykład dla projektu PychaŚwiatowa

Oto przykładowa komenda przydatna w tym projekcie:

**Plik:** `.cursor/commands/add-recipe-feature.md`

```markdown
# Dodaj funkcjonalność przepisu

Dodaj nową funkcjonalność zgodnie z architekturą projektu:

1. Utwórz komponent React w odpowiednim katalogu
2. Dodaj routing w Next.js
3. Utwórz endpoint API w katalogu `app/api/`
4. Dodaj typy TypeScript zgodne z istniejącymi
5. Zaimplementuj logikę zgodnie z PRD
6. Dodaj walidację danych
7. Obsłuż błędy i stany ładowania
```

## Podsumowanie

Cursor Commands to potężne narzędzie do automatyzacji pracy z kodem. Pozwalają na:
- ✅ Standaryzację procesów rozwoju
- ✅ Oszczędność czasu na powtarzalnych zadaniach
- ✅ Zapewnienie spójności w projekcie
- ✅ Współdzielenie wiedzy w zespole

Zacznij od prostych komend i stopniowo rozbudowuj bibliotekę komend dostosowanych do potrzeb Twojego projektu!

