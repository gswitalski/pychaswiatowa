# Analiza funkcjonalności dla modelu premium (v02)

Wersja 2.0 dokumentu. Cel nadrzędny: **maksymalizacja zysku z witryny** (subskrypcja, kredyty AI, reklamy i afiliacja na częściach publicznych), przy zachowaniu uczciwego freemium.

Dokument zastępuje wcześniejszą analizę v01 (jej pliku nie ma już w repozytorium; różnice opisuje sekcja 9). Opiera się na stanie produktu z `docs/results/project-prd.md` i `docs/results/project-summary.md`. Historyjki: `premium-users-user-stories.md`. Kroki uruchomienia płatności: `premium-users-payments-launch-plan.md`.

## 1. Cel dokumentu

Wskazanie, jakie funkcjonalności powinny być dostępne dla trzech segmentów:

- użytkownika niezalogowanego (gość),
- zalogowanego użytkownika zwykłego (`user`),
- zalogowanego użytkownika premium (`premium`).

Założenia v02:

- główny model monetyzacji: subskrypcja miesięczna lub **roczna (preferowana)**,
- dodatkowe strumienie: reklamy i afiliacja na witrynie publicznej, pakiety kredytów AI,
- strategia freemium: darmowa prywatna książka kucharska ma realną wartość; Premium sprzedaje **oszczędność czasu, planer/zakupy, brak reklam i pulę AI**, a nie prawo do przechowywania przepisów,
- persona: domowy pasjonat gotowania gromadzący własne przepisy; nisza o wysokiej skłonności do płacenia: **termorobot / grill**,
- haczyk Premium: import z **URL, zdjęcia i skanu** (już w produkcie: PS-97 i PS-100, w ramach puli kredytów) plus inteligentne zakupy i planer (jeszcze nie ma); wklejany tekst i Markdown nie są głównym powodem płatności,
- pierwsza złotówka ma spiąć to, co już jest w produkcie (pula kredytów AI PS-64, import tekst/URL/zdjęcia, zdjęcia AI, checkout PS-66, `/pricing` PS-63), bez czekania na planer i zaawansowane zakupy.

### 1.1. Decyzje startowe (listopad 2026)

Zakres wersji startowej płatności jest celowo wąski. Wszystko poza poniższą tabelą wchodzi po starcie przychodu (kolejność w `premium-users-payments-launch-plan.md`).

| Obszar | Decyzja na start | Odłożone na po starcie |
|---|---|---|
| Operator płatności | **Stripe** (hosted Checkout, faktury Stripe); „PayU lub odpowiednik” z wcześniejszych opisów oznacza Stripe | — |
| Metody płatności | **Tylko karta** (subskrypcja odnawiana automatycznie) | BLIK (API gotowe, ukryty w UI; wymaga przypomnień o końcu okresu) |
| Ceny | 24 zł / miesiąc, **169 zł / rok** (ok. 7 miesięcy ceny miesięcznej, oszczędność ok. 41%); domyślnie plan roczny | Zmiany cen, kody promocyjne |
| Trial 7 dni | **Poza wersją startową** (nie ma go na `/pricing`, w FAQ ani w regulaminie) | PS-68 |
| Limit „Mojego planu” Free | **7 pozycji** (`PLAN_LIMIT_FREE`, Premium: 50) | — |
| Anulowanie subskrypcji | Na start e-mail do supportu; **Stripe Customer Portal** (przycisk w `/settings`) jako pierwszy krok po starcie | Własny UI i e-maile cyklu życia (PS-67, PS-72) |
| E-mail po zakupie | Potwierdzenie i faktura ze Stripe | Własne e-maile przez Resend (PS-72) |
| Domena | `pychaswiatowa.pl` | — |

## 2. Rekomendacja biznesowa

