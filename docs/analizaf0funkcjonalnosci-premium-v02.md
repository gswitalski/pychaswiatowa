# Analiza funkcjonalności dla modelu premium (v02)

Wersja 2.0 dokumentu. Cel nadrzędny: **maksymalizacja zysku z witryny** (subskrypcja, kredyty AI, reklamy i afiliacja na częściach publicznych), przy zachowaniu uczciwego freemium.

Dokument zastępuje rekomendacje z `docs/analizaf0funkcjonalnosci-premium.md`. Opiera się na `docs/results/project-summary.md`.

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
- haczyk Premium: import z **URL, zdjęcia i skanu** plus inteligentne zakupy i planer; wklejany tekst i Markdown nie są głównym powodem płatności,
- pierwsza złotówka ma spiąć to, co już jest w produkcie (limity AI draft, zdjęcia AI, checkout), zanim powstanie import z URL.

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
| Premium rocznie | ok. 149–199 zł (równowartość ok. 10 miesięcy; **domyślny wybór w checkout**) |
| Trial | 7 dni, z **limitem AI**, nie z nielimitowanym AI |
| Free AI | 1–3 **udane** importy na konto (onboarding), potem paywall; nie 3 próby co miesiąc w nieskończoność |
| Premium AI | stała miesięczna pula kredytów, osobno: tani import (tekst/URL) vs drogi obraz vs generowanie zdjęcia |
| Add-on | pakiet kredytów (także dla Free) — impuls bez nowej subskrypcji, ochrona marży |
| Free vs Premium (reklamy) | reklamy i/lub afiliacja na częściach publicznych; Premium = **bez reklam** |

Zasada: nigdy nie komunikować „nielimitowanego AI”. Nielimitowany LLM niszczy marżę.

Luka produktowa: **import z URL jest poza MVP**, a w ofercie to filar Premium. Do czasu wdrożenia sprzedawać to, co jest: asysta AI z limitem kredytów, zdjęcia AI, brak reklam po starcie reklam, zapowiedź URL. Checkout i rola `premium` w JWT są warunkiem pierwszej złotówki.

### 2.2. Czego nie robić

- Nie stawiać twardego niskiego limitu przepisów (50–100) jako głównego paywalla.
- Nie dawać gościowi demo importu AI (koszt, boty, słaby ROI).
- Nie reklamować Premium agresywnie na każdym publicznym przepisie (SEO i zaufanie).
- Nie obiecywać masowego nielimitowanego importu w pierwszym SKU.
- Nie budować marketplace’u, socialu ani makroodżywczych na starcie przychodu.

## 3. Użytkownik niezalogowany

Rola biznesowa: ruch organiczny, ewentualny przychód z reklam/afiliacji oraz konwersja do rejestracji. Gość **nie** buduje prywatnej bazy i **nie** zużywa płatnego API AI.

Funkcjonalności, które powinien mieć:

- landing z jasnym opisem wartości i linkiem do `/pricing` (gdy powstanie),
- wyszukiwanie publicznych przepisów w `/explore`,
- filtrowanie: dieta, kuchnia, trudność, grill, termorobot,
- szczegóły publicznego przepisu pod kanonicznym URL,
- sekcje najnowszych i popularnych przepisów,
- rejestracja, logowanie, weryfikacja e-mail,
- strony prawne: regulamin, prywatność, wydawca; po starcie płatności także regulamin subskrypcji i odstąpienia.

Rekomendowane ograniczenia:

- brak dodawania i zapisywania przepisów,
- brak planu i listy zakupów,
- brak funkcji AI (w tym braku demo importu bez konta),
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
- **plan:** węższy niż pełne MVP, żeby Premium miało różnicę, np. plan na bieżący tydzień albo ok. 7–14 pozycji; nie ten sam limit 50 co „nielimitowane Premium”,
- **AI:** 1–3 udane importy/asysty na konto (lifetime onboarding), potem paywall lub dokupienie kredytów,
- brak generowania zdjęć AI w cenie Free (możliwy wyłącznie add-on kredytów),
- brak importu z URL, skanu i masowego importu,
- brak zaawansowanego scalania jednostek na liście zakupów i planera tygodniowego,
- brak masowego eksportu biblioteki.

