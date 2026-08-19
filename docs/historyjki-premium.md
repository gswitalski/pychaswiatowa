# Historyjki użytkownika — plan Premium (v02)

Dokument implementacyjny dla modelu freemium z subskrypcją Premium.
Źródła: `docs/results/project-summary.md`, `docs/analizaf0funkcjonalnosci-premium-v02.md`.

Kolejność: od fundamentów blokujących (rola, kredyty, checkout) do funkcji zwiększających ARPU (import URL, planer, rodzina). Historyjki o wyższym numerze nie powinny startować przed spełnieniem kryteriów historyjek, od których zależą.

Istniejące story MVP (`US-001` … `US-ADM-002`) pozostają w mocy. Poniższe `PREM-*` uzupełniają je o monetyzację i feature gating — nie zastępują CRUD przepisów, auth ani katalogu publicznego.

Zasady produktowe obowiązujące wszystkie historyjki:

- Free to prawdziwa prywatna książka kucharska (bez niskiego capu liczby przepisów).
- Nigdy nie komunikować „nielimitowanego AI”.
- Gość nie zużywa płatnego API AI.
- Markdown / wklejany tekst bez LLM pozostaje darmowy i nie jest haczykiem sprzedażowym Premium.

---

## Faza 0 — Fundamenty (blokują resztę)

### PREM-001 — Jednolity model uprawnień (entitlements)

**Zależności:** `US-035` (rola w JWT: `user` / `premium` / `admin`).

**Opis:**  
Jako system chcę jedno źródło prawdy o tym, co konto może zrobić (rola, trial, kredyty, limity Free), żeby UI i backend konsekwentnie odmawiały lub pozwalały na funkcje Premium.

**Kryteria akceptacji:**

- Istnieje serwis/warstwa (frontend + backend) zwracająca dla sesji: `app_role`, status subskrypcji (`none` / `trial` / `active` / `past_due` / `canceled`), datę końca okresu, pozostałe kredyty per pula.
- `admin` ma co najmniej uprawnienia `premium` (bez reklam, dostęp do funkcji Premium), plus dostęp do `/admin/*`.
- Guardy i Edge Functions nie polegają wyłącznie na ukryciu przycisku w UI — decyzja jest weryfikowana po stronie serwera.
- Brak subskrypcji = traktowanie jak `user` (Free), nawet jeśli w JWT kiedyś była rola `premium`.

---

### PREM-002 — Pule kredytów AI (ledger)

**Zależności:** PREM-001.

**Opis:**  
Jako właściciel produktu chcę mierzyć i odejmować kredyty za udane operacje AI, żeby chronić marżę i mieć czym sprzedawać pulę Premium oraz pakiety.

**Kryteria akceptacji:**

- Są trzy osobne pule: `import_text_url` (tani import tekst/URL), `import_image` (obraz/skan), `image_generate` (generowanie zdjęcia przepisu).
- Kredyt jest odejmowany tylko po **udanym** wyniku (nie za błąd API, timeout, walidację wejścia).
- Konto Free: 1–3 udane asysty/importy AI **na konto (lifetime onboarding)**, wyłącznie pula `import_text_url` i/lub `import_image` według konfiguracji; pula `image_generate` = 0.
- Konto Premium/trial: stała miesięczna pula per typ (wartości konfigurowalne, nie „unlimited”).
- Endpointy `/ai/recipes/draft` i `/ai/recipes/image` odmawiają z `402`/`403` + kodem powodu (`NO_CREDITS` / `FEATURE_LOCKED`) gdy brak uprawnienia lub kredytów.
- Operacja jest idempotentna przy retry tego samego żądania (brak podwójnego pobrania kredytu).

---

### PREM-003 — Ekran zużycia: kredyty AI i przestrzeń zdjęć

**Zależności:** PREM-002.

