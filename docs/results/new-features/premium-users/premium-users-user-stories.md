# User Stories: Premium Users

## Wprowadzenie

Dokument opisuje historyjki użytkownika dla obszaru funkcjonalnego **premium-users** — modelu monetyzacji aplikacji PychaŚwiatowa opartego na subskrypcji freemium. Celem jest wdrożenie pełnej ścieżki od pierwszej złotówki (checkout, limity AI, strona cennika) przez funkcje zwiększające ARPU (import z URL/zdjęcia, planer, zakupy, konto rodzinne) aż po monetyzację katalogu publicznego (reklamy, SEO) i mechanizmy retencji (trial, lifecycle e-maile, UGC).

Historyjki są uporządkowane zgodnie z kolejnością implementacji: elementy blokujące poprzedzają zależne od nich funkcjonalności.

---

## Lista historyjek użytkownika

---

### PS-63: Strona cennika (/pricing) z ofertą Premium

**Opis:**
Jako odwiedzający aplikację (gość lub użytkownik Free), chcę zobaczyć przejrzystą stronę `/pricing` z porównaniem planów Free i Premium, aby podjąć świadomą decyzję o subskrypcji.

**Kryteria akceptacji:**
- [ ] Strona `/pricing` jest publicznie dostępna (bez logowania).
- [ ] Tabela porównawcza zawiera plany Free i Premium (miesięczny i roczny).
- [ ] Plan roczny jest wyróżniony jako domyślny/rekomendowany, z przeliczeniem na koszt miesięczny.
- [ ] Wymienione są korzyści Premium: import URL/zdjęcie, planer, zaawansowane zakupy, brak reklam, pula AI, konto rodzinne.
- [ ] Widoczne są ramy cenowe (orientacyjne PLN B2C) oraz informacja o 7-dniowym trialu.
- [ ] CTA „Wybierz Premium" przekierowuje zalogowanego użytkownika do checkoutu, a niezalogowanego — do rejestracji.
- [ ] Strona zawiera link do regulaminu subskrypcji.
- [ ] Strona jest responsywna (desktop-first, mobile-friendly).

**Zależności:** brak

---

### PS-64: Model danych i egzekwowanie limitów kredytów AI

**Opis:**
Jako system, chcę przechowywać i egzekwować limity kredytów AI per użytkownik, aby kontrolować koszty infrastruktury i umożliwić model freemium (1–3 udane importy lifetime dla Free, miesięczna pula dla Premium).

**Kryteria akceptacji:**
- [ ] Nowa tabela lub kolumny w bazie danych przechowują: liczbę dostępnych kredytów AI (draft, obraz), zużyte kredyty, datę ostatniego resetu (Premium), typ limitu (lifetime dla Free, miesięczny dla Premium).
- [ ] Endpoint `/ai/recipes/draft` i `/ai/recipes/image` weryfikują stan kredytów przed wykonaniem wywołania AI.
- [ ] Przy braku kredytów zwracany jest status `402 Payment Required` z kodem błędu `AI_CREDITS_EXHAUSTED`.
- [ ] Zużycie kredytu jest odejmowane wyłącznie po pomyślnym zakończeniu wywołania AI (liczy się udany import).
- [ ] Worker normalizacji składników NIE zużywa puli kredytów UI (osobna pula wewnętrzna).
- [ ] Dla użytkownika Premium: kredyty odnawiają się miesięcznie w dacie pierwszej płatności.
- [ ] RLS oraz polityki Supabase chronią dane kredytów przed odczytem/modyfikacją przez innych użytkowników.

**Zależności:** brak

---

### PS-65: Egzekwowanie limitów planu dla użytkownika Free

**Opis:**
Jako użytkownik Free, chcę wiedzieć, jaki limit pozycji w „Moim planie" mam do dyspozycji, aby rozumieć, kiedy potrzebuję konta Premium.

**Kryteria akceptacji:**
- [ ] Użytkownicy Free mają limit planu wynoszący 7–14 pozycji (konfigurowalne przez zmienną środowiskową).
- [ ] Endpoint `POST /plan/recipes` zwraca `422` z kodem `PLAN_LIMIT_EXCEEDED_FREE` gdy Free user przekroczy swój limit.
- [ ] Odpowiedź zawiera informację o dostępnym limicie Premium (50 pozycji) i link do `/pricing`.
- [ ] Użytkownicy Premium zachowują dotychczasowy limit 50 pozycji.
- [ ] Różnica limitów jest widoczna na stronie `/pricing`.

**Zależności:**
- Wymaga: PS-63

---

### PS-66: Checkout i płatności (subskrypcja Premium)

**Opis:**
Jako zalogowany użytkownik Free, chcę zakupić subskrypcję Premium przez bezpieczny checkout, aby uzyskać dostęp do zaawansowanych funkcji aplikacji.