Najbardziej opłacalny model to **freemium z subskrypcją Premium**, uzupełniony o **kredyty AI** i **monetyzację katalogu publicznego**. Wersja darmowa ma być prawdziwą książką kucharską. Premium ma dawać poczucie, że aplikacja wykonuje nudną pracę i że korzystanie z serwisu jest wygodniejsze (w tym bez reklam).

Najsilniejszy argument sprzedażowy to import z linków, zdjęć i skanów: użytkownik nie chce ręcznie przepisywać kolekcji. Drugi, równorzędny argument to **codzienne gotowanie**: plan tygodnia i mądra lista zakupów. Zdjęcia AI są dodatkiem wizualnym o wysokim koszcie — osobna pula kredytów, nie rdzeń oferty.

Rekomendowany kierunek:

- gość odkrywa treść (SEO), ewentualnie widzi reklamy/afiliację i trafia do rejestracji,
- użytkownik zwykły buduje przyzwyczajenie i bibliotekę; paywall pojawia się w momencie bólu (kolejny import, lepsze zakupy, koniec kredytów), nie przy suficie liczby przepisów,
- użytkownik premium płaci za import URL/zdjęcie, pulę AI, planer, zaawansowane zakupy, brak reklam i (kolejny etap) konto rodzinne.

### 2.1. Oferta i ekonomia (ramy, nie twarda cena rynkowa)

Proponowane ramy do walidacji na starcie sprzedaży (kwoty orientacyjne, PLN, B2C):

| Element | Rekomendacja |
|---|---|
| Premium miesięcznie | ok. 19–29 zł |
| Premium rocznie | ok. 149–199 zł (start: **169 zł**, czyli ok. 7 miesięcy ceny 24 zł i oszczędność ok. 41%; **domyślny wybór w checkout**) |
| Trial | 7 dni, z **limitem AI**, nie z nielimitowanym AI — **po starcie płatności** (poza wersją startową, patrz 1.1) |
| Free AI | 1–3 **udane** importy na konto (start: **3**, wspólna pula dla tekstu, URL i zdjęć), potem paywall; nie 3 próby co miesiąc w nieskończoność |
| Premium AI | stała miesięczna pula kredytów. Wdrożone są dwie pule: `draft` (tekst, URL, zdjęcia wejściowe, asysty) i `image` (generowanie zdjęcia); dalszy podział (tani URL vs drogi obraz) dopiero, gdy koszty to uzasadnią |
| Add-on | pakiet kredytów (także dla Free) — impuls bez nowej subskrypcji, ochrona marży |
| Free vs Premium (reklamy) | reklamy i/lub afiliacja na częściach publicznych; Premium = **bez reklam** |

Zasada: nigdy nie komunikować „nielimitowanego AI”. Nielimitowany LLM niszczy marżę.

Stan produktu a oferta: import z URL (PS-97) i ze zdjęć (PS-100, do 5 zdjęć) **już działają** w asyście AI na `/recipes/new/assist`, rozliczane z puli `draft`. Free ma 3 takie importy na konto (próbka), Premium miesięczną pulę. Brakuje natomiast planera tygodniowego, zaawansowanych zakupów, konta rodzinnego, reklam (więc „brak reklam” jest dziś obietnicą na przyszłość) i priorytetu jobów AI (PS-82). Do czasu ich wdrożenia sprzedawać to, co jest: pulę kredytów AI (tekst, URL, zdjęcia), zdjęcia AI, limit planu 50 pozycji; pozostałe korzyści oznaczać „Wkrótce”. Checkout i rola `premium` w JWT są warunkiem pierwszej złotówki.

### 2.2. Czego nie robić

- Nie stawiać twardego niskiego limitu przepisów (50–100) jako głównego paywalla.
- Nie dawać gościowi demo importu AI (koszt, boty, słaby ROI).
- Nie reklamować Premium agresywnie na każdym publicznym przepisie (SEO i zaufanie).
- Nie obiecywać masowego nielimitowanego importu w pierwszym SKU.
- Nie budować marketplace’u, socialu ani makroodżywczych na starcie przychodu.