**Opis:**  
Jako zalogowany użytkownik chcę widzieć, ile kredytów i miejsca na zdjęcia mi zostało, żebym wiedział, kiedy upgrade lub pakiet ma sens.

**Kryteria akceptacji:**

- W `/settings` (lub dedykowanej podstronie) widać: pulę, zużycie, reset (dla Premium: koniec okresu rozliczeniowego; dla Free: lifetime).
- Widoczny jest umiarkowany limit Storage dla Free oraz wyższy, nadal skończony, dla Premium — komunikat jako „miejsce na dysku”, nie „kup więcej przepisów”.
- Przy ~70–80% puli AI lub Storage pojawia się komunikat z CTA do `/pricing` lub dokupienia kredytów (gdy PREM-016 istnieje).
- Gość nie widzi tego ekranu.

---

## Faza 1 — Pierwsza złotówka (checkout, cennik, limity na istniejącym AI)

### PREM-004 — Publiczna strona `/pricing`

**Zależności:** PREM-001 (może startować równolegle z PREM-002 po ustaleniu oferty).

**Opis:**  
Jako gość lub użytkownik Free chcę porównać Free vs Premium i wybrać plan, żebym rozumiał za co płacę zanim wejdę w checkout.

**Kryteria akceptacji:**

- Ścieżka `/pricing` dostępna bez logowania.
- Widoczne korzyści Premium zgodne z v02: import URL/zdjęcie/skan, planer/zakupy, brak reklam, pula AI — **nie** „więcej przepisów” jako główny argument.
- Dwa plany: miesięczny (orientacyjnie 19–29 zł) i roczny (orientacyjnie 149–199 zł); **roczny jest domyślnym wyborem**.
- Opis trialu: 7 dni **z limitem AI**, bez obietnicy nielimitowanego AI.
- Zalogowany `premium` z aktywną subskrypcją widzi stan konta zamiast twardego CTA „Kup”.
- Landing (`/`) ma jasny opis wartości i link do `/pricing`.

---

### PREM-005 — Checkout subskrypcji (miesiąc / rok + trial)

**Zależności:** PREM-001, PREM-004.

**Opis:**  
Jako zalogowany użytkownik chcę opłacić Premium (BLIK/PayU lub odpowiednik) z trialem 7 dni, żebym mógł legalnie dostać rolę `premium`.

**Kryteria akceptacji:**

- Checkout wymaga zalogowanego, zweryfikowanego konta (`US-001`/`US-002`).
- Wybór: miesiąc lub rok; rok preselected.
- Trial 7 dni z tą samą pulą AI co konfiguracja trial — nie z pełnym „unlimited”.
- Po starcie sesji płatności użytkownik wraca do aplikacji ze statusem pending/success/failure i czytelnym komunikatem.
- Brak możliwości drugiego trialu na to samo konto (i reguła anty-abuse na e-mail/płatnika — minimum: jedno konto = jeden trial).
- Dane karty/BLIK nie są przechowywane w naszej bazie poza tokenami operatora.

---

### PREM-006 — Webhook płatności → rola `premium` w JWT

**Zależności:** PREM-005, PREM-001.

**Opis:**  
Jako system chcę po opłaceniu / odnowieniu / anulowaniu zaktualizować subskrypcję i `app_role`, żeby uprawnienia działały od razu po płatności i wygasały po jej braku.

**Kryteria akceptacji:**

- Webhook operatora jest weryfikowany (podpis/sekret); nieautoryzowane wywołania są odrzucane.
- `active` / udany trial → `app_role = premium`; kolejne logowanie/refresh JWT zawiera nową rolę.
- `canceled` z ważnym okresem: Premium do końca opłaconego okresu, potem `user`.
- `past_due` / refund / chargeback: zdefiniowane zachowanie (co najmniej utrata Premium po nieudanej windykacji).
- Idempotencja webhooków (ten sam event nie dubluje uprawnień ani faktur).
- Istnieje ścieżka ręczna dla admina (nawet minimalna) do nadania/odebrania Premium na potrzeby refundu/supportu.

