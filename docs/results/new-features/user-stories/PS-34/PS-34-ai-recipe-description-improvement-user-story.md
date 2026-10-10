# PS-34: Poprawa generowania opisu przepisu przez AI

## Opis

Jako **zalogowany użytkownik korzystający z asysty AI** (rola `user`, `premium` lub `admin`),
chcę **otrzymywać opis przepisu wygenerowany w stylu humorystycznym, familiarnym i zawierający jedną ciekawostkę**,
aby **końcowy tekst był angażujący, niepowtarzalny i zachęcający do gotowania — zamiast sztampowej, encyklopedycznej notki**.

---

## Kontekst

Aplikacja PychaŚwiatowa umożliwia generowanie wstępnego projektu przepisu (draftu) za pomocą AI
(`POST /ai/recipes/draft`), który uzupełnia formularz, w tym pole `description`.
Aktualnie generowany opis jest oceniany jako zbyt formalny i przewidywalny — nie odzwierciedla
ciepłego, domowego charakteru aplikacji ani nie zachęca użytkownika do dalszej interakcji z przepisem.

Zmiana ogranicza się wyłącznie do modyfikacji promptu systemowego w Edge Function `ai`
(plik `supabase/functions/ai/ai.service.ts`). Nie wymaga zmian w schemacie bazy danych,
kontrakcie API ani w warstwie UI. Ponieważ publiczne przepisy są widoczne dla gości
w katalogu `/explore`, styl musi pozostać familiarny i bezpieczny dla szerokiej publiczności
(bez treści dosłownie nieprzyzwoitych).

---

## Założenia i ograniczenia

- **Styl jedyny i domyślny** — nie wprowadzamy przełącznika trybu (poważny vs. humorystyczny);
  jeden spójny, pogodny ton dla wszystkich przepisów.
- **Humor familiarny i potoczny** — żarty o jedzeniu, kulinarne absurdy, lekkie uszczypliwości
  dotyczące trudności lub czasu przygotowania. Brak treści dosłownie nieprzyzwoitych.
- **Zawsze jedna ciekawostka** — historyczna, geograficzna lub dietetyczna, dobrana przez model
  do kontekstu przepisu; element obowiązkowy, nie losowy.
- **Długość opisu: 3–5 zdań** — wystarczająco, by zmieścić klimat + ciekawostkę, bez dominowania
  nad treścią samego przepisu.
- **Zakres implementacji: wyłącznie prompt** — `POST /ai/recipes/draft` → pole `description`
  w odpowiedzi. Endpoint `ai` przyjmuje rolę `user`/`premium`/`admin` i rozlicza kredyty `draft`.
- Model może nie znać ciekawostki dla bardzo niszowych potraw — w takim przypadku może sformułować
  ciekawostkę o kluczowym składniku lub technice kulinarnej.
- Opis jest polem opcjonalnym w formularzu; użytkownik zawsze może go ręcznie zmienić po wygenerowaniu.

---

## Kryteria akceptacji

### Scenariusz 1: Generowanie opisu dla popularnego przepisu (happy path)

