# User Stories: Premium Users

## Wprowadzenie

Dokument opisuje historyjki użytkownika dla obszaru funkcjonalnego **premium-users** — modelu monetyzacji aplikacji PychaŚwiatowa opartego na subskrypcji freemium. Celem jest wdrożenie pełnej ścieżki od pierwszej złotówki (checkout, limity AI, strona cennika) przez funkcje zwiększające ARPU (import z URL/zdjęcia, planer, zakupy, konto rodzinne) aż po monetyzację katalogu publicznego (reklamy, SEO) i mechanizmy retencji (trial, lifecycle e-maile, UGC).

Historyjki są uporządkowane zgodnie z kolejnością implementacji: elementy blokujące poprzedzają zależne od nich funkcjonalności.

## Stan wdrożenia i decyzje startowe (listopad 2026)

Dokument był pisany przed implementacją PS-63–PS-66. Poniżej stan po implementacji; szczegóły decyzji: `analiza-funkcjonalnosci-premium-users.md` (sekcja 1.1), kroki uruchomienia: `premium-users-payments-launch-plan.md`.

| Historyjka | Stan w kodzie | Uwagi |
|---|---|---|
| PS-63 Cennik | zaimplementowane, niezweryfikowane | `/pricing`, `pricing.config.ts` |
| PS-64 Kredyty AI | zakończone (wg rejestru `project-summary.md`) | pule `draft` i `image` |
| PS-65 Limit planu Free | zaimplementowane, niezweryfikowane | wartość startowa **7** (wcześniej błędnie 3) |
| PS-66 Checkout Stripe | zaimplementowane, niezweryfikowane, **niewdrożone** | wymaga konfiguracji Stripe i wdrożenia (CI nie wdrażało funkcji płatności do listopada 2026) |
| PS-71 Strony prawne | zrealizowane w innej formie | jeden dokument `/legal/subscription` |
| PS-76, PS-77 Import URL / zdjęcia | zrealizowane jako PS-97 i PS-100 | w puli `draft`, dostępne też dla Free (3 próbne importy) |

**Model kredytów AI (obowiązuje wszystkie historyjki):** wdrożone są dwie pule — `draft` (każde wywołanie LLM: draft z tekstu, linku lub 1–5 zdjęć, porządkowanie, sugestie metadanych) oraz `image` (generowanie zdjęcia przepisu). „Typ” kredytu podawany w historyjkach (`import-url`, `assist-cleanup` itd.) to etykieta analityczna, a nie osobna pula. Jedno wywołanie = 1 kredyt `draft`, niezależnie od liczby zdjęć. Podział na więcej pul wymaga osobnej decyzji i zmiany modelu z PS-64.

**Zakres wersji startowej płatności:** karta (bez BLIK), bez trialu, bez własnych e-maili, anulowanie przez Stripe Customer Portal jako pierwszy krok po starcie. Historyjki PS-67, PS-68, PS-72 są odpowiednio zawężone lub odłożone (patrz ich opisy).

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
- [ ] Wymienione są korzyści Premium: pula AI (import URL/zdjęcie/tekst), generowanie zdjęć AI, limit planu 50; korzyści jeszcze niewdrożone (planer, zaawansowane zakupy, konto rodzinne, priorytet jobów AI) są oznaczone „Wkrótce” albo pominięte. Reklam jeszcze nie ma — „brak reklam” nie może być jedyną korzyścią.
- [ ] Widoczne są ceny brutto PLN (24 zł / miesiąc, 169 zł / rok, oszczędność ok. 41% przy planie rocznym). Informacja o trialu pojawia się dopiero po wdrożeniu PS-68.
- [ ] CTA „Wybierz Premium" przekierowuje zalogowanego użytkownika do checkoutu, a niezalogowanego — do rejestracji.
- [ ] Strona zawiera link do regulaminu subskrypcji (`/legal/subscription`).
- [ ] Strona jest responsywna (desktop-first, mobile-friendly).

**Zależności:** brak

---

### PS-64: Model danych i egzekwowanie limitów kredytów AI

**Opis:**
Jako system, chcę przechowywać i egzekwować limity kredytów AI per użytkownik, aby kontrolować koszty infrastruktury i umożliwić model freemium (1–3 udane importy lifetime dla Free, miesięczna pula dla Premium).