**Kryteria akceptacji:**
- [ ] Strona checkoutu jest dostępna pod `/checkout` lub jako modal (auth required).
- [ ] Obsługiwane są metody płatności: BLIK oraz karta (PayU lub odpowiednik).
- [ ] Domyślnie wybrany jest plan roczny (z możliwością przełączenia na miesięczny).
- [ ] Po pomyślnej płatności webhook dostawcy płatności aktualizuje `app_role` na `premium` w `auth.users.raw_app_meta_data` oraz zapisuje dane subskrypcji (data startu, data następnej płatności, ID transakcji).
- [ ] Użytkownik otrzymuje potwierdzenie zakupu na e-mail.
- [ ] Faktura/paragon jest generowany i dostępny dla użytkownika.
- [ ] W przypadku błędu płatności użytkownik widzi czytelny komunikat i może ponowić próbę.
- [ ] Checkout nie jest dostępny dla gości (redirect do rejestracji/logowania).
- [ ] Obsługiwany jest scenariusz zakupu, gdy użytkownik ma aktywny trial.

**Zależności:**
- Wymaga: PS-63
- Wymaga: PS-64

---

### PS-67: Zarządzanie subskrypcją (aktywacja, odnowienie, anulowanie)

**Opis:**
Jako użytkownik Premium, chcę zarządzać swoją subskrypcją (przeglądać status, anulować, zobaczyć datę odnowienia), aby mieć pełną kontrolę nad płatnościami.

**Kryteria akceptacji:**
- [ ] W ustawieniach konta (`/settings`) widoczna jest sekcja „Subskrypcja" ze statusem (aktywna/anulowana/trial), datą następnej płatności oraz planem.
- [ ] Użytkownik może anulować subskrypcję — dostęp Premium obowiązuje do końca opłaconego okresu.
- [ ] Po anulowaniu rola wraca do `user` dopiero po wygaśnięciu okresu.
- [ ] Automatyczne odnowienie: webhook aktualizuje datę następnej płatności i utrzymuje rolę `premium`.
- [ ] W przypadku nieudanej płatności przy odnowieniu użytkownik dostaje e-mail z prośbą o aktualizację metody płatności i ma grace period (np. 3 dni).
- [ ] Po wygaśnięciu grace period rola zmienia się na `user`, a użytkownik otrzymuje e-mail winback.
- [ ] JWT docelowego użytkownika odzwierciedla aktualną rolę po ponownym zalogowaniu lub po force-refresh sesji.

**Zależności:**
- Wymaga: PS-66

---

### PS-68: Trial 7-dniowy z limitem AI

**Opis:**
Jako nowy użytkownik, chcę przetestować Premium przez 7 dni z ograniczoną pulą AI, aby ocenić wartość subskrypcji przed zakupem.

**Kryteria akceptacji:**
- [ ] Nowy użytkownik (lub Free user aktywujący trial) może jednorazowo uruchomić 7-dniowy trial Premium.
- [ ] Podczas trialu użytkownik ma rolę `premium` z odrębną, ograniczoną pulą kredytów AI (mniejszą niż pełne Premium).
- [ ] Trial wymaga podania metody płatności przy aktywacji, ale nie pobiera opłaty przed upływem 7 dni.
- [ ] W UI widoczna jest informacja o czasie pozostałym do końca trialu i monit konwersji.
- [ ] Po zakończeniu trialu bez konwersji rola wraca do `user`, a dane puli AI trialu wygasają.
- [ ] Trial można aktywować wyłącznie raz na konto.
- [ ] W checkoucie widoczna jest informacja o trialu jako etap przed pełną płatnością.

**Zależności:**
- Wymaga: PS-66
- Wymaga: PS-64

---

### PS-69: Komunikaty paywall i upgrade w UI (momenty bólu)

**Opis:**
Jako użytkownik Free, chcę widzieć kontekstualne komunikaty o możliwości przejścia na Premium w momentach, gdy osiągam limity, aby naturalnie trafiać do oferty.

**Kryteria akceptacji:**
- [ ] Przy ~70–80% zużycia puli kredytów AI pojawia się nieinwazyjny baner/snackbar z informacją o zbliżającym się limicie i linkiem do `/pricing`.
- [ ] Po wyczerpaniu kredytów AI wyświetlany jest modal z korzyściami Premium i CTA checkout, zamiast pustego błędu.
- [ ] Przy próbie importu z URL (PS-76) przez Free usera pokazywany jest ekran upgrade z opisem korzyści.
- [ ] Przy próbie importu ze zdjęcia/skanu (PS-77) przez Free usera pokazywany jest ekran upgrade.
- [ ] Przy przekroczeniu limitu planu (PS-65) pokazywany jest komunikat z linkiem do `/pricing`.
- [ ] Komunikaty są spójne wizualnie z Angular Material i nie przerywają pracy agresywnie.
- [ ] Zalogowany Premium user nigdy nie widzi komunikatów upgrade.