## 3. Użytkownik niezalogowany

Rola biznesowa: ruch organiczny, ewentualny przychód z reklam/afiliacji oraz konwersja do rejestracji. Gość **nie** buduje prywatnej bazy i **nie** zużywa płatnego API AI.

Funkcjonalności, które powinien mieć:

- landing z jasnym opisem wartości i linkiem do `/pricing`,
- wyszukiwanie publicznych przepisów w `/explore`,
- filtrowanie: dieta, kuchnia, trudność, grill, termorobot,
- szczegóły publicznego przepisu pod kanonicznym URL,
- sekcje najnowszych i popularnych przepisów,
- rejestracja, logowanie, weryfikacja e-mail,
- strony prawne: regulamin, prywatność, wydawca oraz regulamin subskrypcji `/legal/subscription` (obejmuje politykę zwrotów i prawo odstąpienia w jednym dokumencie).

Rekomendowane ograniczenia:

- brak dodawania i zapisywania przepisów,
- brak planu i listy zakupów,
- brak funkcji AI (w tym demo importu bez konta),
- brak prywatnych danych i personalizacji.

Rekomendowane funkcje dodatkowe:

- CTA **„Zapisz do swojej książki kucharskiej”** na publicznym przepisie → rejestracja (główny CTA),
- jeden dyskretny blok korzyści Premium **po** CTA zapisu, nie zamiast treści przepisu i nie jako baner na całej stronie,
- publiczne strony SEO: kategorie, kuchnie, termorobot, grill, np. `/explore/kuchnia/wloska`, `/explore/termorobot`,
- po uzyskaniu indeksowalnego ruchu: reklamy i/lub linki afiliacyjne (sprzęt, termorobot, grill) na landingu i `/explore`; nie w treści przepisu w sposób, który psuje czytelność.

Uzasadnienie:

Gość ma zobaczyć realną zawartość. Zapis, organizacja i automatyzacja wymagają konta. Demo AI dla anonima jest wydatkiem, nie dźwignią zysku.

## 4. Zalogowany użytkownik zwykły

Komplet podstawowej prywatnej książki kucharskiej: przyzwyczajenie, zaufanie, koszt zmiany narzędzia. Kosztowne i silnie automatyzujące funkcje są za paywallem albo w puli kredytów startowych.

Funkcjonalności, które powinien mieć:

- dashboard „Moja Pycha”,
- tworzenie, edycja i soft-delete własnych przepisów,
- lista własnych przepisów oraz publicznych z własnych kolekcji,
- wyszukiwanie, sortowanie, podstawowe filtry,
- kategorie z listy, własne tagi, kolekcje,
- widoczność: prywatny, współdzielony, publiczny,
- import z Markdown (ręczny, bez LLM),
- upload zdjęcia z pliku, schowka lub drag and drop (bez generowania AI),
- dodawanie publicznego przepisu do kolekcji,
- „Mój plan” i lista zakupów w wersji podstawowej (MVP: grupowanie na froncie, odhaczanie, pozycje ręczne, czyszczenie),
- profil i ustawienia,
- ewentualnie reklamy na częściach inspirowanych katalogiem publicznym (nie w edytorze przepisu).

Rekomendowane limity Free:

- **przepisy i kolekcje:** praktycznie bez twardego niskiego sufitu; ewentualny bardzo wysoki cap antyspamowy (np. tysiące), nie 50–100 jako oferta,
- **zdjęcia własne:** umiarkowany limit przestrzeni (koszt Storage), komunikowany jako miejsce na dysku, nie jako „kup więcej przepisów”,
- **plan:** węższy niż pełne MVP, żeby Premium miało różnicę: **7 pozycji** (wystarcza na tydzień obiadów; konfigurowalne przez `PLAN_LIMIT_FREE`), Premium 50; nie ten sam limit co „nielimitowane Premium”,
- **AI:** 3 udane importy/asysty na konto (lifetime onboarding, wspólna pula `draft` dla tekstu, URL i zdjęć — Free ma więc próbkę importu z URL i zdjęć), potem paywall lub dokupienie kredytów,
- brak generowania zdjęć AI w cenie Free (możliwy wyłącznie add-on kredytów),
- brak masowego importu,
- brak zaawansowanego scalania jednostek na liście zakupów i planera tygodniowego,
- brak masowego eksportu biblioteki.