**Kryteria akceptacji:**
- [ ] Nowa tabela lub kolumny w bazie danych przechowują: liczbę dostępnych kredytów AI (draft, obraz), zużyte kredyty, datę ostatniego resetu (Premium), typ limitu (lifetime dla Free, miesięczny dla Premium).
- [ ] Endpoint `/ai/recipes/draft` (wszystkie źródła: tekst, zdjęcia, URL) i `/ai/recipes/image` weryfikują stan kredytów przed wykonaniem wywołania AI. `/ai/recipes/draft` jest dostępny także dla roli `user` (3 próbne importy), `/ai/recipes/image` wyłącznie dla `premium` i `admin`.
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
- [ ] Użytkownicy Free mają limit planu wynoszący **7 pozycji** (wartość startowa; konfigurowalna zmienną środowiskową `PLAN_LIMIT_FREE`, a wartość wyświetlana na `/pricing` musi się z nią zgadzać).
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
- [ ] Operatorem płatności jest Stripe (hosted Checkout). Obsługiwane metody: karta (subskrypcja odnawiana automatycznie) oraz BLIK (płatność jednorazowa, bez odnowienia). W wersji startowej w UI dostępna jest **tylko karta**; BLIK jest obsłużony w API i włączany po wdrożeniu przypomnień o końcu okresu.
- [ ] Domyślnie wybrany jest plan roczny (z możliwością przełączenia na miesięczny).
- [ ] Po pomyślnej płatności webhook Stripe aktualizuje `app_role` na `premium` w `auth.users.raw_app_meta_data` oraz zapisuje dane subskrypcji (data startu, data następnej płatności, ID transakcji).
- [ ] Użytkownik otrzymuje potwierdzenie zakupu na e-mail (w wersji startowej wysyła je Stripe; własny e-mail przez Resend jest zakresem PS-72).
- [ ] Faktura/potwierdzenie ze Stripe jest dostępne w `/settings` oraz w e-mailu ze Stripe. Faktury VAT na firmę (NIP) są poza wersją startową.
- [ ] W przypadku błędu płatności użytkownik widzi czytelny komunikat i może ponowić próbę.
- [ ] Checkout nie jest dostępny dla gości (redirect do rejestracji/logowania).
- [ ] API obsługuje zakup, gdy użytkownik ma status `trialing` (przygotowanie pod PS-68; scenariusz da się zweryfikować dopiero po wdrożeniu PS-68, do tego czasu jest pokryty tylko testami jednostkowymi).

**Zależności:**
- Wymaga: PS-63
- Wymaga: PS-64

---

### PS-67: Zarządzanie subskrypcją (aktywacja, odnowienie, anulowanie)

**Opis:**
Jako użytkownik Premium, chcę zarządzać swoją subskrypcją (przeglądać status, anulować, zobaczyć datę odnowienia), aby mieć pełną kontrolę nad płatnościami.

**Podział na etapy:** etap A (pierwszy krok po starcie płatności) realizuje anulowanie i zmianę karty przez **Stripe Customer Portal**; etap B (własny UI i e-maile) jest odłożony.

**Kryteria akceptacji — etap A (Customer Portal):**
- [ ] W `/settings` widoczna jest sekcja „Subskrypcja" ze statusem, datą następnej płatności (lub końca okresu) oraz planem (dane z `GET /me`).
- [ ] Przycisk „Zarządzaj subskrypcją" (tylko dla użytkownika z subskrypcją kartą) wywołuje endpoint tworzący sesję portalu Stripe i przekierowuje do portalu; adres powrotu budowany z `APP_BASE_URL`.
- [ ] W portalu użytkownik może anulować subskrypcję (dostęp Premium do końca opłaconego okresu), zmienić kartę i pobrać faktury. Zmiana planu w portalu jest wyłączona do czasu obsługi prorationów.
- [ ] Po anulowaniu nie następuje kolejne odnowienie; rola wraca do `user` po wygaśnięciu okresu i dni łaski (job `billing_expire_subscriptions`, zmienna `BILLING_EXPIRY_GRACE_DAYS`).
- [ ] Zaktualizowane są FAQ na `/pricing` i sekcja 4 regulaminu subskrypcji (anulowanie w ustawieniach).

**Kryteria akceptacji — etap B (odłożone):**
- [ ] Własny UI anulowania i statusu `canceled` oraz obsługa zdarzeń Stripe `customer.subscription.updated/deleted` i `invoice.payment_failed` (status `past_due`, grace period zamiast samego jobu czasowego).
- [ ] E-mail z prośbą o aktualizację metody płatności przy nieudanym odnowieniu oraz e-mail winback po wygaśnięciu (zakres PS-72).
- [ ] JWT użytkownika odzwierciedla aktualną rolę po ponownym zalogowaniu lub po force-refresh sesji.

