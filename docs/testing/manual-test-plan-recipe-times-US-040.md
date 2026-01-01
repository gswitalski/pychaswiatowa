# Plan Testów Manualnych - Czasy Przygotowania i Całkowity (US-040)

## Data: 2026-01-01
## Implementacja: Recipe Times Feature (prep_time_minutes, total_time_minutes)

---

## Środowisko testowe

- **URL**: http://localhost:4200/
- **User testowy**: test@pychaswiatowa.pl / 554G5rjnbdAanGR
- **Baza danych**: Lokalny Supabase (reset przeprowadzony)
- **Serwer**: Angular Dev Server (watch mode)

---

## 1. Testy Formularza Przepisu (Create Mode)

### Test Case 1.1: Tworzenie przepisu z poprawnymi czasami
**Kroki:**
1. Zaloguj się jako test@pychaswiatowa.pl
2. Przejdź do `/recipes/new`
3. Wypełnij wymagane pola:
   - Nazwa: "Sernik na zimno z czasami"
   - Składniki: "Ser twarogowy\nCukier\nBiszkopty"
   - Kroki: "Ubić ser\nWymieszać z cukrem\nOzdobić"
4. Uzupełnij czasy:
   - Czas przygotowania: 45
   - Czas całkowity: 90
5. Zapisz przepis

**Oczekiwany rezultat:**
- ✅ Formularz valid (przycisk "Dodaj przepis" aktywny)
- ✅ Zapis udany
- ✅ Przekierowanie do `/recipes/:id`
- ✅ W widoku szczegółów pokazują się metadane czasu z ikonami:
  - 🕒 schedule "45 min"
  - ⏱️ timer "1 h 30 min"

---

### Test Case 1.2: Tworzenie przepisu z czasem = 0
**Kroki:**
1. Nowy przepis `/recipes/new`
2. Nazwa: "Test czasu zerowego"
3. Składniki/Kroki: minimal
4. Czasy:
   - Czas przygotowania: 0
   - Czas całkowity: 0
5. Zapisz

**Oczekiwany rezultat:**
- ✅ Formularz valid
- ✅ Zapis OK
- ✅ Wyświetlanie: "0 min" dla obu pól (nie ukryte!)

---

### Test Case 1.3: Walidacja relacji (total < prep) - BŁĄD
**Kroki:**
1. Nowy przepis
2. Wypełnij wymagane pola
3. Czasy:
   - Czas przygotowania: 90
   - Czas całkowity: 30  ← MNIEJ niż prep
4. Spróbuj zapisać

**Oczekiwany rezultat:**
- ❌ Formularz invalid
- ❌ Przycisk "Dodaj przepis" zablokowany
- ❌ Pod polem "Czas całkowity" błąd:  
  "Czas całkowity nie może być mniejszy niż czas przygotowania"

---

### Test Case 1.4: Czyszczenie pól (X button)
**Kroki:**
1. Nowy przepis
2. Ustaw Czas przygotowania: 30
3. Kliknij "X" obok pola
4. Ustaw Czas całkowity: 60
5. Kliknij "X" obok pola

**Oczekiwany rezultat:**
- ✅ Po kliknięciu X pole ustawione na `null` (puste)
- ✅ Pole oznaczone jako `touched` (dla walidacji)
- ✅ Przycisk X widoczny tylko gdy wartość != null

---

### Test Case 1.5: Walidacja zakresu 0-999
**Kroki:**
1. Nowy przepis
2. Wypełnij wymagane
3. Testuj granice:
   - Czas przygotowania: -1 → oczekuj błędu "Minimalna wartość to 0"
   - Czas przygotowania: 1000 → oczekuj błędu "Maksymalna wartość to 999"
   - Czas całkowity: -5 → błąd min
   - Czas całkowity: 9999 → błąd max

**Oczekiwany rezultat:**
- ❌ Formularz invalid przy wartościach < 0 lub > 999
- ❌ Mat-error widoczny pod polem

---

### Test Case 1.6: Walidacja liczby całkowitej
**Kroki:**
1. Nowy przepis
2. Czas przygotowania: 45.5 (dziesiętna)
3. Sprawdź błąd

**Oczekiwany rezultat:**
- ❌ Błąd: "Podaj liczbę całkowitą"