- **Given**: Użytkownik posiada wystarczającą liczbę kredytów `draft` i wysyła żądanie
  `POST /ai/recipes/draft` z tekstem lub obrazem przepisu (np. „Spaghetti Carbonara").
- **When**: Model generuje odpowiedź zawierającą pole `description`.
- **Then**:
    - Opis zawiera **od 3 do 5 zdań**.
    - Opis zawiera **co najmniej jeden element humorystyczny** (żart, uszczypliwość, zabawna
      obserwacja kulinarna).
    - Opis zawiera **dokładnie jedną ciekawostkę** (historyczną, geograficzną lub dietetyczną)
      związaną z daniem lub jego składnikami.
    - Ton jest **familiarny i potoczny**, a nie formalny ani encyklopedyczny.
    - Opis **nie zawiera treści nieodpowiednich dla publiczności ogólnej** (brak wulgaryzmów,
      treści erotycznych ani obraźliwych).
    - Pozostałe pola odpowiedzi draftu (nazwa, składniki, kroki, metadane) pozostają **bez zmian**.

### Scenariusz 2: Generowanie opisu dla niszowego lub niejednoznacznego przepisu

- **Given**: Użytkownik wysyła żądanie z przepisem mało popularnym lub o nazwie niejednoznacznej
  (np. domowy przepis babci bez ustalonej nazwy).
- **When**: Model nie dysponuje pewną ciekawostką historyczną/geograficzną dla tego konkretnego dania.
- **Then**:
    - Model formułuje ciekawostkę o **kluczowym składniku lub technice kulinarnej** (zamiast
      o samym daniu).
    - Wymagania co do liczby zdań, humoru i tonu pozostają spełnione.
    - Odpowiedź API zwraca kod `200` — brak ciekawostki o daniu nie jest błędem.

### Scenariusz 3: Wyczerpanie kredytów `draft`

- **Given**: Użytkownik wyczerpał pulę kredytów `draft`.
- **When**: Wysyła żądanie `POST /ai/recipes/draft`.
- **Then**:
    - Endpoint zwraca `402 AI_CREDITS_EXHAUSTED` — **bez zmian względem obecnego zachowania**.
    - Zmieniony prompt nie wpływa na logikę rozliczania kredytów ani obsługę błędów.

### Scenariusz 4: Opis generowany z obrazu (tryb image)

- **Given**: Użytkownik wysyła żądanie z obrazem potrawy (zamiast tekstu).
- **When**: Model generuje odpowiedź zawierającą pole `description`.
- **Then**:
    - Nowy styl opisu (humor + ciekawostka + 3–5 zdań) obowiązuje **tak samo jak dla trybu
      tekstowego**.
    - Zmiana promptu działa niezależnie od trybu wejściowego (`text` / `image`).

### Scenariusz 5: Ręczna edycja opisu po wygenerowaniu

- **Given**: Użytkownik otrzymał draft i nie odpowiada mu wygenerowany opis.
- **When**: Edytuje pole `description` w formularzu przepisu przed zapisem.
- **Then**:
    - Pole `description` jest w pełni edytowalne — **bez zmian względem obecnego zachowania**.
    - Zapis przepisu (`POST /recipes` lub `PUT /recipes/{id}`) przyjmuje dowolną wartość pola.

---

## Definicja ukończenia (Definition of Done)

- [ ] Prompt systemowy w `supabase/functions/ai/ai.service.ts` zaktualizowany zgodnie
      z wymaganiami (humor familiarny, jedna ciekawostka, 3–5 zdań, zakaz treści nieodpowiednich)
- [ ] Manualna weryfikacja: co najmniej 5 różnych przepisów (w tym ≥1 niszowy, ≥1 z obrazu)
      wygenerowanych po zmianie — każdy spełnia kryteria stylu i długości
- [ ] Kontrakt API (`shared/contracts/types.ts`) bez zmian — pole `description` w odpowiedzi
      draftu pozostaje `string | null`
- [ ] Testy jednostkowe promptu (mock modelu) zaktualizowane lub dodane w `ai.service.spec.ts`,
      weryfikujące obecność instrukcji stylu w konstruowanym komunikacie
- [ ] Code review zakończone pozytywnie
- [ ] Deploy Edge Function `ai` na środowisku dev/staging i smoke test `POST /ai/recipes/draft`

---

## Powiązania

- **Jira:** [PS-34 — Poprawa generowania opisu przez AI](https://pychaswiatowa.atlassian.net/browse/PS-34)
- **Powiązane historyjki:**
    - US-036 — Asystowane dodawanie (AI) — główny flow, którego dotyczy zmiana
    - PS-64 — Kredyty AI — mechanizm rozliczania, bez zmian w tej historyjce
    - PS-35 — Poprawa generowania zdjęcia przez AI — analogiczna historyjka dla zdjęć