Rekomendowane funkcje dodatkowe:

- ekran wykorzystania kredytów AI i przestrzeni zdjęć,
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
- wysoki limit przestrzeni na zdjęcia (nadal mierzalny, nie „nieskończoność”),
- import z URL,
- import ze zdjęcia, zrzutu i skanu,
- asystowane porządkowanie zaimportowanej treści (składniki, kroki, wskazówki) w ramach puli kredytów,
- sugestie kategorii, tagów, kuchni, diety i trudności,
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

- twarda miesięczna pula kredytów, rozdzielona: tekst/URL vs obraz vs generowanie zdjęcia,
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

- płatności (checkout, BLIK/PayU lub odpowiednik, webhook → `app_role = premium`, faktury, `/pricing`),
- limity kredytów na istniejące AI (`/ai/recipes/draft`, `/ai/recipes/image`),
- strona upgrade z konkretnymi korzyściami (import URL/zdjęcie, planer/zakupy, brak reklam, pula AI),
- brak reklam w Premium (gdy reklamy ruszą u gościa/Free),
- jasne limity Free: kredyty AI, przestrzeń zdjęć, węższy plan — **nie** niski cap liczby przepisów.

Priorytet wysoki — **skok ARPU po starcie sprzedaży**:

- import z URL oraz ze zdjęcia/skanu,
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

- komentarze, oceny, znajomi,
- spiżarnia,
- marketplace przepisów,
- zaawansowana analiza wartości odżywczych.

## 7. Ścieżki konwersji

Nie jedna ścieżka, kilka równoległych:

1. **SEO → konto:** gość znajduje publiczny przepis → „Zapisz do książki” → rejestracja.
2. **Habit → import:** Free dodaje 1–2 przepisy ręcznie/Markdown → kończą się kredyty albo pojawia się URL/zdjęcie → Premium lub pakiet.
3. **Zakupy/planer → checkout:** użytkownik korzysta z planu i listy → komunikat o scalaniu, tygodniu, rodzinie.
4. **Reklama → konto lub klik afiliacyjny:** gość na `/explore` (przychód nawet bez rejestracji).
5. **Trial → rok:** 7 dni z limitem AI → w checkout domyślnie plan roczny.

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

- checkout i odnawianie subskrypcji, mapowanie na rolę `premium` w JWT,
- strona `/pricing`, komunikaty limitów w UI,
- regulamin subskrypcji, polityka zwrotów, prawo odstąpienia (B2C, PL/UE),
- maile transakcyjne i lifecycle,
- panel admina (dziś placeholder): zużycie AI, nadużycia, refundy, status subskrypcji,
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
| Cena i trial | brak | ramy 19–29 zł / rok, trial 7 dni z limitem AI |

## 10. Wnioski

Darmowy użytkownik ma zbudować wartościową prywatną książkę kucharską. Premium ma być oczywiste, gdy chce **szybko przenieść** przepisy z linków i zdjęć albo **wygodniej gotować tydzień** (planer, zakupy, rodzina) i nie oglądać reklam.

Najważniejsze płatne elementy:

- import z URL oraz ze zdjęcia/skanu, w ramach **mierzonej puli**,
- porządkowanie i sugestie metadanych,
- planer i zaawansowana lista zakupów,
- brak reklam,
- zdjęcia AI jako drogi dodatek, nie powód subskrypcji,
- pakiety kredytów i (kolejno) konto rodzinne.

Dopóki nie ma ceny, trialu, płatności i importu z URL, podział funkcji nie maksymalizuje zysku. Najszybsza ścieżka przy obecnym kodzie: **checkout + kredyty na US-036/US-037 + `/pricing`**, potem import URL i planer jako skok ARPU, równolegle SEO katalogu i — po ruchu — reklamy/afiliacja na witrynie publicznej.