---

### PREM-007 — Faktury, maile transakcyjne i strony prawne płatności

**Zależności:** PREM-005.

**Opis:**  
Jako klient B2C w PL/UE chcę faktury/potwierdzenia oraz regulamin subskrypcji i odstąpienia, żebym mógł legalnie kupić i odstąpić od umowy.

**Kryteria akceptacji:**

- Po płatności wychodzi mail z potwierdzeniem (kwota, okres, plan).
- Dostępne strony: regulamin subskrypcji, polityka zwrotów/odstąpienia (obok istniejących `/legal/terms`, `/legal/privacy`, `/legal/publisher`).
- Linki prawne są w stopce i w checkout przed obciążeniem.
- Anulowanie odnowienia jest możliwe z poziomu ustawień (lub panelu operatora z deep-linkiem) przed kolejnym cyklem.

---

### PREM-008 — Gating istniejącej asysty AI (US-036)

**Zależności:** PREM-002.

**Opis:**  
Jako użytkownik Free chcę 1–3 udane asysty AI na start, a potem paywall, żebym poznał wartość bez wiecznego darmowego LLM.

**Kryteria akceptacji:**

- `/recipes/new/assist` i `POST /ai/recipes/draft` działają dla zalogowanych zgodnie z pulą.
- Gość: brak wejścia w asystę AI; brak demo bez konta.
- Po wyczerpaniu kredytów: komunikat z korzyściami Premium + CTA `/pricing` (oraz pakiet kredytów, gdy PREM-016).
- Import Markdown (`US-013`, `/recipes/import`) **nie** pobiera kredytów i pozostaje dostępny dla Free.
- Wyczerpanie kredytów nie blokuje ręcznego formularza (`US-003`).

---

### PREM-009 — Gating generowania zdjęcia AI (US-037 / US-046)

**Zależności:** PREM-002, US-037.

**Opis:**  
Jako użytkownik Premium chcę generować zdjęcie AI z wąskiej puli, a jako Free nie dostawać tego w cenie subskrypcji darmowej.

**Kryteria akceptacji:**

- Free: przycisk generowania AI ukryty lub z lockiem; API odrzuca żądanie (add-on kredytów możliwy dopiero po PREM-016).
- Premium/admin: `POST /ai/recipes/image` zużywa pulę `image_generate` (tryb `recipe_only` i `with_reference`).
- Brak kredytów → podgląd nie powstaje, komunikat + CTA dokupu/upgrade.
- Upload własne (paste/drop/file, `US-027`) bez kredytów AI, z limitem Storage z PREM-003.

---

### PREM-010 — Limity Free: węższy plan i Storage (bez capu przepisów)

**Zależności:** PREM-001, US-038, US-039.

**Opis:**  
Jako użytkownik Free chcę korzystać z „Mojego planu” i zdjęć w wersji podstawowej, a jako Premium mieć wyższy limit planu — bez sztucznego limitu 50–100 przepisów jako paywalla.

**Kryteria akceptacji:**

- Brak twardego niskiego limitu liczby przepisów i kolekcji; ewentualny bardzo wysoki cap antyspamowy nie jest komunikowany jako oferta Premium.
- Free: węższy plan niż pełne MVP 50, np. 7–14 pozycji (konfigurowalne); przy limicie CTA upgrade, nie usuwanie biblioteki.
- Premium: wyższy limit planu (np. 50 jak MVP lub więcej — spójny z produktem).
- Przekroczenie Storage Free blokuje **nowe** uploady zdjęć z komunikatem miejsca na dysku; przepisy bez nowego zdjęcia nadal można zapisać.
- Lista zakupów podstawowa (US-049–054) zostaje dla Free; scalanie zaawansowane jest PREM-021.

---

## Faza 2 — Konwersja na witrynie publicznej

### PREM-011 — CTA „Zapisz do swojej książki kucharskiej”

