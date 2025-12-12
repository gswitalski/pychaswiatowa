# Zmiany w projekcie: Numeracja kroków w przepisach

Dokument opisuje zmiany wprowadzone w celu obsługi automatycznej, ciągłej numeracji kroków w przepisach, niezależnie od podziału na sekcje.

## 1. Historyjki użytkownika

### Zmienione historyjki:

#### US-003: Dodawanie nowego przepisu
**Zmiana:** Dodano wymaganie dotyczące automatycznego oczyszczania tekstu kroków z ręcznej numeracji.
- **Nowe kryterium:** Tekst wklejony w pole "kroki" jest dzielony na poszczególne pozycje według znaków nowej linii. System automatycznie usuwa istniejącą ręczną numerację (np. "1.", "2) ") z początku linii, aby zapewnić spójne wyświetlanie w widoku szczegółów.

#### US-004: Przeglądanie szczegółów przepisu
**Zmiana:** Dodano wymaganie dotyczące sposobu wyświetlania listy kroków.
- **Nowe kryterium:** Lista kroków jest wyświetlana jako numerowana lista. Numeracja jest ciągła dla całego przepisu i nie resetuje się po nagłówkach sekcji (np. jeśli sekcja "Ciasto" kończy się na kroku 5, sekcja "Krem" zaczyna się od kroku 6).

#### US-013: Importowanie nowego przepisu z tekstu
**Zmiana:** Doprecyzowano logikę parsowania linii kroków.
- **Nowe kryterium:** System identyfikuje poszczególne składniki i kroki (linie zaczynające się od `-` lub numeracji typu `1.`). System usuwa te znaczniki podczas importu, pozostawiając samą treść, co zapobiega dublowaniu numeracji w interfejsie.

## 2. Widoki

### Zmienione widoki:

#### Szczegóły Przepisu (`/recipes/:id`)
**Zmiana:** Zaktualizowano opis kluczowych informacji i wymagań UX.
- **Opis:** Lista kroków musi być renderowana w sposób zapewniający ciągłość numeracji.
- **Implementacja:** Należy wykorzystać CSS Counters (`counter-reset` na kontenerze głównym, `counter-increment` na elementach listy), aby ignorować nagłówki sekcji w procesie liczenia. Standardowy tag `<ol>` resetowałby numerację po każdym przerwaniu listy nagłówkiem, dlatego wymagane jest niestandardowe podejście stylowania lub płaska struktura HTML z odpowiednimi klasami.

## 3. API

### Zmienione elementy:

#### Logika Biznesowa - Text Parsing
**Zmiana:** Rozszerzono logikę parsowania tekstów `steps_raw` (w endpointach `POST /recipes`, `PUT /recipes` oraz `POST /recipes/import`).
- **Opis:** Parser po stronie serwera (funkcja PostgreSQL) musi wykrywać i usuwać numerację (np. "1.", "1)", "1 -") oraz punktory z początku linii w sekcji kroków.
- **Cel:** Przechowywanie w bazie danych "czystej" treści kroku (np. "Wymieszaj składniki" zamiast "1. Wymieszaj składniki"). Pozwala to frontendowi na pełną kontrolę nad prezentacją numeracji i unika sytuacji, gdzie użytkownik widzi "1. 1. Wymieszaj składniki".

