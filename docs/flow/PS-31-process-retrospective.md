# PS-31: problemy napotkane w procesie `/ps-new-feature`

Dokument opisuje, co poszło nie tak podczas implementacji historyjki PS-31
(osobista notatka użytkownika do przepisu), ze szczególnym uwzględnieniem
reviewerów. Służy jako materiał do analizy procesu i wdrożenia poprawek w
skillach, agentach i regułach.

Zasada tego dokumentu: fakty są oddzielone od hipotez. Przy każdym problemie
jest sekcja **Fakty** (co zaobserwowano) i **Hipotezy / niepewne** (czego nie
udało się potwierdzić). Nie sprawdzano przyczyn źródłowych błędów
`Subagent was aborted`, bo komunikat nie zawiera szczegółów.

Powiązane: `.cursor/skills/ps-new-feature/SKILL.md`,
`.cursor/skills/ps-feature-conventions/SKILL.md`, `.cursor/agents/*.md`,
`docs/flow/flow-new-feature.md`.

---

## 1. Przebieg w skrócie

| Etap | Agent | Wynik |
|---|---|---|
| Pytania doprecyzowujące | `ps-story-analyst` (tryb `pytania`) | 7 pytań, odpowiedzi użytkownika (Q1: wariant C, reszta A) |
| Historyjka | `ps-story-analyst` | 24 scenariusze GWT |
| Plany funkcjonalne | `ps-feature-planner` | api-plan, ui-plan, deployment-plan |
| Plany implementacji | `ps-api-impl-planner`, `ps-view-impl-planner` (równolegle) | 2 plany; potem korekta planu widoków po decyzji użytkownika |
| Implementacja API | `ps-api-implementer` | migracja, RPC, endpoint, `my_note`, kontrakty |
| Review API, runda 1 | `ps-code-reviewer` | `ZMIANY_WYMAGANE`: B1, B2 blokujące, N1–N5 |
| Poprawki API, runda 1 | `ps-api-implementer` | poprawki B1, N1, N2, N3, N5, testy, skrypt SQL |
| Review API, runda 2 | `ps-code-reviewer` | **nie udało się** (3 × abort), pominięte decyzją użytkownika |
| Implementacja widoków | `ps-view-implementer` | komponent, serwis, guard, testy, E2E |
| Review widoków | `ps-code-reviewer` | **nie udało się** (3 × abort), pominięte decyzją użytkownika |
| Aktualizacja summary | `ps-summary-updater` | `project-summary.md` zaktualizowane |
| Ręczny test lokalny (użytkownik) | n/d | funkcja nie działała; przyczyna: crash funkcji `recipes` |

Liczby prób reviewera (wywołań `ps-code-reviewer`):

| Zakres | Próby | Wynik |
|---|---|---|
| API, runda 1 | 3 | 2 × abort (model domyślny), 1 × sukces (po ręcznym ustawieniu `claude-sonnet-5-5-high`) |
| API, runda 2 | 3 | 3 × abort (model `claude-sonnet-5-5-high`) |
| Widoki, runda 1 | 3 | 3 × abort (model `claude-sonnet-5-5-high`) |
| **Razem** | **9** | **1 sukces, 8 aborts** |

---

## 2. Problemy z reviewerami

### R1. `ps-code-reviewer` zwraca `Subagent was aborted` w 8 z 9 prób

**Fakty**
- Błąd ma jedną treść: `Error: Subagent was aborted`. Brak kodu, logu i przyczyny.
- Poprawne uruchomienie nastąpiło dopiero w trzeciej próbie rundy 1 API, po
  jawnym ustawieniu `model: claude-sonnet-5-5-high`. W dwóch pierwszych
  próbach model był domyślny (`inherit`).
- Z jawnym modelem później aborty wystąpiły w 6 próbach z rzędu (runda 2 API,
  widoki).