**Zależności:** US-019, US-001.

**Opis:**  
Jako gość na publicznym przepisie chcę oczywistej ścieżki zapisu do własnej książki, żebym założył konto zamiast tylko czytać.

**Kryteria akceptacji:**

- Na `/explore/recipes/:id-:slug` dla gościa główne CTA to zapis do książki → `/register` (z powrotem do przepisu po zalogowaniu, jeśli technicznie możliwe).
- Zalogowany nie-autor: istniejące „Dodaj do kolekcji” / „Dodaj do planu” (`US-020`, `US-021`, `US-038`) bez CTA rejestracji.
- CTA nie zasłania treści przepisu i nie jest banerem pełnoekranowym.

---

### PREM-012 — Dyskretny blok korzyści Premium (po CTA zapisu)

**Zależności:** PREM-004, PREM-011.

**Opis:**  
Jako gość chcę krótko zrozumieć Premium, ale nie kosztem SEO i zaufania do treści przepisu.

**Kryteria akceptacji:**

- Jeden blok korzyści **pod** głównym CTA zapisu, nie zamiast składników/kroków.
- Brak agresywnego paywalla na każdym publicznym przepisie (brak overlay na treści).
- Link do `/pricing`.
- Autor własnego przepisu w katalogu nie widzi zbędnego CTA sprzedaży na swoim przepisie.

---

### PREM-013 — Publiczne strony SEO (kategorie / kuchnie / termorobot / grill)

**Zależności:** US-017, US-018, US-029, US-042, US-043.

**Opis:**  
Jako gość chcę lądować na kanonicznych listach (np. kuchnia włoska, termorobot), żebym znajdował treść z wyszukiwarki i filtrów niszy.

**Kryteria akceptacji:**

- Istnieją indeksowalne ścieżki, np. `/explore/kuchnia/:slug`, `/explore/termorobot`, `/explore/grill` (oraz analogicznie dieta/trudność jeśli spójne z filtrami API).
- Listy używają publicznych przepisów (`visibility = PUBLIC`), ranking/paginacja jak `/explore`.
- Meta title/description unikalne per widok; kanoniczny URL.
- Filtry dieta, kuchnia, trudność, grill, termorobot działają dla gościa w `/explore`.

---

### PREM-014 — Reklamy i afiliacja na częściach publicznych

**Zależności:** PREM-001, PREM-013 (ruch). Wdrożenie **po** uzyskaniu indeksowalnego ruchu — nie blokuje checkoutu.

**Opis:**  
Jako właściciel witryny chcę monetyzować gości i Free na landingu/`/explore`, a Premium ma być bez reklam.

**Kryteria akceptacji:**

- Sloty reklam/afiliacji na `/` i `/explore` (ew. listy SEO); nie w treści przepisu w sposób psujący czytelność składników i kroków.
- Brak reklam w edytorze przepisu.
- Użytkownik `premium` / `admin` nie widzi reklam.
- Free może widzieć reklamy na widokach inspirowanych katalogiem publicznym, nie w formularzu edycji.
- Linki afiliacyjne (sprzęt, termorobot, grill) są oznaczone zgodnie z prawem (gdy treść sponsorowana).

---

## Faza 3 — Skok ARPU (import, planer, kredyty extra)

### PREM-015 — Historia importów AI i powrót do szkicu

**Zależności:** PREM-008.

**Opis:**  
Jako użytkownik Premium (i Free w ramach onboardingu) chcę wrócić do ostatniego szkicu AI, żebym nie stracił wyniku po odświeżeniu lub przerwaniu.

**Kryteria akceptacji:**

- Udany draft zapisuje szkic (pola formularza) powiązany z użytkownikiem, bez wymuszania od razu `POST /recipes`.
- Lista/historia ostatnich importów (ograniczona liczba, np. ostatnie N).
- „Wznów szkic” otwiera formularz wstępnie wypełniony.
- Szkic nie publikuje przepisu i nie omija limitów kredytów (kredyt pobrany przy udanym draftcie, nie przy każdym otwarciu szkicu).