Rekomendowane funkcje dodatkowe:

- ekran wykorzystania kredytów AI (jest: sekcja w `/settings`, PS-64) i przestrzeni zdjęć (jeszcze nie ma limitu przestrzeni),
- komunikat upgrade przy ~70–80% puli AI lub przestrzeni, oraz w momencie bólu (kolejny URL, skan, scalanie zakupów),
- eksport **pojedynczego** przepisu (Markdown/PDF); lock-in: brak eksportu całej biblioteki,
- udostępnianie linkiem publicznym (już spójne z widocznością Publiczny),
- zapis ostatnich wyszukiwań i filtrów lokalnie,
- onboarding: pierwszy przepis w ok. 2 minuty (formularz lub Markdown), potem propozycja importu ze zdjęcia/URL,
- zachęta UGC: publikacja N publicznych przepisów = dodatkowe kredyty AI (napęd SEO i reklam).

Uzasadnienie:

Free musi być użyteczne bez płatności. Paywall ma uderzać w oszczędność czasu i koszt API, nie w „nie możesz mieć książki kucharskiej”. Wieczny darmowy AI co miesiąc zabija konwersję i marżę. Markdown zostaje za darmo jako narzędzie dla osób technicznych — **nie** jest komunikowany jako haczyk Premium.

## 5. Zalogowany użytkownik premium

Premium to czas, automatyzacja, wygoda codziennego gotowania i brak reklam — nie „większy dysk”.

Funkcjonalności, które powinien mieć:

- wszystko z konta zwykłego, bez reklam,
- wysoki limit przestrzeni na zdjęcia (nadal mierzalny, nie „nieskończoność”; dziś brak limitu i brak tej korzyści w ofercie),
- import z URL w ramach miesięcznej puli (PS-97),
- import ze zdjęcia, zrzutu i skanu w ramach miesięcznej puli (PS-100),
- asystowane porządkowanie zaimportowanej treści (składniki, kroki, wskazówki) w ramach puli kredytów,
- sugestie kategorii, tagów, kuchni, diety i trudności (przy imporcie AI już są: PS-91; osobny przycisk dla ręcznie tworzonych przepisów to PS-79),
- automatyczne przeliczanie porcji i składników,
- zaawansowana lista zakupów: scalanie, lepsze jednostki, grupy,
- planer tygodniowy z listą zakupów z planu (gdy funkcja powstanie — wysoki priorytet, nie „średni”),
- historia importów AI i powrót do szkicu,
- wyższy priorytet jobów AI i normalizacji składników,
- generowanie zdjęcia AI (w tym z referencją) **z osobnej, wąskiej puli**,
- konto rodzinne (właściciel + współdomownicy, wspólna lista zakupów) — w pierwszym SKU Premium albo tuż po starcie płatności, nie jako odległy „średni” temat.

Czego nie dawać w pierwszym SKU jako „nielimitowane”:

- masowy import dziesiątek przepisów naraz — osobny droższy pakiet albo wyższy plan,
- nielimitowane zdjęcia AI,
- nielimitowany import obrazów.

Rekomendowane ograniczenia mimo Premium:

- twarda miesięczna pula kredytów, rozdzielona na `draft` (tekst, URL, zdjęcia wejściowe, asysty) i `image` (generowanie zdjęcia),
- komunikaty zużycia i możliwość dokupienia pakietu,
- fair use (nadużycia, scrapowanie, automaty) — widoczne w adminie.