> Automatyczne odnowienie kartą jest już obsługiwane w PS-66 (zdarzenie `invoice.paid` przesuwa `current_period_end`).

**Zależności:**
- Wymaga: PS-66

---

### PS-68: Trial 7-dniowy z limitem AI

**Opis:**
Jako nowy użytkownik, chcę przetestować Premium przez 7 dni z ograniczoną pulą AI, aby ocenić wartość subskrypcji przed zakupem.

**Status:** odłożone na po starcie płatności. Do czasu wdrożenia trial nie jest obiecywany nigdzie w UI ani w regulaminie (usunięte z `/pricing`, FAQ i `subscription-terms.md`; przy wdrożeniu przywrócić je spójnie: karta wymagana przy aktywacji, jeden trial na konto).

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

**Stan:** częściowo zrealizowane w PS-64 i PS-65 (wskaźnik zużycia kredytów z progiem ostrzegawczym `AI_CREDITS_WARN_THRESHOLD_PERCENT`, dialog po wyczerpaniu kredytów, dialog limitu planu). Do zrobienia: weryfikacja i ujednolicenie komunikatów oraz brakujące przypadki z listy.

**Kryteria akceptacji:**
- [ ] Przy ~70–80% zużycia puli kredytów AI pojawia się nieinwazyjny baner/snackbar z informacją o zbliżającym się limicie i linkiem do `/pricing`.
- [ ] Po wyczerpaniu kredytów AI (w dowolnym trybie: tekst, URL, zdjęcia) wyświetlany jest modal z korzyściami Premium i CTA checkout, zamiast pustego błędu.
- [ ] Przy próbie użycia funkcji dostępnej tylko dla Premium (generowanie zdjęcia AI, a po ich wdrożeniu planer i zaawansowane zakupy) Free user widzi ekran upgrade z opisem korzyści.
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

**Stan:** sekcja kredytów AI w `/settings` istnieje (PS-64, `GET /ai/credits`). Brakuje przestrzeni zdjęć — limit przestrzeni nie jest dziś egzekwowany, więc ta część wymaga najpierw decyzji o limicie (do tego czasu nie obiecywać go w ofercie).