---

### PREM-016 — Pakiety kredytów (add-on)

**Zależności:** PREM-002, PREM-005 (ten sam operator płatności).

**Opis:**  
Jako użytkownik Free lub Premium chcę dokupić pakiet kredytów bez nowej subskrypcji, żebym dokończył import przy końcu puli.

**Kryteria akceptacji:**

- Zakup pakietu możliwy dla `user` i `premium`.
- Kredyty doliczane do właściwej puli (tekst/URL vs obraz vs generowanie zdjęcia — zgodnie z SKU pakietu).
- Pakiet nie nadaje roli `premium` i nie wyłącza reklam (chyba że SKU to wyraźnie obiecuje — domyślnie nie).
- Free może kupić kredyty na asystę; generowanie zdjęcia AI z add-onu jest dozwolone tylko jeśli SKU to obejmuje.
- Faktura/mail jak przy subskrypcji (PREM-007).

---

### PREM-017 — Import przepisu z URL (filar Premium)

**Zależności:** PREM-002, PREM-008, PREM-005 (sprzedaż obietnicy możliwa wcześniej jako „wkrótce”, implementacja po checkout).

**Opis:**  
Jako użytkownik Premium chcę wkleić link do przepisu i dostać wstępnie wypełniony formularz, żebym nie przepisywał kolekcji ręcznie.

**Kryteria akceptacji:**

- Nowy tryb w kreatorze (`/recipes/new/start`): „Z linku (URL)” obok pustego formularza i asysty.
- Free: lock + CTA `/pricing`; API odrzuca bez Premium (wyjątek: zużycie kredytów z pakietu tylko jeśli produkt tak zdefiniuje — domyślnie URL = Premium).
- Wejście: poprawny http(s) URL; błędy (timeout, 404, treść nie-przepis) z komunikatem bez pobrania kredytu.
- Sukces: te same pola co draft AI (`US-036`) → użytkownik zapisuje ręcznie.
- Zużycie puli `import_text_url`.
- Brak masowego importu wielu URL naraz w tym SKU.
- Fair use: limity częstotliwości; nadużycia widoczne później w adminie (PREM-026).

---

### PREM-018 — Import ze zdjęcia, zrzutu i skanu

**Zależności:** PREM-002, PREM-008 (rozszerzenie US-036 o wyraźny tryb obrazu).

**Opis:**  
Jako użytkownik z kredytami obrazu chcę wrzucić zdjęcie/skan przepisu i dostać draft, żebym przeniósł papierową lub zrzutową kolekcję.

**Kryteria akceptacji:**

- Kreator przyjmuje obraz (plik/zrzut) w asyście; OCR+LLM jak `/ai/recipes/draft`.
- Pula `import_image`; Free tylko w ramach 1–3 udanych onboardingu, potem paywall/pakiet.
- Limit rozmiaru/formatu analogiczny do uploadu zdjęć (PNG/JPG/WebP, max 10 MB) z jasnym błędem.
- Gość: brak.
- Masowy import wielu zdjęć naraz: poza zakresem (PREM-028).

---

### PREM-019 — Sugestie kategorii, tagów, kuchni, diety i trudności

**Zależności:** PREM-008 lub PREM-017 (draft musi istnieć).

**Opis:**  
Jako użytkownik po imporcie chcę propozycji metadanych do akceptacji, żebym szybciej dokończył przepis.

**Kryteria akceptacji:**

- Po drafcie AI/URL/obraz system proponuje: kategorię z listy, tagi, `diet_type`, `cuisine`, `difficulty` (pola z US-010, US-042).
- Użytkownik może przyjąć, poprawić lub odrzucić przed zapisem.
- Sugestie nie nadpisują milcząco ręcznie ustawionych pól przy edycji istniejącego przepisu bez zgody.
- Koszt: w ramach kredytu importu albo tanio w puli tekstowej — nie jako osobne „nielimitowane AI”.