Funkcje do rozwoju po starcie przychodu (kolejność pod zysk):

1. planer tygodniowy i lista z planera (jeśli nie weszły w pierwsze Premium),
2. rodzina i prywatne kolekcje współdzielone,
3. eksport całej biblioteki i kopia zapasowa,
4. wykrywanie duplikatów, wersjonowanie,
5. propozycje posiłków z własnych przepisów, zamienniki AI, wyszukiwanie zaawansowane,
6. wartości odżywcze — późno; osobny droższy moduł tylko gdy będzie popyt, nie jako obietnica startowa.

Uzasadnienie:

Monetyzować koszt infrastruktury i wysoką wartość użytkową. Import URL/zdjęcie rozwiązuje przepisanie kolekcji. Planer i zakupy sprzedają się co tydzień. Zdjęcia AI są drogie — kredyty. Rodzina podnosi ARPU i obniża churn. Tekst wklejany bez URL nie może być jedynym „wow”, bo Free ma Markdown.

## 6. Priorytet biznesowy (pod zysk z witryny)

Priorytet najwyższy — **pierwsza złotówka i ochrona marży**:

- płatności (checkout Stripe: karta na start, BLIK po starcie; webhook → `app_role = premium`, faktury Stripe, `/pricing`) — kod gotowy (PS-63, PS-66), brakuje konfiguracji usług i wdrożenia (patrz `premium-users-payments-launch-plan.md`),
- limity kredytów na istniejące AI (`/ai/recipes/draft`, `/ai/recipes/image`) — wdrożone (PS-64),
- strona upgrade z konkretnymi korzyściami (pula AI z importem URL/zdjęcia — jest; planer/zakupy, brak reklam — „Wkrótce”),
- brak reklam w Premium (gdy reklamy ruszą u gościa/Free),
- jasne limity Free: kredyty AI, przestrzeń zdjęć, węższy plan — **nie** niski cap liczby przepisów.

Priorytet wysoki — **skok ARPU po starcie sprzedaży**:

- rozszerzenia importu URL/zdjęcie/skan (podstawowy import już działa; porządkowanie wyniku, historia szkiców),
- ulepszona lista zakupów i planer tygodniowy,
- nisza termorobot/grill (SEO, filtry, obietnica na `/pricing`),
- sugestie metadanych i przeliczanie porcji,
- historia szkiców AI,
- konto rodzinne,
- pakiety kredytów (add-on).

Priorytet średni:

- masowy import jako droższy add-on, nie jako „w cenie Premium bez limitu”,
- eksport biblioteki i backup,
- wykrywanie duplikatów,
- zachęty za publikację przepisów (kredyty za UGC).

Priorytet niski na tym etapie (nie rozwijać przed przychodem):

- komentarze, znajomi (oceny przepisów 1–5 już są: PS-99),
- spiżarnia,
- marketplace przepisów,
- zaawansowana analiza wartości odżywczych.

## 7. Ścieżki konwersji

Nie jedna ścieżka, kilka równoległych:

1. **SEO → konto:** gość znajduje publiczny przepis → „Zapisz do książki” → rejestracja.
2. **Habit → import:** Free dodaje 1–2 przepisy ręcznie/Markdown → kończą się kredyty albo pojawia się URL/zdjęcie → Premium lub pakiet.
3. **Zakupy/planer → checkout:** użytkownik korzysta z planu i listy → komunikat o scalaniu, tygodniu, rodzinie.
4. **Reklama → konto lub klik afiliacyjny:** gość na `/explore` (przychód nawet bez rejestracji).
5. **Trial → rok:** 7 dni z limitem AI → w checkout domyślnie plan roczny (po starcie płatności; trial nie wchodzi do wersji startowej).

Klasyczna sekwencja produktowa:

1. Publiczny przepis z wyszukiwarki lub SEO.
2. Rejestracja, żeby zapisać przepis.
3. Pierwszy własny przepis w kilka minut.
4. Naturalny ból: linki, zdjęcia, notatki, lista zakupów na tydzień.
5. Oferta Premium (import, planer, brak reklam, kredyty).
6. Płatność za czas i wygodę, nie za samo istnienie konta.

Onboarding i retencja: pierwszy przepis, potem paywall importu; e-mail (koniec trialu, koniec kredytów, winback). To część modelu, nie „opcjonalny marketing”.

## 8. Operacje, prawo i admin

Warunek skalowania zysku, nie opcjonalny backlog:

- checkout i odnawianie subskrypcji, mapowanie na rolę `premium` w JWT (kod gotowy: PS-66),
- strona `/pricing` (jest), komunikaty limitów w UI (dialog wyczerpania kredytów i limitu planu są; reszta w PS-69),
- regulamin subskrypcji, polityka zwrotów, prawo odstąpienia (B2C, PL/UE) — roboczy dokument `/legal/subscription`, przed startem wymaga weryfikacji prawnika,
- maile transakcyjne i lifecycle (na start: e-maile Stripe; własne — PS-72),
- panel admina (dziś: lista użytkowników i tabela przepisów publicznych; brak widoku subskrypcji i zużycia AI): zużycie AI, nadużycia, refundy, status subskrypcji,
- pomiar: koszt kredytu vs konwersja, LTV plan miesięczny vs roczny, churn po końcu trialu.

## 9. Porównanie v01 → v02 (skrót)

| Temat | v01 | v02 |
|---|---|---|
| Główny paywall | m.in. 50–100 przepisów, 5–10 kolekcji | kredyty AI, URL/zdjęcie, planer/zakupy, reklamy; storage prawie wolny |
| Free AI | np. 3 próby / miesiąc | 1–3 udane importy na konto, potem paywall |
| Haczyk Premium | import tekst + zdjęcie + URL równo | URL + zdjęcie/skan; Markdown/tekst nie jest filarem sprzedaży |
| Demo AI dla gościa | tak | nie |
| Planer | priorytet średni | priorytet wysoki |
| Rodzina | średni, po MVP | wcześniej, ARPU i churn |
| Zdjęcia AI | lista korzyści Premium | wąska, droga pula kredytów |
| Masowy import | w pierwszym Premium | add-on / wyższy plan |
| Przychód z witryny | tylko subskrypcja | subskrypcja + kredyty + reklamy/afiliacja |
| Cena i trial | brak | ramy 19–29 zł / miesiąc oraz 149–199 zł / rok (start: 24 zł i 169 zł); trial 7 dni z limitem AI po starcie płatności |

## 10. Wnioski

Darmowy użytkownik ma zbudować wartościową prywatną książkę kucharską. Premium ma być oczywiste, gdy chce **szybko przenieść** przepisy z linków i zdjęć albo **wygodniej gotować tydzień** (planer, zakupy, rodzina) i nie oglądać reklam.

Najważniejsze płatne elementy:

- import z URL oraz ze zdjęcia/skanu (działa dziś), w ramach **mierzonej puli**,
- porządkowanie i sugestie metadanych,
- planer i zaawansowana lista zakupów,
- brak reklam,
- zdjęcia AI jako drogi dodatek, nie powód subskrypcji,
- pakiety kredytów i (kolejno) konto rodzinne.

Dopóki płatności nie są uruchomione (kod jest, brakuje konfiguracji Stripe, wdrożenia i prawnika), podział funkcji nie maksymalizuje zysku. Najszybsza ścieżka przy obecnym kodzie: **uruchomić checkout PS-66 z pulą kredytów PS-64 (asysta AI US-036, zdjęcia AI US-037) i `/pricing` PS-63**, potem Stripe Customer Portal i e-maile cyklu życia, trial, BLIK, a jako skok ARPU planer i zaawansowane zakupy; równolegle SEO katalogu i — po ruchu — reklamy/afiliacja na witrynie publicznej.