**Kryteria akceptacji:**
- [ ] W ustawieniach konta (`/settings`) dostępna jest sekcja „Użycie" z paskami postępu kredytów AI (draft, obraz) i przestrzeni zdjęć.
- [ ] Dla Free: widoczna jest liczba zużytych i dostępnych kredytów lifetime oraz zbliżanie się do limitu przestrzeni.
- [ ] Dla Premium: widoczne jest zużycie miesięczne, data resetu oraz limit przestrzeni.
- [ ] Dane są pobierane z backendu w czasie rzeczywistym (nie cache'owane dłużej niż 5 minut).
- [ ] Link „Dokup kredyty" (PS-86) lub „Przejdź na Premium" jest widoczny kontekstowo.

**Zależności:**
- Wymaga: PS-64

---

### PS-71: Strony prawne subskrypcji

**Opis:**
Jako użytkownik lub gość, chcę mieć dostęp do regulaminu subskrypcji, polityki zwrotów i prawa odstąpienia, aby być świadomym swoich praw przed zakupem Premium.

**Stan:** zrealizowane w innej formie niż pierwotny opis (decyzja z `docs/legal-reorganisation.md`): jeden dokument `public/assets/legal/subscription-terms.md` pod trasą `/legal/subscription`, z częściami A (regulamin subskrypcji), B (polityka zwrotów) i C (prawo odstąpienia). Osobne trasy `/legal/refund-policy` i `/legal/withdrawal-rights` nie są potrzebne. Przed startem sprzedaży część C wymaga weryfikacji prawnika.

**Kryteria akceptacji:**
- [x] Regulamin subskrypcji, polityka zwrotów i prawo odstąpienia (B2C PL/UE) są dostępne pod `/legal/subscription` jako jeden dokument.
- [x] Treść jest renderowana z Markdown (`LegalPageComponent`, analogicznie do `/legal/terms`, `/legal/privacy`).
- [ ] Link do regulaminu subskrypcji jest widoczny w stopce, na `/pricing` i w checkoucie (zweryfikować w przeglądarce).
- [x] Strona jest publicznie dostępna (bez logowania).
- [x] Jedynym źródłem treści jest `public/assets/legal/` (bez duplikatów w `src/assets/legal/` i `docs/legal-documents/`).
- [ ] Prawnik zweryfikował część C i zgodność z checkoutem; placeholdery danych firmy (`\<NAZWA_FIRMY\>` itd.) uzupełnione (patrz `docs/legel-next-steps.md`).

**Zależności:**
- Wymaga: PS-63

---

### PS-72: Maile transakcyjne i lifecycle

**Opis:**
Jako użytkownik, chcę otrzymywać automatyczne e-maile związane z subskrypcją i aktywnością konta (koniec trialu, koniec kredytów, winback), aby być informowanym i powracać do aplikacji.

**Stan:** moduł `_shared/email/` (klient Resend) i szablon „Potwierdzenie zakupu” powstały w PS-66, ale w wersji startowej nie są używane (potwierdzenia i faktury wysyła Stripe, a sekretów Resend nie konfigurujemy). PS-72 włącza Resend i dodaje pozostałe scenariusze.

**Kryteria akceptacji:**
- [ ] Zaimplementowane są szablony i wysyłka e-maili dla scenariuszy: potwierdzenie zakupu (własny szablon zamiast e-maila Stripe; wtedy wyłączyć e-maile Stripe), przypomnienie o końcu okresu (BLIK, po jego włączeniu), zbliżający się koniec trialu (24h przed, po PS-68), koniec trialu bez konwersji (winback), wyczerpanie puli AI, nieudana płatność odnowienia (grace period), anulowanie subskrypcji, pomyślne odnowienie.
- [ ] E-maile zawierają CTA prowadzące do odpowiednich sekcji aplikacji (checkout, `/settings`, `/pricing`).
- [ ] Wysyłka odbywa się przez Resend z Edge Function (`_shared/email/`).
- [ ] Użytkownik może wypisać się z e-maili marketingowych (zgodnie z istniejącą zgodą marketingową), ale nie z e-maili transakcyjnych.
- [ ] Każdy typ e-maila ma unikalny identyfikator szablonu wersjonowany w `docs/`.

**Zależności:**
- Wymaga: PS-66 (moduł e-mail, dane płatności)
- Wymaga: PS-67 (scenariusze anulowania i nieudanej płatności)
- Wymaga: PS-68 (tylko scenariusze trialu)

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
- Wymaga: PS-66 (tabele `subscriptions`, `subscription_payments`)
- Wymaga: PS-64 (kredyty AI)
- Wymaga: PS-67 (tylko ręczna zmiana statusu subskrypcji i anulowanie)

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
- Wymaga: PS-66 (rola `premium` ustawiana po zakupie; weryfikacja roli z JWT nie wymaga PS-67)

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

**Status:** zrealizowane jako **PS-97** (tryb „Link URL” w `/recipes/new/assist`, `POST /ai/recipes/draft`, `source: "url"`). PS-97 nie ma jeszcze wpisu w `project-summary.md` — dodać po weryfikacji. Poniższe kryteria opisują stan docelowy po uzgodnieniu z faktycznym zachowaniem: import jest dostępny także dla Free w ramach 3 próbnych kredytów `draft` (nie jest chroniony `premiumRoleMatchGuard`; guard istnieje, ale nie jest podpięty do żadnej trasy).

**Opis:**
Jako użytkownik Premium (oraz Free w ramach puli próbnej), chcę wkleić URL strony z przepisem, aby aplikacja automatycznie wypełniła formularz przepisu, oszczędzając mi czas na ręczne przepisywanie.

**Kryteria akceptacji:**
- [x] W asyście AI (`/recipes/new/assist`) dostępny jest tryb „Link URL”.
- [x] Użytkownik wkleja URL — backend pobiera stronę, przekazuje tekst do LLM i zwraca wypełniony formularz (jak `/ai/recipes/draft` dla tekstu).
- [ ] Obsługiwane są popularne formaty przepisów (schema.org `Recipe`, popularni wydawcy) — poza zakresem PS-97 (opcjonalna optymalizacja).
- [x] Każdy pomyślny import z URL zużywa 1 kredyt `draft` (etykieta analityczna: `import-url`).
- [ ] Przy braku kredytów wyświetlany jest modal upgrade/dokupienia kredytów (dialog z PS-64; domknięcie w PS-69, dokupienie w PS-86).
- [ ] Decyzja produktowa: czy Free po wyczerpaniu 3 importów próbnych widzi ekran upgrade (zalecane) — realizuje PS-69.
- [x] W przypadku niedostępności URL lub błędu parsowania wyświetlany jest czytelny komunikat błędu.

**Zależności:**
- Wymaga: PS-64 (kredyty AI)
- Współpracuje z: PS-69 (domknięcie paywalla), PS-66 (rola premium po zakupie)

---

### PS-77: Import przepisu ze zdjęcia, zrzutu ekranu i skanu (Premium)

**Status:** zrealizowane jako **PS-100** (tryb „Obraz” z 1–5 zdjęciami, `POST /ai/recipes/draft`, `source: "image"`) wraz z PS-92 (schowek) i PS-93 (aparat). Obrazy żyją tylko w pamięci przeglądarki i na czas jednego wywołania modelu (nie trafiają do Storage). Dostępne także dla Free w ramach 3 próbnych kredytów `draft`.

**Opis:**
Jako użytkownik Premium (oraz Free w ramach puli próbnej), chcę wgrać zdjęcie lub skan strony z przepisem, aby aplikacja automatycznie rozpoznała i wypełniła formularz przepisu.

**Kryteria akceptacji:**
- [x] W asyście AI (`/recipes/new/assist`) dostępny jest tryb „Obraz” (wiele zdjęć: wybór pliku, schowek, aparat).
- [x] Obsługiwane formaty: JPG, PNG, WebP (PDF poza zakresem; skan to zdjęcie lub zrzut strony).
- [x] Backend wysyła obrazy do LLM (multimodal) i zwraca wypełniony formularz.
- [x] Import (niezależnie od liczby zdjęć, maks. 5) zużywa 1 kredyt `draft` (etykieta analityczna: `import-image`); osobny, droższy kredyt nie jest planowany bez zmiany modelu z PS-64.
- [x] Przy nieczytelnym lub błędnym obrazie wyświetlany jest czytelny komunikat błędu z możliwością ponowienia.
- [x] Limity rozmiaru: 10 MB na plik, 15 MB łącznie (PS-100); wcześniejszy zapis „20 MB” i „plik w Storage przez 24h” nie obowiązują.
- [ ] Przy braku kredytów wyświetlany jest modal upgrade (PS-69).

**Zależności:**
- Wymaga: PS-64 (kredyty AI)
- Współpracuje z: PS-69 (domknięcie paywalla), PS-66 (rola premium po zakupie)

---

### PS-78: Asystowane porządkowanie importowanej treści w ramach kredytów

**Opis:**
Jako użytkownik Premium, po imporcie z URL/zdjęcia chcę, aby asystent AI zaproponował uporządkowanie składników, kroków i wskazówek, aby wynikowy przepis był spójny i gotowy do zapisania.

**Kryteria akceptacji:**
- [ ] Po imporcie URL/zdjęcia formularz przepisu wyświetla wynik parsowania z możliwością uruchomienia „Porządkowania AI".
- [ ] „Porządkowanie" wywołuje LLM w celu: normalizacji jednostek składników, weryfikacji kolejności kroków, wyodrębnienia wskazówek.
- [ ] Akcja kosztuje 1 kredyt `draft` (etykieta analityczna: `assist-cleanup`) i jest dostępna wyłącznie dla Premium/Admin.
- [ ] Wynik jest prezentowany jako propozycja do zaakceptowania lub odrzucenia przez użytkownika.
- [ ] Użytkownik może edytować wynik przed zapisem.

**Zależności:**
- Wymaga: import poprzedzający (PS-97 lub PS-100; w tej numeracji PS-76 / PS-77)
- Wymaga: PS-64 (kredyty AI)

---

### PS-79: Sugestie metadanych przepisu generowane przez AI (Premium)

**Opis:**
Jako użytkownik Premium tworzący lub edytujący przepis, chcę otrzymać sugestie kategorii, tagów, kuchni, diety i trudności generowane przez AI, aby szybciej i spójniej klasyfikować przepisy.

> **Uwaga:** metadane (kategoria, tagi, kuchnia, dieta, trudność) są już zwracane razem z draftem AI (PS-91). Ta historyjka dotyczy wyłącznie przepisów tworzonych ręcznie lub edytowanych, bez wcześniejszego importu AI.

**Kryteria akceptacji:**
- [ ] W formularzu przepisu dla Premium/Admin dostępny jest przycisk „Zasugeruj metadane AI".
- [ ] Akcja wysyła nazwę, opis i składniki przepisu do LLM i zwraca propozycje: kategorii, tagów (maks. 5), kuchni, diety, trudności.
- [ ] Sugestie są wyświetlane obok odpowiednich pól formularza jako chipy do zaakceptowania/odrzucenia.
- [ ] Każde wywołanie sugestii metadanych zużywa 1 kredyt `draft` (etykieta analityczna: `metadata-suggest`).
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
- Wymaga: istniejącej normalizacji składników (`recipe_normalized_ingredients`, niezależna od PS-64)

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
Jako zalogowany użytkownik, chcę wyeksportować pojedynczy przepis do Markdown (PDF opcjonalnie, w drugiej kolejności — wymaga dodatkowej biblioteki lub funkcji renderującej), a jako użytkownik Premium — wyeksportować całą bibliotekę, aby mieć kopię zapasową swoich danych.

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
- Wymaga: PS-97 / PS-100 (import z linku i zdjęć — wspólna infrastruktura parsowania; w tej numeracji PS-76 / PS-77)

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
| **PS-66** Checkout i płatności | PS-63, PS-64, PS-71 (regulamin przed sprzedażą) |
| **PS-67** Zarządzanie subskrypcją (etap A: Customer Portal) | PS-66 |
| **PS-68** Trial 7-dniowy | PS-66, PS-64 |
| **PS-69** Komunikaty paywall w UI | PS-64, PS-65, PS-63 |
| **PS-70** Ekran zużycia kredytów | PS-64 |
| **PS-71** Strony prawne subskrypcji | PS-63 |
| **PS-72** Maile transakcyjne | PS-66, PS-67, PS-68 (część) |
| **PS-73** Rozszerzenie panelu admina | PS-66, PS-64 |
| **PS-74** Reklamy i afiliacja | PS-66 |
| **PS-75** Strony SEO kategorii | — |
| **PS-76** Import z URL (zrealizowane jako PS-97) | PS-64 |
| **PS-77** Import ze zdjęcia/skanu (zrealizowane jako PS-100) | PS-64 |
| **PS-78** Asystowane porządkowanie importu | PS-76 lub PS-77, PS-64 |
| **PS-79** Sugestie metadanych AI | PS-64, PS-66 |
| **PS-80** Przeliczanie porcji | PS-66 |
| **PS-81** Historia szkiców AI | PS-64, PS-66 |
| **PS-82** Priorytet jobów AI dla Premium | PS-66, PS-67 |
| **PS-83** Zaawansowana lista zakupów | PS-66 |
| **PS-84** Planer tygodniowy | PS-83, PS-66 |
| **PS-85** Konto rodzinne | PS-67, PS-84 |
| **PS-86** Pakiety kredytów (add-on) | PS-66, PS-64, PS-63 |
| **PS-87** Eksport biblioteki | PS-66 |
| **PS-88** Wykrywanie duplikatów | — |
| **PS-89** Masowy import (add-on) | PS-86, PS-97/PS-100 |
| **PS-90** Zachęty UGC | PS-64, PS-70 |

### Bloki implementacyjne (sugerowana kolejność sprintów)

Szczegółowy, krok po kroku plan uruchomienia płatności (kroki programistyczne i konfiguracyjne) oraz kolejność prac po starcie: [`premium-users-payments-launch-plan.md`](./premium-users-payments-launch-plan.md).

```
Sprint 1 — Pierwsza złotówka (blokujące):
  PS-63 → PS-64 → PS-65 → PS-66 (kod gotowy)  +  PS-71 (treści prawne)  +  konfiguracja Stripe/Supabase

Sprint 2 — Pierwsze tygodnie po starcie (retencja i bezpieczeństwo):
  PS-67 (etap A: Customer Portal) → PS-72 (e-maile cyklu życia) → PS-69 + PS-70 (domknięcie paywalla i użycia)
  → PS-73 (panel admina) → PS-68 (trial) → BLIK (osobna historyjka w PS-66 deferred-features)

Sprint 3 — Wartość Premium (skok ARPU):
  PS-78 → PS-79 → PS-80 → PS-81 → PS-82 → PS-86 (PS-76 i PS-77 są już zrealizowane jako PS-97 i PS-100)

Sprint 3b — Ruch i monetyzacja uzupełniająca:
  PS-74 → PS-75

Sprint 4 — Planer, zakupy, rodzina:
  PS-83 → PS-84 → PS-85

Sprint 5 — Retencja i wzrost:
  PS-87 → PS-88 → PS-89 → PS-90
```