**Zależności:**
- Wymaga: PS-64
- Wymaga: PS-65
- Wymaga: PS-63

---

### PS-70: Ekran wykorzystania kredytów AI i przestrzeni

**Opis:**
Jako zalogowany użytkownik (Free lub Premium), chcę widzieć aktualne zużycie kredytów AI i przestrzeni na zdjęcia, aby świadomie zarządzać limitami.

**Kryteria akceptacji:**
- [ ] W ustawieniach konta (`/settings`) dostępna jest sekcja „Użycie" z paskami postępu kredytów AI (draft, obraz) i przestrzeni zdjęć.
- [ ] Dla Free: widoczna jest liczba zużytych i dostępnych kredytów lifetime oraz zbliżanie się do limitu przestrzeni.
- [ ] Dla Premium: widoczne jest zużycie miesięczne, data resetu oraz limit przestrzeni.
- [ ] Dane są pobierane z backendu w czasie rzeczywistym (nie cache'owane dłużej niż 5 minut).
- [ ] Link „Dokup kredyty" (PS-80) lub „Przejdź na Premium" jest widoczny kontekstowo.

**Zależności:**
- Wymaga: PS-64

---

### PS-71: Strony prawne subskrypcji

**Opis:**
Jako użytkownik lub gość, chcę mieć dostęp do regulaminu subskrypcji, polityki zwrotów i prawa odstąpienia, aby być świadomym swoich praw przed zakupem Premium.

**Kryteria akceptacji:**
- [ ] Dostępne są strony: `/legal/subscription-terms` (regulamin subskrypcji), `/legal/refund-policy` (polityka zwrotów), `/legal/withdrawal-rights` (prawo odstąpienia B2C PL/UE).
- [ ] Treść stron jest renderowana z dokumentów Markdown (analogicznie do istniejących `/legal/terms`, `/legal/privacy`).
- [ ] Linki do nowych stron prawnych są widoczne w stopce oraz na stronie `/pricing` i w checkoucie.
- [ ] Strony są publicznie dostępne (bez logowania).
- [ ] Treść dokumentów jest zsynchronizowana z plikami w `src/assets/legal/`.

**Zależności:**
- Wymaga: PS-63

---

### PS-72: Maile transakcyjne i lifecycle

**Opis:**
Jako użytkownik, chcę otrzymywać automatyczne e-maile związane z subskrypcją i aktywnością konta (koniec trialu, koniec kredytów, winback), aby być informowanym i powracać do aplikacji.

**Kryteria akceptacji:**
- [ ] Zaimplementowane są szablony i wysyłka e-maili dla scenariuszy: potwierdzenie zakupu, faktura, zbliżający się koniec trialu (24h przed), koniec trialu bez konwersji (winback), wyczerpanie puli AI, nieudana płatność odnowienia (grace period), anulowanie subskrypcji, pomyślne odnowienie.
- [ ] E-maile zawierają CTA prowadzące do odpowiednich sekcji aplikacji (checkout, `/settings`, `/pricing`).
- [ ] Wysyłka odbywa się przez Supabase (lub dedykowanego dostawcę e-mail) z Edge Function.
- [ ] Użytkownik może wypisać się z e-maili marketingowych (zgodnie z istniejącą zgodą marketingową), ale nie z e-maili transakcyjnych.
- [ ] Każdy typ e-maila ma unikalny identyfikator szablonu wersjonowany w `docs/`.

**Zależności:**
- Wymaga: PS-67
- Wymaga: PS-68

---

### PS-73: Rozszerzenie panelu admina — subskrypcje, AI i nadużycia

**Opis:**
Jako administrator, chcę mieć rozszerzony panel admina z podglądem subskrypcji użytkowników, zużycia AI i zgłoszeń nadużyć, aby zarządzać przychodem i ochroną marży.

**Kryteria akceptacji:**
- [ ] W panelu `/admin/users` do tabeli dodane są kolumny: rola, status subskrypcji (Free/Trial/Premium), data następnej płatności, zużycie kredytów AI w bieżącym miesiącu.
- [ ] Nowa podstrona `/admin/subscriptions` (lub karta w dashboardzie) pokazuje metryki: liczba aktywnych subskrypcji (miesięczne/roczne), liczba triali, churn w ostatnich 30 dniach.
- [ ] Administrator może ręcznie zmienić status subskrypcji użytkownika (refund/anulowanie) z logu powodu.
- [ ] W panelu `/admin/users` widoczna jest flaga nadużycia (przekroczenie fair-use) z możliwością zablokowania konta.
- [ ] Dostęp do rozszerzeń chroni `adminRoleMatchGuard` (brak zmian w istniejących guardach).
- [ ] Audit log zmian statusu subskrypcji jest przechowywany w bazie danych.

**Zależności:**
- Wymaga: PS-67
- Wymaga: PS-64

---

### PS-74: Reklamy i afiliacja na stronach publicznych

**Opis:**
Jako administrator produktu, chcę móc wyświetlać reklamy i linki afiliacyjne (sprzęt, termorobot, grill) na stronach publicznych dla gości i użytkowników Free, aby generować przychód niezależnie od subskrypcji.

**Kryteria akceptacji:**
- [ ] Na stronach `/`, `/explore` i stronach SEO kategorii (PS-75) widoczne są dyskretne bloki reklamowe/afiliacyjne dla gości i użytkowników Free.
- [ ] Użytkownicy Premium nie widzą reklam na żadnej stronie aplikacji.
- [ ] Reklamy NIE są wyświetlane w treści przepisu w sposób obniżający czytelność (tylko na landing, `/explore` i stronach SEO).
- [ ] Mechanizm wyświetlania/ukrywania reklam oparty jest na roli JWT (`user`/`premium`/`admin` = brak reklam dla Premium i Admin).
- [ ] Integracja z systemem reklamowym (np. Google AdSense lub własne banery) jest konfigurowana przez zmienne środowiskowe bez zmiany kodu komponentów.
- [ ] Clickio Consent Manager blokuje reklamy do czasu wyrażenia zgody na cookies.

**Zależności:**
- Wymaga: PS-67 (weryfikacja roli Premium)

---

### PS-75: Publiczne strony SEO kategorii i nisz

**Opis:**
Jako gość lub użytkownik, chcę trafić do katalogu przepisów przez wyszukiwarki (np. „przepisy termorobot", „kuchnia włoska"), aby odkrywać zawartość aplikacji i zwiększać ruch organiczny.

**Kryteria akceptacji:**
- [ ] Dostępne są kanoniczne strony SEO: `/explore/kuchnia/:cuisine`, `/explore/dieta/:diet`, `/explore/termorobot`, `/explore/grill`.
- [ ] Każda strona zawiera listę publicznych przepisów z danej kategorii/niszy z paginacją (load more 12).
- [ ] Strony mają unikalny `<title>`, `<meta description>` i kanoniczny URL.
- [ ] Dane są renderowane po stronie serwera lub pre-renderowane (SSR/prerender) w celu indeksowalności przez Google.
- [ ] Na stronach SEO dla gości i Free widoczne są bloki afiliacyjne (nieinwazyjne, po treści przepisów).
- [ ] Linki do stron SEO są obecne na `/explore` i landingu jako nawigacja tematyczna.

**Zależności:** brak (niezależna funkcjonalność SEO)

---

### PS-76: Import przepisu z URL (Premium)

**Opis:**
Jako użytkownik Premium, chcę wkleić URL strony z przepisem, aby aplikacja automatycznie wypełniła formularz przepisu, oszczędzając mi czas na ręczne przepisywanie.

**Kryteria akceptacji:**
- [ ] W kreatorze przepisu (`/recipes/new/start`) dostępna jest opcja „Importuj z linku" dla Premium i Admin.
- [ ] Użytkownik wkleja URL — backend pobiera stronę, parsuje przepis przez LLM i zwraca wypełniony formularz (jak `/ai/recipes/draft` dla tekstu).
- [ ] Obsługiwane są popularne formaty przepisów (schema.org `Recipe`, popularni wydawcy).
- [ ] Każdy pomyślny import z URL zużywa 1 kredyt AI (typ: `import-url`).
- [ ] Przy braku kredytów wyświetlany jest modal upgrade/dokupienia kredytów (PS-69).
- [ ] Użytkownicy Free, którzy próbują skorzystać z funkcji, widzą ekran upgrade.
- [ ] W przypadku niedostępności URL lub błędu parsowania wyświetlany jest czytelny komunikat błędu.
- [ ] Trasa jest chroniona przez `premiumRoleMatchGuard` analogicznie do `/recipes/new/assist`.

**Zależności:**
- Wymaga: PS-64 (kredyty AI)
- Wymaga: PS-69 (paywall w UI)
- Wymaga: PS-66 (checkout / rola premium)

---

### PS-77: Import przepisu ze zdjęcia, zrzutu ekranu i skanu (Premium)

**Opis:**
Jako użytkownik Premium, chcę wgrać zdjęcie lub skan strony z przepisem, aby aplikacja automatycznie rozpoznała i wypełniła formularz przepisu.

**Kryteria akceptacji:**
- [ ] W kreatorze przepisu dostępna jest opcja „Importuj ze zdjęcia/skanu" dla Premium i Admin.
- [ ] Obsługiwane formaty: JPG, PNG, WebP, PDF (jednorazowa strona).
- [ ] Backend wysyła obraz do LLM (multimodal) i zwraca wypełniony formularz.
- [ ] Każdy pomyślny import ze zdjęcia/skanu zużywa 1 kredyt AI (typ: `import-image`, droższy niż `import-url`).
- [ ] Przy nieczytelnym lub błędnym obrazie wyświetlany jest czytelny komunikat błędu z możliwością ponowienia.
- [ ] Użytkownicy Free widzą ekran upgrade.
- [ ] Plik jest tymczasowo przechowywany w Supabase Storage (usuwany po parsowaniu lub po 24h).
- [ ] Maksymalny rozmiar pliku wejściowego: 20 MB.

**Zależności:**
- Wymaga: PS-64 (kredyty AI)
- Wymaga: PS-69 (paywall w UI)
- Wymaga: PS-66

---

### PS-78: Asystowane porządkowanie importowanej treści w ramach kredytów

**Opis:**
Jako użytkownik Premium, po imporcie z URL/zdjęcia chcę, aby asystent AI zaproponował uporządkowanie składników, kroków i wskazówek, aby wynikowy przepis był spójny i gotowy do zapisania.

**Kryteria akceptacji:**
- [ ] Po imporcie URL/zdjęcia formularz przepisu wyświetla wynik parsowania z możliwością uruchomienia „Porządkowania AI".
- [ ] „Porządkowanie" wywołuje LLM w celu: normalizacji jednostek składników, weryfikacji kolejności kroków, wyodrębnienia wskazówek.
- [ ] Akcja kosztuje 1 kredyt AI (typ: `assist-cleanup`) i jest dostępna wyłącznie dla Premium/Admin.
- [ ] Wynik jest prezentowany jako propozycja do zaakceptowania lub odrzucenia przez użytkownika.
- [ ] Użytkownik może edytować wynik przed zapisem.

**Zależności:**
- Wymaga: PS-76 lub PS-77 (import poprzedzający)
- Wymaga: PS-64 (kredyty AI)

---

### PS-79: Sugestie metadanych przepisu generowane przez AI (Premium)

**Opis:**
Jako użytkownik Premium tworzący lub edytujący przepis, chcę otrzymać sugestie kategorii, tagów, kuchni, diety i trudności generowane przez AI, aby szybciej i spójniej klasyfikować przepisy.

**Kryteria akceptacji:**
- [ ] W formularzu przepisu dla Premium/Admin dostępny jest przycisk „Zasugeruj metadane AI".
- [ ] Akcja wysyła nazwę, opis i składniki przepisu do LLM i zwraca propozycje: kategorii, tagów (maks. 5), kuchni, diety, trudności.
- [ ] Sugestie są wyświetlane obok odpowiednich pól formularza jako chipy do zaakceptowania/odrzucenia.
- [ ] Każde wywołanie sugestii metadanych zużywa 1 kredyt AI (typ: `metadata-suggest`).
- [ ] Wynik nie jest automatycznie zapisywany — użytkownik zatwierdza każdą sugestię oddzielnie.
- [ ] Użytkownicy Free nie widzą przycisku (lub widzą z zamkniętą ikoną Premium).

**Zależności:**
- Wymaga: PS-64 (kredyty AI)
- Wymaga: PS-66

---

### PS-80: Automatyczne przeliczanie porcji i składników (Premium)

**Opis:**
Jako użytkownik Premium przeglądający przepis, chcę zmienić liczbę porcji i zobaczyć automatycznie przeliczone ilości składników, aby łatwo dostosować przepis do swoich potrzeb.

**Kryteria akceptacji:**
- [ ] Na widoku szczegółów przepisu (`/recipes/:id-:slug`) dla Premium/Admin widoczna jest kontrolka zmiany liczby porcji (spinner lub slider).
- [ ] Zmiana porcji przelicza ilości składników w czasie rzeczywistym na frontendzie (bez wywołania API).
- [ ] Przeliczanie dotyczy wyłącznie składników z typem `item` zawierających ilość liczbową.
- [ ] Składniki z niejednoznaczną ilością (np. „do smaku", „szczypta") są pozostawiane bez zmian.
- [ ] Oryginalny przepis i jego składniki nie są modyfikowane w bazie danych.
- [ ] Funkcja jest widoczna i aktywna wyłącznie dla Premium/Admin; dla Free pole porcji jest tylko do odczytu z ikoną Premium.

**Zależności:**
- Wymaga: PS-66

---

### PS-81: Historia szkiców AI i powrót do szkicu (Premium)

**Opis:**
Jako użytkownik Premium, chcę zobaczyć historię moich poprzednich importów i asyst AI, aby wrócić do niedokończonego szkicu przepisu bez ponownego zużycia kredytów.

**Kryteria akceptacji:**
- [ ] Wyniki wywołań AI (draft, import URL, import zdjęcia) są zapisywane jako szkice powiązane z kontem użytkownika (tabela `ai_drafts` lub kolumna w tabeli `recipes`).
- [ ] Strona `/recipes/drafts` (lub zakładka w kreatorze) wyświetla listę ostatnich 20 szkiców (nazwa tymczasowa, data, typ).
- [ ] Użytkownik może otworzyć szkic i kontynuować edycję w formularzu bez ponownego zużycia kredytów.
- [ ] Szkice są automatycznie usuwane po 30 dniach od utworzenia.
- [ ] Funkcja jest dostępna wyłącznie dla Premium/Admin.
- [ ] Zapisanie szkicu jako pełnoprawny przepis usuwa go z listy szkiców.

**Zależności:**
- Wymaga: PS-64 (kredyty AI)
- Wymaga: PS-66

---

### PS-82: Wyższy priorytet jobów AI i normalizacji dla użytkowników Premium

**Opis:**
Jako użytkownik Premium, chcę, aby moje joby normalizacji składników i asysty AI były przetwarzane priorytetowo, aby nie czekać w kolejce za użytkownikami Free.

**Kryteria akceptacji:**
- [ ] Tabela `normalized_ingredients_jobs` i wewnętrzna kolejka jobów AI posiadają kolumnę `priority` (np. `high`/`normal`).
- [ ] Przy tworzeniu joba normalizacji dla użytkownika Premium ustawiana jest wartość `priority = 'high'`.
- [ ] Worker (`/internal/workers/normalized-ingredients/run`) przetwarza najpierw joby o wysokim priorytecie.
- [ ] Różnica czasu przetwarzania między Free a Premium jest mierzalna (metryka w adminie: PS-73).
- [ ] Zmiana priorytetu nie wymaga żadnej akcji ze strony użytkownika.

**Zależności:**
- Wymaga: PS-66 (rola Premium)
- Wymaga: PS-67 (zarządzanie subskrypcją)

---

### PS-83: Zaawansowana lista zakupów (scalanie, grupy, lepsze jednostki) — Premium

**Opis:**
Jako użytkownik Premium, chcę aby lista zakupów automatycznie scalała te same składniki z różnych przepisów i grupowała je po kategorii produktu, abym mógł sprawniej robić zakupy.

**Kryteria akceptacji:**
- [ ] Dla Premium: lista zakupów wyświetla składniki po scaleniu i normalizacji jednostek (np. „200 g + 300 g masła" → „500 g masła").
- [ ] Scalanie odbywa się z użyciem znormalizowanych składników (`recipe_normalized_ingredients`) i jest dostępne wyłącznie dla Premium/Admin.
- [ ] Składniki są opcjonalnie grupowane po kategorii sklepowej (np. nabiał, warzywa, mięso) w oparciu o etykietę z AI lub manualną klasyfikację.
- [ ] Użytkownicy Free widzą dotychczasową listę z grupowaniem frontendowym po `(nazwa, jednostka)` bez scalania jednostek.
- [ ] W widoku listy zakupów Premium dostępny jest toggle „Widok scalony/surowy".

**Zależności:**
- Wymaga: PS-66
- Wymaga: PS-64 (normalizacja składników musi być dostępna)

---

### PS-84: Planer tygodniowy z listą zakupów z planu (Premium)

**Opis:**
Jako użytkownik Premium, chcę zaplanować posiłki na cały tydzień i automatycznie wygenerować listę zakupów z planera, aby wygodnie organizować cotygodniowe gotowanie.

**Kryteria akceptacji:**
- [ ] Dostępna jest strona `/planner` (auth required, Premium/Admin).
- [ ] Planer wyświetla siatkę 7 dni × 3 posiłków (lub konfigurowalnie) z możliwością przypisania przepisu do każdego slotu.
- [ ] Przepisy można dodawać do planera z widoku listy przepisów, szczegółów przepisu lub przez wyszukiwanie inline w planerze.
- [ ] Przycisk „Generuj listę zakupów" tworzy lub uzupełnia listę zakupów (`/shopping-list`) na podstawie przepisów z planera.
- [ ] Planer jest trwały — zapisywany w bazie danych (nowa tabela `weekly_plan` lub rozszerzenie `plan_recipes`).
- [ ] Użytkownicy Free nie mają dostępu do planera (redirect do upgrade page).
- [ ] Planer jest dostępny na urządzeniach mobilnych z responsywnym układem.

**Zależności:**
- Wymaga: PS-83 (zaawansowana lista zakupów)
- Wymaga: PS-66

---

### PS-85: Konto rodzinne (właściciel + współdomownicy, wspólna lista zakupów)

**Opis:**
Jako użytkownik Premium, chcę zaprosić członków rodziny do współdzielonego konta domowego, aby razem korzystać z listy zakupów i planera tygodniowego.

**Kryteria akceptacji:**
- [ ] Właściciel konta Premium może zaprosić do N współdomowników (e-mailem) pod `/settings/family`.
- [ ] Zaproszeni użytkownicy (posiadający konto lub nowi) otrzymują e-mail z linkiem do dołączenia.
- [ ] Współdomownicy mają dostęp do: wspólnej listy zakupów, planera tygodniowego i kolekcji współdzielonych przez właściciela.
- [ ] Współdomownicy NIE mają dostępu do prywatnych przepisów właściciela (chyba że zmienił widoczność na „Współdzielony").
- [ ] Właściciel może usunąć współdomownika; usunięty użytkownik traci dostęp do współdzielonych zasobów.
- [ ] Konto rodzinne jest dostępne wyłącznie dla użytkownika Premium (właściciel płaci, współdomownicy korzystają bez własnej subskrypcji — do ustalonej liczby).
- [ ] Nowe tabele: `family_groups`, `family_members` z odpowiednim RLS.

**Zależności:**
- Wymaga: PS-67 (zarządzanie subskrypcją — tylko aktywny Premium może zaprosić)
- Wymaga: PS-84 (planer tygodniowy jako główna korzyść konta rodzinnego)

---

### PS-86: Pakiety kredytów AI (add-on dla Free i Premium)

**Opis:**
Jako użytkownik Free lub Premium, który wyczerpał pulę AI, chcę jednorazowo dokupić pakiet kredytów AI, aby korzystać z importu i asysty bez zmiany planu subskrypcji.

**Kryteria akceptacji:**
- [ ] Dostępne są do zakupu pakiety kredytów AI w różnych rozmiarach (np. S/M/L) z różną ceną.
- [ ] Checkout pakietu kredytów używa tego samego mechanizmu płatności co subskrypcja (PS-66).
- [ ] Zakupione kredyty są dodawane do salda konta niezwłocznie po potwierdzeniu płatności.
- [ ] Kredyty z pakietu są ważne przez 12 miesięcy od zakupu.
- [ ] W ekranie zużycia (PS-70) widoczne jest oddzielne saldo: kredyty z subskrypcji i kredyty z pakietów.
- [ ] Strona `/pricing` wymienia pakiety kredytów jako opcję uzupełnienia poza subskrypcją.

**Zależności:**
- Wymaga: PS-66 (checkout)
- Wymaga: PS-64 (model kredytów)
- Wymaga: PS-63 (strona cennika)

---

### PS-87: Eksport przepisu i całej biblioteki

**Opis:**
Jako zalogowany użytkownik, chcę wyeksportować pojedynczy przepis do Markdown lub PDF, a jako użytkownik Premium — wyeksportować całą bibliotekę, aby mieć kopię zapasową swoich danych.

**Kryteria akceptacji:**
- [ ] Wszyscy zalogowani użytkownicy mogą wyeksportować pojedynczy przepis do formatu Markdown (przycisk w widoku szczegółów).
- [ ] Użytkownicy Premium mogą wyeksportować całą bibliotekę przepisów jako archiwum ZIP zawierające pliki Markdown (jeden plik na przepis) z widoku `/settings`.
- [ ] Eksport biblioteki zawiera zdjęcia przepisów (linki do Storage lub osadzone base64 — konfigurowalnie).
- [ ] Eksport biblioteki jest asynchroniczny: użytkownik otrzymuje e-mail z linkiem do pobrania po przygotowaniu archiwum.
- [ ] Użytkownicy Free widzą opcję eksportu biblioteki z ikoną Premium i linkiem do upgrade.

**Zależności:**
- Wymaga: PS-66 (dostęp Premium do eksportu biblioteki)

---

### PS-88: Wykrywanie duplikatów przepisów

**Opis:**
Jako użytkownik, chcę być informowany o potencjalnych duplikatach podczas dodawania lub importowania przepisu, aby uniknąć wielokrotnego przechowywania tego samego przepisu.

**Kryteria akceptacji:**
- [ ] Przy zapisie nowego przepisu (POST `/recipes`) backend sprawdza podobieństwo nazwy i listy składników względem istniejących przepisów użytkownika (fuzzy match lub `search_vector`).
- [ ] Jeśli wykryto potencjalny duplikat, użytkownik widzi nieinwazyjny alert z linkiem do podobnego przepisu i może kontynuować zapis lub anulować.
- [ ] Sprawdzenie duplikatów nie blokuje zapisu — jest wyłącznie informacyjne.
- [ ] Funkcja działa dla wszystkich zalogowanych użytkowników (Free i Premium).
- [ ] Próg podobieństwa jest konfigurowalny po stronie backendu.

**Zależności:** brak (niezależna funkcjonalność bezpieczeństwa danych)

---

### PS-89: Masowy import jako droższy add-on / wyższy plan

**Opis:**
Jako użytkownik Premium chcący przenieść dużą kolekcję przepisów (dziesiątki na raz), chcę skorzystać z masowego importu jako osobnego pakietu, aby nie blokować standardowej puli kredytów.

**Kryteria akceptacji:**
- [ ] Dostępna jest opcja „Masowy import" pod `/recipes/bulk-import` — wyłącznie dla posiadaczy aktywnego pakietu masowego importu lub wyższego planu.
- [ ] Użytkownik może wgrać plik CSV lub ZIP z plikami Markdown (do N przepisów na raz, N konfigurowalnie).
- [ ] Każdy przepis z pliku jest parsowany i kolejkowany jako osobny job importu — zużywa kredyty z pakietu masowego importu (nie z puli standardowej).
- [ ] Użytkownik widzi postęp importu (liczba przetworzonych / wszystkich) i może anulować.
- [ ] W przypadku błędów parsowania (np. nieprawidłowy format) wyświetlana jest lista przepisów z błędami do ręcznej korekty.
- [ ] Opcja nie jest dostępna w podstawowym planie Premium — wymaga dokupienia pakietu masowego importu.

**Zależności:**
- Wymaga: PS-86 (pakiety add-on)
- Wymaga: PS-77 (import ze zdjęcia — wspólna infrastruktura parsowania)

---

### PS-90: Zachęty UGC — dodatkowe kredyty za publikację przepisów

**Opis:**
Jako użytkownik Free lub Premium, chcę otrzymywać dodatkowe kredyty AI za opublikowanie przepisów z widocznością Publiczny, aby mieć motywację do dzielenia się treścią napędzającą SEO aplikacji.

**Kryteria akceptacji:**
- [ ] Użytkownik otrzymuje bonus kredytów AI (typ: `ugc-reward`, nieprzenoszalny) po osiągnięciu progu opublikowanych publicznych przepisów (np. co 5 przepisów).
- [ ] Bonus jest jednorazowy per próg (nie kumuluje się za każdy przepis).
- [ ] Powiadomienie o przyznaniu kredytów pojawia się jako snackbar oraz w ekranie zużycia (PS-70).
- [ ] Zasady programu UGC są opisane na stronie `/pricing` i w ustawieniach konta.
- [ ] Kredyty UGC nie zastępują, ale uzupełniają pulę standardową i pakiety.
- [ ] Administrator może wyłączyć program UGC przez zmienną środowiskową (np. w razie nadużyć).

**Zależności:**
- Wymaga: PS-64 (model kredytów)
- Wymaga: PS-70 (ekran zużycia)

---

## Podsumowanie zależności

Poniżej przedstawiono graf zależności pomiędzy historyjkami w kolejności implementacji:

| Historyjka | Zależy od |
|---|---|
| **PS-63** Strona cennika | — |
| **PS-64** Model kredytów AI | — |
| **PS-65** Limity planu Free | PS-63 |
| **PS-66** Checkout i płatności | PS-63, PS-64 |
| **PS-67** Zarządzanie subskrypcją | PS-66 |
| **PS-68** Trial 7-dniowy | PS-66, PS-64 |
| **PS-69** Komunikaty paywall w UI | PS-64, PS-65, PS-63 |
| **PS-70** Ekran zużycia kredytów | PS-64 |
| **PS-71** Strony prawne subskrypcji | PS-63 |
| **PS-72** Maile transakcyjne | PS-67, PS-68 |
| **PS-73** Rozszerzenie panelu admina | PS-67, PS-64 |
| **PS-74** Reklamy i afiliacja | PS-67 |
| **PS-75** Strony SEO kategorii | — |
| **PS-76** Import z URL | PS-64, PS-69, PS-66 |
| **PS-77** Import ze zdjęcia/skanu | PS-64, PS-69, PS-66 |
| **PS-78** Asystowane porządkowanie importu | PS-76 lub PS-77, PS-64 |
| **PS-79** Sugestie metadanych AI | PS-64, PS-66 |
| **PS-80** Przeliczanie porcji | PS-66 |
| **PS-81** Historia szkiców AI | PS-64, PS-66 |
| **PS-82** Priorytet jobów AI dla Premium | PS-66, PS-67 |
| **PS-83** Zaawansowana lista zakupów | PS-66, PS-64 |
| **PS-84** Planer tygodniowy | PS-83, PS-66 |
| **PS-85** Konto rodzinne | PS-67, PS-84 |
| **PS-86** Pakiety kredytów (add-on) | PS-66, PS-64, PS-63 |
| **PS-87** Eksport biblioteki | PS-66 |
| **PS-88** Wykrywanie duplikatów | — |
| **PS-89** Masowy import (add-on) | PS-86, PS-77 |
| **PS-90** Zachęty UGC | PS-64, PS-70 |

### Bloki implementacyjne (sugerowana kolejność sprintów)

```
Sprint 1 — Pierwsza złotówka (blokujące):
  PS-63 → PS-64 → PS-65 → PS-66 → PS-67 → PS-68 → PS-69 → PS-70 → PS-71

Sprint 2 — Operacje i komunikacja:
  PS-72 → PS-73 → PS-74 → PS-75

Sprint 3 — Import Premium (skok ARPU):
  PS-76 → PS-77 → PS-78 → PS-79 → PS-80 → PS-81 → PS-82 → PS-86

Sprint 4 — Planer, zakupy, rodzina:
  PS-83 → PS-84 → PS-85

Sprint 5 — Retencja i wzrost:
  PS-87 → PS-88 → PS-89 → PS-90
```