---

### PREM-020 — Automatyczne przeliczanie porcji i składników

**Zależności:** US-003, US-028, US-047 (normalizacja ułatwia poprawne ilości).

**Opis:**  
Jako zalogowany użytkownik (Premium w pierwszym SKU) chcę zmienić liczbę porcji i zobaczyć przeliczone ilości, żebym gotował na inną liczbę osób bez liczenia w pamięci.

**Kryteria akceptacji:**

- Na szczegółach przepisu zmiana porcji (w zakresie 1–99) przelicza ilości tam, gdzie da się sparsować liczbę.
- Składniki bez liczby zostają bez zmian (brak zmyślonych wartości).
- Free: możliwe uproszczenie (tylko wyświetlanie zapisanych porcji bez live-przeliczania) albo lock — decyzja: **przeliczanie live = Premium**, spójnie z v02.
- Przeliczenie na widoku nie nadpisuje zapisanego przepisu, dopóki autor nie zapisze edycji.

---

### PREM-021 — Zaawansowana lista zakupów (scalanie, jednostki, grupy)

**Zależności:** US-047–US-054, PREM-001.

**Opis:**  
Jako użytkownik Premium chcę scaloną listę zakupów (ta sama nazwa/jednostka, lepsze jednostki, grupy), żebym kupował raz na tydzień bez duplikatów.

**Kryteria akceptacji:**

- Free: obecne grupowanie frontendowe po `(nazwa, jednostka, is_owned)` bez obiecywania inteligentnego scalania.
- Premium: scalanie znormalizowanych składników (synonimy/jednostki w ramach istniejącej normalizacji), grupy (np. działy: nabiał, warzywa — jeśli dane na to pozwalają).
- Odhaczanie, ręczne pozycje, czyszczenie listy i niezależność od planu (US-051–054) działają jak dotychczas.
- Komunikat upgrade przy próbie „inteligentnego scalania” u Free (ścieżka konwersji zakupy → checkout).

---

### PREM-022 — Planer tygodniowy powiązany z listą zakupów

**Zależności:** US-038, US-039, US-049, PREM-010, PREM-021 (zakupy z planu tygodnia korzystają ze scalania).

**Opis:**  
Jako użytkownik Premium chcę rozłożyć przepisy na dni tygodnia i wygenerować listę zakupów, żebym codziennie gotował bez układania planu od zera.

**Kryteria akceptacji:**

- Widok tygodnia (7 dni) z przypisanymi przepisami z limitu planu Premium.
- Dodanie do dnia tygodnia dodaje do planu / listy zakupów spójnie z US-049 (side effect składników).
- Usunięcie z dnia aktualizuje zakupy jak US-050, bez kasowania całego tygodnia przypadkiem.
- Free: komunikat, że pełny tydzień/planer jest w Premium; zostaje węższy „Mój plan” z PREM-010.
- Funkcja jest w pierwszym SKU Premium albo bezpośrednio po starcie płatności — nie jako odległy backlog.

---

### PREM-023 — Wyższy priorytet jobów AI i normalizacji dla Premium

**Zależności:** US-047, US-048, PREM-001.

**Opis:**  
Jako użytkownik Premium chcę szybszej normalizacji składników i jobów AI, żebym nie czekał w tej samej kolejce co darmowy onboarding.

**Kryteria akceptacji:**

- Worker (`/internal/workers/normalized-ingredients/run`) obsługuje joby Premium przed Free przy tym samym `PENDING`.
- Retry 5x z backoff pozostaje; Premium nie omija limitu prób w nieskończoność.
- Brak głodzenia Free: minimalny share kolejki dla `user` (fairness).

---

## Faza 4 — ARPU i retencja (rodzina, admin, UGC)