- Prompty były długie (lista plików, kryteria, tryb, runda), a zadanie to
  przegląd wielu plików: migracja, trzy serwisy, handlery, kontrakty,
  testy, frontend. Reviewer jest `readonly: true`.
- Ponawianie tego samego wywołania nie dało nowych informacji. Orkiestrator
  powtarzał te same wywołania, aż system oznaczył to jako pętlę.

**Konsekwencje**
- Runda 2 review API nie odbyła się. Zmiany z rundy poprawek (w tym
  regresja opisana w sekcji 3, P1) nie zostały przejrzane przez niezależną osobę.
- Widoki w ogóle nie miały review.
- Użytkownik musiał dwukrotnie decydować o pominięciu kroku, który skill
  nazywa obowiązkowym ("Po każdej implementacji uruchom niezależny
  `ps-code-reviewer`").

**Hipotezy / niepewne (do sprawdzenia)**
- Limit czasu lub kontekstu przy dużym zakresie przeglądu. Nie sprawdzono.
- Problem z trybem `readonly` albo z jednoczesnym użyciem narzędzi. Nie sprawdzono.
- Ręczne przerwanie przez użytkownika. Nie ma na to dowodu w rozmowie.
- Różnica między domyślnym a jawnym modelem może być przypadkowa (jeden
  sukces to za mało na wniosek).

**Propozycje poprawek**
1. W `ps-new-feature`: opisać zachowanie przy aborcie. Maksymalnie jedna
   ponowna próba, potem **zmiana strategii**, nie powtórzenie wywołania.
2. Dzielić review na mniejsze zakresy, np. `api-db` (migracja, RLS, RPC),
   `api-code` (handlery, serwisy, kontrakty), `api-tests`, `widoki`. Każdy
   zakres to osobne, krótsze wywołanie z listą plików.
3. Przekazywać reviewerowi listę zmienionych plików (`git diff --name-only`)
   zamiast kazać mu je odnajdywać.
4. Zdefiniować awaryjną ścieżkę: jeśli reviewer nie działa, uruchomić
   przegląd w głównym czacie albo przez `ps-analysis-reviewer`, albo oznaczyć
   etap jako **"bez review"** w widocznym miejscu (patrz R4).
5. Zbadać, dlaczego abort występuje (logi Cursora, limity), zanim przyjmie
   się jakikolwiek wzorzec obejścia.

### R2. Wynik review nie jest zapisywany jako artefakt

**Fakty**
- Wynik review rundy 1 istnieje tylko w odpowiedzi subagenta w czacie.
  Nie ma pliku w `docs/results/` ani w katalogu historyjki.
- Skill `ps-feature-conventions` ustala etap na podstawie artefaktów,
  ale review nie ma artefaktu. Po przerwaniu i wznowieniu polecenia
  orkiestrator **nie wie**, czy review się odbyło, ani jaki był werdykt.

**Konsekwencje**
- Nie da się odtworzyć, które uwagi były blokujące, a które nie.
- Dokument przeglądowy trzeba było pisać z historii czatu.

**Propozycje poprawek**
1. Reviewer zapisuje wynik do
   `docs/results/new-features/user-stories/PS-{N}/PS-{N}-{slug}-review-{api|views}-r{runda}.md`
   (wymaga zmiany `readonly: true` albo zapisu przez orkiestratora).
2. Dopisać ścieżki i etap "review" do `ps-feature-conventions`.

### R3. Reviewer jest `readonly: true`, więc nie uruchamia niczego

**Fakty**
- W review rundy 1 reviewer napisał wprost: "Niczego nie uruchamiałem. Nie
  wykonałem `deno test`, `deno check` ani `supabase db reset`", a wnioski
  wynikają z czytania kodu.
- Mimo to reviewer znalazł prawdziwy błąd blokujący (B1: brak `return;` w
  `set_recipe_note`, który dawał `500`) i brak testów backendowych (B2).

**Wniosek**
- Czytanie kodu wystarcza do części błędów logicznych, ale nie do błędów
  uruchomieniowych (patrz sekcja 3, P1). Reviewer tylko do odczytu nie
  jest ostatnią linią obrony. Weryfikacja uruchomieniowa musi być
  oddzielnym, jawnym krokiem (patrz sekcja 8, pierwsze trzy poprawki P0).

### R4. Pominięcie review nie jest widoczne w artefaktach

**Fakty**
- Po pominięciu review `ps-summary-updater` zapisał w `project-summary.md`
  funkcję jako "zakończona". Summary nie ma informacji, że review rundy 2
  i review widoków się nie odbyły.
- Updater zaznaczył też własne niepewności w odpowiedzi (np. że zdanie
  "Notatki nie są wyszukiwane ani pokazywane na listach" **wywnioskował
  z braku kodu** i nie sprawdził osobno). W pliku nie ma tej adnotacji.

**Propozycje poprawek**
1. Summary updater uruchamiać dopiero po akceptacji obu implementacji,
   albo dodać do summary pole statusu weryfikacji ("review API: 1/2",
   "review widoków: brak", "Deno: nie uruchomiono").
2. Zakazać updaterowi zapisu zdań, które nie wynikają z kodu. Jeśli wnioskuje
   z braku, ma to sprawdzić (`rg`) albo pominąć.

### R5. Niespójność słownika werdyktów

**Fakty**
- Agent `ps-code-reviewer` ma zwracać `AKCEPTACJA` albo `ZMIANY_WYMAGANE`.
- W promptach orkiestratora dla rundy 2 użyto `ZAAKCEPTOWANE / ZMIANY_WYMAGANE`.
- Reviewer użył w rundzie 1 poprawnie `ZMIANY_WYMAGANE`, więc nie spowodowało
  to jeszcze błędu. Jest to ryzyko przy automatycznym parsowaniu.

**Propozycja:** jeden słownik werdyktów w `ps-code-review` i wszędzie ten sam.

---

## 3. Problemy z implementacją i weryfikacją

### P1. Regresja w poprawce po review zepsuła całą funkcję `recipes`

**Fakty**
- Review rundy 1 zalecił poprawkę N1: znak `\u0000` w notatce ma dawać `400`.
- Implementer dodał w `setRecipeNoteSchema` (`recipes.handlers.ts`):
  `.refine(...)` **przed** `.max(20000)`. W Zod `.refine()` zwraca `ZodEffects`,
  który nie ma `.max()`.
- Skutek w logach `supabase_edge_runtime_pychaswiatowa`:
  `TypeError: z.string(...).refine(...).max is not a function`.
  Worker funkcji `recipes` **nie startował**, więc przestawały działać
  **wszystkie** endpointy tej funkcji, nie tylko notatka.
- Naprawa: zamiana kolejności na `.max(20000)`, potem `.refine(...)`.
  Po naprawie worker startuje (sprawdzone odpowiedzią `401` z kodu funkcji
  na żądanie z kluczem `anon`). Zapisu notatki jako zalogowany użytkownik
  nie sprawdzono.
- Błąd wykrył **użytkownik** podczas ręcznego uruchomienia lokalnie,
  a nie żaden etap procesu.

**Dlaczego nie został złapany**
1. Implementer zgłosił "lint OK, build OK, Vitest 328/328 OK". Te trzy
   komendy **nie obejmują** kodu w `supabase/functions` (Deno). Zielone wyniki
   dawały fałszywe poczucie bezpieczeństwa.
2. Testy Deno były dopisane, ale **nigdy nie uruchomione** (patrz P2).
3. Review rundy 2, który miał sprawdzić poprawki, nie odbył się (R1).
4. Nikt nie wykonał prostego testu dymnego: uruchomić funkcję i wysłać jedno
   żądanie.

**Propozycje poprawek**
1. Po **każdej** rundzie poprawek wymagać pełnej weryfikacji, nie tylko dla
   zmienionego pliku (patrz sekcja 8).
2. Dodać test dymny startu workera do listy weryfikacji implementera API:
   `supabase functions serve` + jedno żądanie do każdej zmienionej funkcji,
   oczekiwane `401`/`4xx` z kodu funkcji, **nie** `500` ani `InvalidWorkerResponse`.
3. Dodać regułę dla poprawek: poprawka po review jest nową zmianą i wymaga
   własnej weryfikacji, a w odpowiedzi implementer ma podać, co **uruchomił**.

### P2. Brak Deno w środowisku: backend zweryfikowany wyłącznie statycznie

**Fakty**
- Implementer API zgłosił dwa razy: "Deno CLI nie jest dostępne", więc
  `deno check` i `deno test` nie zostały wykonane. Typy bazy poprawiano ręcznie.
- Migracja nie została wykonana na żadnej bazie przez agentów. Skrypt
  `supabase/tests/ps31_user_recipe_notes.sql` nie został uruchomiony.
- `main-deploy.yml` nie uruchamia testów Deno (stwierdzono w deployment-plan).
  Czyli także CI ich nie wykonuje.
- Efekt: cały backend PS-31 (migracja, RPC, RLS, Edge Functions) nie przeszedł
  żadnej weryfikacji uruchomieniowej, a proces zakończył się "sukcesem".

**Propozycje poprawek**
1. Zdefiniować wymaganie wstępne środowiska i sprawdzać je **na starcie**
   (`deno --version`, `supabase --version`, Docker). Jeśli czegoś brakuje,
   orkiestrator informuje użytkownika przed implementacją, nie po.
2. Przy braku Deno etap API nie może być oznaczony jako zakończony.
   Status: "wymaga weryfikacji ręcznej" z listą komend do wykonania.
3. Dodać do CI osobny krok z `deno test` i `deno check` dla
   `supabase/functions`. Wniosek deployment-plan ("rozważyć w innej
   historyjce") powinien trafić do backlogu.

### P3. Implementer odszedł od planu w miejscu, które plan opisywał dokładnie

**Fakty**
- Plan implementacji API miał `return;` po `return query` (linia ~214 planu).
  Implementer go pominął, co dawało `500` przy usuwaniu notatki (null, `""`,
  same spacje). Wykrył to dopiero reviewer (B1).
- Plan wymagał testów dla `getMyRecipeNote`, `setRecipeNote`, `my_note` w trzech
  serwisach, schematu i routera oraz testu RLS/RPC na dwóch kontach.
  Pierwsza implementacja dostarczyła tylko test helpera `normalizeRecipeNote`
  i `countRecipeNoteCharacters` (B2).

**Propozycje poprawek**
1. Implementer ma na końcu przejść **checklistę planu punkt po punkcie** i w
   odpowiedzi podać status każdego punktu (zrobione / pominięte + powód).
2. Dla kluczowych fragmentów (SQL, polityki RLS, RPC) plan powinien być
   kopiowany dosłownie, a odstępstwa zgłaszane jawnie.

### P4. Typy bazy poprawiane ręcznie

**Fakty**
- Reviewer (N2) wskazał, że `database.types.ts` wygląda na dopisany ręcznie:
  brak `Relationships` z FK, kolejność nie alfabetyczna.
- Implementer poprawił to ręcznie ponownie. Generator
  (`supabase gen types`) nie został użyty.

**Propozycja:** po zastosowaniu migracji lokalnie typy generować komendą z
planu i sprawdzać `git diff` pod kątem tylko oczekiwanych zmian. To zależy od
działającej lokalnej bazy (patrz sekcja 4).

### P5. Raportowanie wyników przez agentów

**Fakty**
- Raporty implementerów mówiły "lint OK, build OK, testy OK" bez wskazania,
  że nie obejmują backendu. Użytkownik może to odczytać jako pełną weryfikację.
- Wynik nie rozróżniał "uruchomiono i przeszło", "nie uruchomiono",
  "zweryfikowano czytaniem kodu".

**Propozycja:** wymagany format raportu implementera: tabela
`Weryfikacja | Uruchomiono? | Wynik | Co NIE jest pokryte`.

---

## 4. Problemy środowiskowe (lokalna weryfikacja)

Nie są to wady agentów, ale zablokowały ręczną weryfikację funkcji.

| Problem | Fakty | Poprawka |
|---|---|---|
| `supabase start` kończy się błędem portu Studio | `failed to bind host port 0.0.0.0:54333/tcp: address already in use`. Port nie był zajęty według `netstat`, `Get-NetTCPConnection`, ani zakresów wykluczonych Windows. Pomógł restart Docker Desktop. | Opisać w dokumentacji środowiska lokalnego (`docs/configuration/environment-setup.md`). |
| Kontener `supabase_vector_pychaswiatowa` w pętli restartów | Widoczny w `docker ps`. Wymaga opcji Dockera "Expose daemon on tcp://localhost:2375" (ostrzeżenie CLI). Zakładka `Logs` w Studio może być przez to pusta. | Zalecić `docker logs supabase_edge_runtime_pychaswiatowa` jako główne źródło logów funkcji. |
| Wiele projektów Supabase równolegle | Na Dockerze działały też stacki `ebi` i `strummerbox`. | Zatrzymywać nieużywane stacki przy debugowaniu. |
| Niestandardowe porty lokalne | `config.toml`: API `54331`, baza `54332`, Studio `54333`, Mailpit `54334`. | Zapisać w regule/dokumentacji (patrz sekcja 5, A1). |

---

## 5. Błędy w mojej pracy jako orkiestratora i doradcy (do poprawy w skillach)

Te punkty dotyczą zachowania głównego agenta w tej sesji. Są tu, bo wpływają
na jakość procesu.

| # | Błąd | Skutek | Poprawka |
|---|---|---|---|
| A1 | W odpowiedzi o lokalnej bazie podałem **domyślne porty** Supabase (`54322`, `54323`), zamiast sprawdzić `supabase/config.toml` (faktycznie `54332`, `54333`). Poprawiłem to dopiero w następnej odpowiedzi. | Użytkownik dostał złą komendę `psql`. | Przed podaniem komend lokalnych czytać `config.toml`. Zapisać porty w regule projektu. |
| A2 | Poleciłem `supabase migration list` jako sprawdzenie stanu lokalnego. Bez `--local` komenda odpytuje **zdalną** powiązaną bazę. Przy późniejszym użyciu sam uruchomiłem ją i dopiero wtedy to zauważyłem (operacja tylko do odczytu). | Mylący wynik; dotknięcie zdalnej bazy bez potrzeby. | Zawsze `supabase migration list --local` do kontroli lokalnej. |
| A3 | Orkiestrator **powtarzał to samo wywołanie** reviewera po aborcie (3 razy na zakres), zamiast zmienić strategię (podział zakresu, inny agent). | Zmarnowany czas, flaga pętli. | Reguła z R1: maks. jedna powtórka, potem inna strategia albo pytanie do użytkownika. |
| A4 | Pierwszy raport końcowy przedstawiał stan jako gotowy ("PS-31 jest zaimplementowane"), mimo że backend nie był nigdy uruchomiony. Braki były wymienione, ale nie jako główny wniosek. | Funkcja nie działała przy pierwszym teście użytkownika. | Gdy weryfikacja uruchomieniowa nie była wykonana, status brzmi "zaimplementowane, **niezweryfikowane**" i stoi na początku podsumowania. |
| A5 | Sam przeczytałem poprawkę B1 (`return;` w migracji), ale **nie przeczytałem** zmian N1 w `recipes.handlers.ts`, mimo że to one zmieniały kod uruchamiany przy starcie funkcji. | Regresja P1 nie została wychwycona. | Po poprawkach przeglądać całe diffy, nie tylko poprawkę blokującą. |

---

## 6. Problemy na etapie analizy i planowania

### Z1. Pytanie Q1 miało opcję opartą na nieistniejącym scenariuszu

**Fakty**
- W trybie `pytania` analityk zaproponował Q1 opcję C: "własne i cudze, także
  z moich kolekcji".
- Dopiero przy pisaniu historyjki sprawdzono RLS i kod: cudzy przepis `SHARED`
  nie jest dostępny dla innych (RLS `recipes` i `recipe_collections` dopuszcza
  cudze przepisy tylko `PUBLIC`), a kolekcje nie mają przepisów `SHARED` innych
  autorów. Czyli wariant C nie różnił się realnie od wariantu A.
- Użytkownik wybrał C, bo opis sugerował, że dodaje on coś ponad A.

**Propozycja:** w trybie `pytania` weryfikować w kodzie/RLS fakty, na których
opierają się opcje, **przed** zadaniem pytania. Opcje, które są równoważne,
łączyć albo opisywać jako takie.

### Z2. Niespójność historyjki i planu UI wykryta dopiero przy planie widoków

**Fakty**
- Historyjka (scenariusz 6) dopuszczała "Usuń" także w trybie odczytu, a plan UI
  przewidywał "Usuń" tylko w trybie edycji.
- Niespójność zgłosił dopiero `ps-view-impl-planner` jako pytanie do użytkownika.
- Plan UI opisywał też niejednoznacznie, do której definicji
  `exploreRecipeIdSlugMatcher` w `app.routes.ts` dodać guard.

**Propozycja:** po etapie `ps-feature-plan` uruchamiać krótką kontrolę
spójności historyjka ↔ plany (np. rozszerzyć `ps-analysis-reviewer` o ten
tryb). Błędy planu są tańsze do naprawienia przed planami implementacji.

### Z3. Wiele bramek akceptacji

**Fakty**
- Użytkownik odpowiadał na pytania akceptacyjne 7 razy (po historyjce, po
  planach, po planach implementacji, po korekcie planu, po API, po aborcie
  reviewera, itd.). Każde zatrzymanie jest zgodne ze skillem, ale część
  pytań to były **prośby o decyzję w sprawie awarii narzędzia**, nie o
  jakość produktu.

**Propozycja:** rozróżnić bramki jakościowe (akceptacja artefaktu) od
techniczno-awaryjnych. Awarie obsługiwać regułą z R1 bez pytania, a
pytać dopiero, gdy wszystkie awaryjne ścieżki zawiodą.

---

## 7. Problemy z konfiguracją agentów

**Fakty**
- `ps-api-implementer.md` i `ps-view-implementer.md` mają w nagłówku
  `model: gpt-5.6-luna[]`. Zapis z pustymi nawiasami `[]` odbiega od
  formatu slugów w katalogu modeli (np. `gpt-5.6-luna-medium`). Nie
  sprawdzono, jak Cursor to interpretuje. Implementacje przebiegły, więc
  prawdopodobnie jest akceptowany, ale warto potwierdzić.
- Pozostałe agenty mają `model: inherit`, więc ich model zależy od modelu
  głównej sesji. Wyniki jakości nie są powtarzalne między sesjami.

**Propozycja:** sprawdzić w dokumentacji Cursora poprawną składnię `model:`
i ustawić jawny model dla reviewera (ewentualnie inny niż implementerzy, dla
niezależności).

---

## 8. Zbiorcza lista poprawek do wdrożenia

Priorytety: **P0** = bez tego proces daje fałszywe poczucie jakości,
**P1** = istotna poprawa, **P2** = porządki.

| Pr. | Poprawka | Dotyczy | Gdzie |
|---|---|---|---|
| P0 | Wymagać weryfikacji uruchomieniowej backendu: start workera i żądanie dymne każdej zmienionej funkcji (`supabase functions serve`) | P1, P2 | skill `ps-implement-api`, agent `ps-api-implementer` |
| P0 | Sprawdzać narzędzia na starcie (Deno, Supabase CLI, Docker). Brak = informacja przed implementacją, a status "niezweryfikowane" | P2 | skill `ps-new-feature` |
| P0 | Po rundzie poprawek wymagać pełnej weryfikacji i pełnego diffu, nie tylko poprawionych punktów | P1, A5 | `ps-new-feature`, `ps-api-implementer` |
| P0 | Obsługa abortu reviewera: maks. 1 powtórka, potem mniejszy zakres lub inny agent, potem oznaczenie "bez review" | R1, A3 | `ps-new-feature`, `ps-code-review` |
| P1 | Dzielić review na mniejsze zakresy i przekazywać listę plików | R1 | `ps-code-review`, `ps-code-reviewer` |
| P1 | Zapisywać wynik review jako artefakt i dodać go do konwencji etapów | R2 | `ps-feature-conventions` |
| P1 | Status weryfikacji w summary; updater po akceptacji implementacji; zakaz wniosków z braku kodu bez sprawdzenia | R4 | `ps-summary-update`, `ps-summary-updater` |
| P1 | Format raportu implementera: co uruchomiono, wynik, czego nie pokryto | P5 | agenty implementerów |
| P1 | Checklista planu punkt po punkcie w raporcie implementera | P3 | agenty implementerów |
| P1 | Krok CI: `deno check` i `deno test` dla `supabase/functions` | P2 | `.github/workflows` |
| P1 | W trybie `pytania` weryfikować fakty w kodzie przed zadaniem pytania | Z1 | `ps-user-story`, `ps-story-analyst` |
| P1 | Kontrola spójności historyjka ↔ plany po `ps-feature-plan` | Z2 | `ps-analysis-reviewer` lub nowy krok |
| P2 | Jeden słownik werdyktów | R5 | `ps-code-review` i prompty |
| P2 | Zapisać porty lokalne i procedurę logów w dokumentacji środowiska; używać `migration list --local` | A1, A2, sekcja 4 | `docs/configuration/environment-setup.md`, reguły |
| P2 | Zweryfikować składnię `model:` w agentach i ustawić jawny model reviewera | sekcja 7 | `.cursor/agents/*.md` |
| P2 | Rozdzielić bramki jakościowe od awaryjnych | Z3 | `ps-new-feature` |
| P2 | Generować typy bazy komendą po lokalnej migracji | P4 | `ps-implement-api` |

---

## 9. Otwarte pytania do zbadania

1. Dlaczego `ps-code-reviewer` kończy się `Subagent was aborted`? Sprawdzić logi
   Cursora, limity czasu/kontekstu oraz wpływ `readonly: true` i rozmiaru
   zakresu.
2. Czy zapis `model: gpt-5.6-luna[]` jest poprawny i jaki model faktycznie
   został użyty przez implementerów?
3. Czy istnieje więcej schematów Zod z `.refine()` przed metodami łańcucha?
   Wzorzec `.refine(...).max/min/trim` w `supabase/functions` nie został
   znaleziony prostym przeszukaniem, ale pełny test Deno nie był uruchomiony.
4. Czy zapis notatki działa end-to-end po naprawie (zalogowany użytkownik,
   tworzenie, edycja, usunięcie, prywatność między kontami)? Nie
   sprawdzono. Do wykonania po uruchomieniu testów Deno, skryptu SQL i E2E.
5. Czy `my_note` poprawnie nie wycieka między użytkownikami w funkcjach
   z service role (`explore`, `public`)? Reviewer potwierdził czytaniem
   kodu, ale testu na dwóch kontach nie wykonano.