---

### Test Case 1.7: Tylko prep ustawione (bez total)
**Kroki:**
1. Nowy przepis
2. Czas przygotowania: 30
3. Czas całkowity: (pusty)
4. Zapisz

**Oczekiwany rezultat:**
- ✅ Formularz valid (brak walidacji relacji, gdy jedno pole puste)
- ✅ Zapis OK
- ✅ W szczegółach pokazuje tylko prep_time (total niewidoczne)

---

### Test Case 1.8: Tylko total ustawione (bez prep)
**Kroki:**
1. Nowy przepis
2. Czas przygotowania: (pusty)
3. Czas całkowity: 120
4. Zapisz

**Oczekiwany rezultat:**
- ✅ Formularz valid
- ✅ Zapis OK
- ✅ W szczegółach pokazuje tylko total_time

---

## 2. Testy Formularza Przepisu (Edit Mode)

### Test Case 2.1: Edycja istniejącego przepisu - dodanie czasów
**Kroki:**
1. Otwórz istniejący przepis (np. Żurek - ID: 1)
2. Kliknij "Edytuj"
3. Sprawdź czy pola czasu są puste
4. Dodaj:
   - Czas przygotowania: 60
   - Czas całkowity: 180
5. Zapisz

**Oczekiwany rezultat:**
- ✅ Pola początkowo puste (legacy przepisy bez czasów)
- ✅ Dodanie czasów działa
- ✅ Po zapisie wyświetlają się w szczegółach

---

### Test Case 2.2: Edycja czasów - zmiana wartości
**Kroki:**
1. Otwórz przepis z czasami (z Test Case 1.1)
2. Edytuj:
   - Zmień prep z 45 na 30
   - Zmień total z 90 na 60
3. Zapisz

**Oczekiwany rezultat:**
- ✅ Formularz wczytuje obecne wartości (45, 90)
- ✅ Zmiana działa
- ✅ Nowe wartości zapisane i widoczne

---

### Test Case 2.3: Edycja - usunięcie czasów (powrót do null)
**Kroki:**
1. Otwórz przepis z czasami
2. Edytuj
3. Kliknij X przy obu polach czasu
4. Zapisz

**Oczekiwany rezultat:**
- ✅ Pola ustawione na null
- ✅ Zapis OK
- ✅ W szczegółach metadane czasu nie są renderowane (zniknęły)

---

### Test Case 2.4: Edycja - walidacja relacji podczas update
**Kroki:**
1. Otwórz przepis
2. Edytuj, ustaw:
   - prep: 120
   - total: 60 (mniej!)
3. Spróbuj zapisać

**Oczekiwany rezultat:**
- ❌ Błąd relacji pod total
- ❌ Zapis zablokowany

---

## 3. Testy Widoku Szczegółów (Recipe Detail)

### Test Case 3.1: Wyświetlanie czasów - oba ustawione
**URL:** `/recipes/:id` (przepis z prep=45, total=90)

**Oczekiwany rezultat:**
- ✅ Sekcja `.recipe-times` renderowana
- ✅ Ikona `schedule` (🕒) + "45 min"
- ✅ Ikona `timer` (⏱️) + "1 h 30 min"
- ✅ Metadane pod opisem, przed `.recipe-meta`

---

### Test Case 3.2: Wyświetlanie - tylko prep
**URL:** przepis z prep=30, total=null

**Oczekiwany rezultat:**
- ✅ Tylko jedna ikona schedule widoczna
- ✅ Ikona timer NIE renderowana

---

### Test Case 3.3: Wyświetlanie - tylko total
**URL:** przepis z prep=null, total=120

**Oczekiwany rezultat:**
- ✅ Tylko ikona timer widoczna
- ✅ Ikona schedule NIE renderowana

---

### Test Case 3.4: Brak czasów (legacy przepis)
**URL:** przepis bez ustawionych czasów

**Oczekiwany rezultat:**
- ✅ Sekcja `.recipe-times` NIE renderowana w ogóle
- ✅ Brak luki/pustej przestrzeni

---

### Test Case 3.5: Formatowanie czasu - różne wartości
**Testy pipe `durationMinutes`:**