### PREM-024 — Maile lifecycle (trial, kredyty, winback)

**Zależności:** PREM-005, PREM-002, PREM-007.

**Opis:**  
Jako użytkownik chcę dostać mail przed końcem trialu i po wyczerpaniu kredytów, żebym zdążył zostać lub wrócić.

**Kryteria akceptacji:**

- Mail: zbliżający się koniec trialu (np. 48 h), koniec trialu bez konwersji, wyczerpanie puli AI, winback po rezygnacji (zgodnie z zgodą marketingową / transakcyjną).
- Maile transakcyjne (płatność, faktura) niezależne od zgody marketingowej.
- Linki w mailu prowadzą do `/pricing`, ustawień subskrypcji lub ekranu kredytów.

---

### PREM-025 — Konto rodzinne (właściciel + współdomownicy, wspólne zakupy)

**Zależności:** PREM-006, PREM-021. Tuż po starcie płatności, nie jako „średni” temat.

**Opis:**  
Jako właściciel Premium chcę dodać współdomowników do wspólnej listy zakupów, żeby podnieść wartość subskrypcji i obniżyć churn.

**Kryteria akceptacji:**

- Właściciel zaprasza N członków (limit konfigurowalny, np. 2–4) na e-mail.
- Członkowie mają dostęp do wspólnej listy zakupów (odczyt/odhaczanie/dodawanie ręcznych pozycji według reguł).
- Przepisy pozostają własnością autorów; współdzielenie prywatnych kolekcji może być etapem 2 tej historyjki, ale wspólne zakupy są w zakresie v1 rodziny.
- Anulowanie Premium właściciela kończy korzyści rodziny z końcem okresu.
- Brak „darmowego Premium” dla niepowiązanych kont (invite token, limit zaproszeń).

---

### PREM-026 — Admin: subskrypcje, zużycie AI, nadużycia, refundy

**Zależności:** US-ADM-001, US-ADM-002, PREM-002, PREM-006.

**Opis:**  
Jako admin chcę widzieć status subskrypcji, zużycie kredytów i sygnały nadużyć, żebym obsługiwać refundy i fair use.

**Kryteria akceptacji:**

- `/admin/*` nadal tylko dla `admin`.
- Widoki (choćby proste tabele): użytkownik, `app_role`, status subskrypcji, zużycie pul AI, ostatnie joby importu URL/obraz.
- Flagi nadużyć: nietypowa częstotliwość importu, błędy scrapowania, wiele kont pod ten sam płatnik (minimum: ręczne notatki + lista eventów).
- Akcje: nadaj/odbierz Premium, zarejestruj refund (spójnie z PREM-006).
- Placeholder dashboardu MVP zostaje zastąpiony lub uzupełniony tymi kartami — nie pustymi „Wkrótce” dla tych pozycji.

---

### PREM-027 — Kredyty za publikację UGC (publiczne przepisy)

**Zależności:** PREM-002, US-016. Priorytet średni.

**Opis:**  
Jako użytkownik Free/Premium chcę dostać dodatkowe kredyty AI za opublikowanie N przepisów publicznych, żebym karmił SEO i katalog reklamowy.

**Kryteria akceptacji:**

- Reguła konfigurowalna: np. N przepisów ze `visibility = PUBLIC` (nie soft-deleted) = M kredytów (określona pula).
- Kredyt przyznawany raz per próg, nie za każdą edycję tego samego przepisu.
- Cofnięcie na Prywatny nie pozwala na farmienie w kółko (brak ponownego grantu przy ponownej publikacji tego samego id, albo cooldown).
- Nadużycia (thin content) możliwe do oznaczenia w adminie.

---

### PREM-028 — Eksport pojedynczego przepisu (Markdown/PDF) i lock-in biblioteki

**Zależności:** US-004. Priorytet średni.

**Opis:**  
Jako zalogowany autor chcę wyeksportować **jeden** przepis, ale nie całą bibliotekę, żebym mieć kopię obiadu bez łatwego odejścia z całym zbiorem.