| Minuty | Oczekiwany output |
|--------|-------------------|
| 0      | "0 min"          |
| 15     | "15 min"         |
| 45     | "45 min"         |
| 60     | "1 h"            |
| 90     | "1 h 30 min"     |
| 120    | "2 h"            |
| 125    | "2 h 5 min"      |
| 999    | "16 h 39 min"    |

**Oczekiwany rezultat:**
- ✅ Wszystkie formaty poprawne
- ✅ Liczba pojedyncza dla godziny (1 h, nie 1 h 0 min)

---

## 4. Testy Explore View (Public Recipe Detail)

### Test Case 4.1: Publiczny przepis z czasami
**URL:** `/explore/recipes/:id` (publiczny przepis z czasami)

**Oczekiwany rezultat:**
- ✅ Czasy wyświetlają się analogicznie do prywatnego widoku
- ✅ `PublicRecipeDetailDto` też zawiera pola czasów
- ✅ Format i ikony identyczne

---

## 5. Edge Cases i Defensive Tests

### Test Case 5.1: Równość czasów (total = prep)
**Kroki:**
1. Nowy przepis, ustaw prep=60, total=60
2. Zapisz

**Oczekiwany rezultat:**
- ✅ Formularz valid (≥ dozwolone)
- ✅ Zapis OK

---

### Test Case 5.2: Bardzo duże wartości (granica 999)
**Kroki:**
1. Nowy przepis
2. prep=999, total=999
3. Zapisz

**Oczekiwany rezultat:**
- ✅ Valid i zapis OK
- ✅ Wyświetlanie: "16 h 39 min" (oba)

---

### Test Case 5.3: Backend error handling (opcjonalny)
**Symulacja:** backend zwraca 400 z błędem walidacji relacji

**Oczekiwany rezultat:**
- ❌ Wyświetlony error banner na formularzu
- ❌ Komunikat zrozumiały dla użytkownika

---

## 6. Regression Tests

### Test Case 6.1: Istniejące funkcje formularza nie zepsute
**Sprawdź:**
- ✅ Tworzenie przepisu bez czasów (jak dotychczas) działa
- ✅ Edycja innych pól (nazwa, składniki, kategoria) działa
- ✅ Upload zdjęcia działa
- ✅ Servings nadal działa (clear button, walidacja)

### Test Case 6.2: Szczegóły przepisu - inne metadane OK
**Sprawdź:**
- ✅ Servings nadal wyświetla się poprawnie
- ✅ Termorobot badge działa
- ✅ Kategoria i tagi renderują się

---

## Checklist wykonania testów

- [ ] 1.1 - Tworzenie z poprawnymi czasami
- [ ] 1.2 - Czas = 0
- [ ] 1.3 - Walidacja relacji (błąd)
- [ ] 1.4 - Czyszczenie pól (X)
- [ ] 1.5 - Walidacja zakresu
- [ ] 1.6 - Walidacja integer
- [ ] 1.7 - Tylko prep
- [ ] 1.8 - Tylko total
- [ ] 2.1 - Edycja: dodanie czasów
- [ ] 2.2 - Edycja: zmiana wartości
- [ ] 2.3 - Edycja: usunięcie czasów
- [ ] 2.4 - Edycja: walidacja relacji
- [ ] 3.1 - Szczegóły: oba czasy
- [ ] 3.2 - Szczegóły: tylko prep
- [ ] 3.3 - Szczegóły: tylko total
- [ ] 3.4 - Szczegóły: brak czasów
- [ ] 3.5 - Formatowanie czasu
- [ ] 4.1 - Explore view
- [ ] 5.1 - Edge: równość
- [ ] 5.2 - Edge: max wartości
- [ ] 6.1 - Regression: form
- [ ] 6.2 - Regression: szczegóły

---

## Wynik testów

**Status:** ⏳ DO WYKONANIA (czekam na wykonanie testów przez użytkownika)

**Uwagi:**
- Wszystkie testy można wykonać lokalnie na http://localhost:4200
- Serwer działa w watch mode - zmiany w kodzie będą live reload
- Baza danych zresetowana, seed data dostępne
- User testowy: test@pychaswiatowa.pl / 554G5rjnbdAanGR

---

## Problemy znalezione podczas testów
_(wypełnić po wykonaniu)_

## Fix notes
_(wypełnić po naprawieniu problemów)_