**Kryteria akceptacji:**

- Z widoku własnego przepisu: eksport Markdown i/lub PDF.
- Brak eksportu całej biblioteki / backupu ZIP w tym zakresie (osobna późniejsza funkcja Premium/add-on).
- Cudzych przepisów publicznych: eksport tylko w zakresie dozwolonym prawnie (domyślnie: brak masowego zgrywania katalogu).

---

### PREM-029 — Masowy import jako droższy add-on (nie w cenie Premium)

**Zależności:** PREM-017, PREM-018, PREM-016. Priorytet średni — nie pierwszy SKU.

**Opis:**  
Jako użytkownik chcę zaimportować wiele przepisów naraz za osobną opłatą, żebym przenieść dużą kolekcję bez obietnicy „nielimitowanego importu w Premium”.

**Kryteria akceptacji:**

- Premium bez tego SKU: jeden URL/obraz na operację.
- Pakiet/wyższy plan odblokowuje kolejkę wielu pozycji z twardym limitem i kredytami.
- Progress i błędy per pozycja; częściowy sukces nie ukrywa nieudanych wierszy.

---

## Faza 5 — Świadomie później (nie przed przychodem)

Poniższe **nie** wchodzą w pierwszy SKU. Zapisane, żeby nie wracały jako „w cenie Premium” bez decyzji.

| ID | Tytuł | Uwaga |
|---|---|---|
| PREM-030 | Eksport całej biblioteki i kopia zapasowa | Po starcie przychodu; osobna wartość / wyższy plan. |
| PREM-031 | Wykrywanie duplikatów i wersjonowanie | Po imporcie URL, gdy będzie baza do porównań. |
| PREM-032 | Propozycje posiłków, zamienniki AI, wyszukiwanie zaawansowane | Koszt LLM; nie obietnica startowa. |
| PREM-033 | Wartości odżywcze | Osobny droższy moduł, tylko przy popycie. |
| PREM-034 | Komentarze, oceny, znajomi, spiżarnia, marketplace | Poza modelem v02 na etapie pierwszej złotówki. |

---

## Kolejność implementacji (skrót dla sprintów)

1. **PREM-001 → PREM-002** — bez tego nie da się uczciwie sprzedać AI.
2. **PREM-004 → PREM-005 → PREM-006 → PREM-007** — pierwsza złotówka i zgodność B2C.
3. **PREM-008, PREM-009, PREM-010, PREM-003** — spięcie tego, co już jest w produkcie (US-036, US-037, plan, Storage).
4. **PREM-011, PREM-012, PREM-013** — konwersja SEO → konto (równolegle z checkoutem).
5. **PREM-015, PREM-016, PREM-017, PREM-018** — haczyk Premium (URL + obraz); do czasu 017 sprzedawać asystę i zdjęcia AI.
6. **PREM-019, PREM-020, PREM-021, PREM-022, PREM-023** — codziennie gotowanie = retencja.
7. **PREM-014** — reklamy dopiero przy ruchu.
8. **PREM-024, PREM-025, PREM-026** — lifecycle, rodzina, operacje.
9. **PREM-027–PREM-029** — średni priorytet.
10. **PREM-030+** — nie przed przychodem.

Mapowanie na istniejące API MVP:

| Nowe zachowanie | Istniejący punkt zaczepienia |
|---|---|
| Gating AI | `POST /ai/recipes/draft`, `POST /ai/recipes/image` |
| Rola po płatności | JWT `app_role`, `GET /me` |
| Plan Free vs Premium | `POST /plan/recipes` (limit 50 dziś) |
| Storage | `POST /recipes/{id}/image` |
| Import Markdown bez opłat | `POST /recipes/import` |
| Admin | `GET /admin/summary` → rozbudowa |
| Katalog / SEO | `GET /public/recipes`, `/explore` |
