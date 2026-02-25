# Polityka prywatności serwisu „PychaŚwiatowa”

> **Wersja:** 0.1 (MVP)  
> **Data publikacji:** \<YYYY-MM-DD\>  
> **Ostatnia aktualizacja:** \<YYYY-MM-DD\>  

Niniejsza Polityka prywatności („**Polityka**”) opisuje zasady przetwarzania danych osobowych oraz informacje o plikach cookies i podobnych technologiach w związku z korzystaniem z serwisu internetowego „PychaŚwiatowa” („**Serwis**”).

Polityka jest powiązana z dokumentem „Regulamin serwisu PychaŚwiatowa” dostępnym pod `/legal/terms`.

---

## 1. Administrator danych i kontakt

1. Administratorem Twoich danych osobowych jest:
    - **Forma prawna:** jednoosobowa działalność gospodarcza (JDG)  
    - **Nazwa firmy:** \<NAZWA_FIRMY\>  
    - **Adres:** \<ADRES\>  
    - **NIP:** \<NIP\>  
    - **E-mail kontaktowy:** \<EMAIL\>  
2. Kontakt w sprawach ochrony danych osobowych: **\<EMAIL\>** (na tym etapie: ten sam adres, co kontaktowy).

---

## 2. Zakres Serwisu (w skrócie) i kategorie danych

Serwis to aplikacja webowa (SPA) do tworzenia, organizowania i przeglądania przepisów kulinarnych, w tym:
- rejestracji i logowania (z potwierdzeniem e-mail),
- tworzenia i edycji przepisów (w tym zdjęć),
- organizacji (kategorie, tagi, kolekcje),
- publicznego katalogu przepisów (gdy ustawisz widoczność „Publiczny”),
- funkcji „Mój plan” oraz listy zakupów,
- funkcji AI (asystowane dodawanie z tekstu/obrazu, normalizacja składników, generowanie zdjęć — część jako Premium).

W zależności od tego, jak korzystasz z Serwisu, możemy przetwarzać następujące kategorie danych:

1. **Dane konta i identyfikacyjne**
    - adres e-mail,
    - nazwa użytkownika,
    - identyfikator użytkownika w systemie (np. UUID),
    - rola aplikacyjna (`user`, `premium`, `admin`) zapisana po stronie backendu i odczytywana przez aplikację z tokena (JWT).
2. **Treści użytkownika**
    - przepisy (np. nazwa, opis, składniki, kroki, wskazówki, tagi, kategoria, widoczność),
    - zdjęcia przepisów wgrane przez użytkownika,
    - kolekcje i powiązania przepisów z kolekcjami,
    - „Mój plan” i lista zakupów (pozycje wynikające z planu oraz pozycje dodane ręcznie).
3. **Dane techniczne i eksploatacyjne**
    - podstawowe logi bezpieczeństwa i diagnostyczne (np. zdarzenia błędów, adres IP, znaczniki czasu, identyfikatory żądań),
    - dane o przeglądarce/urządzeniu (w zakresie typowym dla analityki i bezpieczeństwa).
4. **Dane analityczne**
    - dane zbierane przez Google Analytics (szczegóły w rozdziale o cookies).
5. **Dane dot. płatności (Premium)**
    - dane niezbędne do realizacji płatności online i rozliczeń (np. identyfikatory transakcji, status płatności, ewentualnie dane fakturowe — zależnie od wdrożenia).  
    **Uwaga:** dostawcę płatności wybierzemy w późniejszym terminie — poniżej stosujemy placeholdery.
6. **Dane dot. marketingu i komunikacji**
    - preferencje marketingowe (zgody/wycofanie zgód),
    - historia wysłanych powiadomień marketingowych (np. e-mail / powiadomienia w Serwisie — zakres zależny od wdrożenia).

---

## 3. Źródła danych

1. Dane podajesz bezpośrednio Ty (np. przy rejestracji, tworzeniu przepisów, wgrywaniu zdjęć, dodawaniu pozycji na liście zakupów).
2. Część danych powstaje automatycznie podczas korzystania z Serwisu (np. logi techniczne, dane analityczne).
3. W przypadku płatności online — część danych może pochodzić od operatora płatności (np. potwierdzenie statusu transakcji).

---

## 4. Cele przetwarzania i podstawy prawne

Poniżej wskazujemy główne cele przetwarzania danych oraz podstawy prawne zgodnie z RODO:

1. **Założenie i obsługa konta, logowanie, weryfikacja e-mail**
    - **Cel:** utworzenie konta, umożliwienie logowania, bezpieczeństwo konta, obsługa procesu potwierdzania e-mail.
    - **Podstawa prawna:** art. 6 ust. 1 lit. b RODO (wykonanie umowy / świadczenie usługi).
2. **Świadczenie funkcji Serwisu (przepisy, kolekcje, tagi, „Mój plan”, lista zakupów)**
    - **Cel:** zapis i prezentacja Twoich treści oraz danych organizacyjnych, działanie planu i listy zakupów.
    - **Podstawa prawna:** art. 6 ust. 1 lit. b RODO.
3. **Publiczny katalog przepisów**
    - **Cel:** udostępnianie publicznych przepisów innym użytkownikom i osobom odwiedzającym Serwis.
    - **Zakres typowo publiczny:** treść przepisu oznaczonego jako „Publiczny”, jego zdjęcie, wybrane metadane (np. kategoria, tagi, data) oraz **nazwa użytkownika autora**.
    - **Podstawa prawna:** art. 6 ust. 1 lit. b RODO (świadczenie funkcji Serwisu zgodnie z Twoim wyborem widoczności) oraz/lub art. 6 ust. 1 lit. a RODO (Twoja zgoda na publikację w rozumieniu funkcji Serwisu) — w praktyce realizowane przez Twoje działanie w Serwisie (ustawienie widoczności).
4. **Funkcje AI (asystowane dodawanie, normalizacja składników, generowanie zdjęć)**
    - **Cel:** realizacja funkcji AI uruchamianych przez Ciebie lub działających w tle jako element funkcji Serwisu (np. normalizacja składników po zapisie).
    - **Podstawa prawna:** art. 6 ust. 1 lit. b RODO (świadczenie usługi) oraz — gdy wymagane — art. 6 ust. 1 lit. a RODO (zgoda) dla funkcji dodatkowych.  
    - **Ważne:** funkcje AI mogą wymagać przekazania treści wejściowych (np. tekstu przepisu lub obrazu) do zewnętrznych dostawców modeli (szczegóły w rozdziale o odbiorcach).
5. **Płatności online i rozliczenia (Premium)**
    - **Cel:** realizacja płatności, rozliczenia, obsługa zwrotów/reklamacji, wystawianie dokumentów księgowych (jeśli dotyczy).
    - **Podstawa prawna:** art. 6 ust. 1 lit. b RODO (umowa) oraz art. 6 ust. 1 lit. c RODO (obowiązki prawne, np. podatkowe/rachunkowe — jeśli dotyczy).
6. **Marketing i komunikacja marketingowa**
    - **Cel:** wysyłka powiadomień marketingowych (np. informacje o nowościach, funkcjach, promocjach).
    - **Kanały (planowane):** e-mail i/lub powiadomienia w Serwisie (\<DOPRECYZUJ KANAŁY\>).
    - **Podstawa prawna:** co do zasady art. 6 ust. 1 lit. a RODO (zgoda) — oraz dodatkowo wymogi prawa telekomunikacyjnego/ustawy o świadczeniu usług drogą elektroniczną dla komunikacji elektronicznej (w zależności od kanału i treści).  
    - Zgodę możesz w każdej chwili wycofać (szczegóły: rozdział o prawach).
7. **Analityka (Google Analytics)**
    - **Cel:** statystyka i poprawa Serwisu (np. zrozumienie, jak użytkownicy korzystają z widoków, wykrywanie problemów UX).
    - **Podstawa prawna:** art. 6 ust. 1 lit. a RODO (zgoda) — jeśli wdrożenie wymaga zgody na cookies/analitykę (zalecane).  
8. **Bezpieczeństwo, zapobieganie nadużyciom, obrona roszczeń**
    - **Cel:** zabezpieczenie Serwisu, wykrywanie nadużyć (np. próby obejścia zabezpieczeń), ustalanie/doch. roszczeń.
    - **Podstawa prawna:** art. 6 ust. 1 lit. f RODO (uzasadniony interes administratora).
9. **Obsługa zgłoszeń i reklamacji**
    - **Cel:** kontakt i obsługa spraw użytkowników (np. reklamacje, zgłoszenia naruszeń, pytania).
    - **Podstawa prawna:** art. 6 ust. 1 lit. b RODO (umowa) i/lub art. 6 ust. 1 lit. f RODO (uzasadniony interes).

---

## 5. Odbiorcy danych i podmioty przetwarzające

W związku z działaniem Serwisu Twoje dane mogą być przekazywane następującym kategoriom odbiorców:

1. **Dostawcy infrastruktury backendowej i baz danych**
    - Serwis korzysta z platformy **Supabase** (baza danych PostgreSQL, uwierzytelnianie, przechowywanie plików).  
    - Supabase działa jako podmiot przetwarzający dane (processor) w zakresie hostingu i usług technicznych.
2. **Przechowywanie i serwowanie zdjęć**
    - Zdjęcia przepisów są przechowywane w usłudze storage (w ramach Supabase Storage lub równoważnej konfiguracji).
3. **Dostawcy AI**
    - **OpenAI** — dostawca modeli wykorzystywanych m.in. do generowania zdjęć (`gpt-image-1.5`) oraz/lub do funkcji AI przetwarzających treści przepisu.
    - **Google (Gemini)** — dostawca modeli wykorzystywanych do części funkcji AI.  
    - **Założenie (zgodnie z Twoją decyzją):** dane przesyłane do dostawców AI **nie są wykorzystywane do trenowania modeli** (na podstawie konfiguracji/warunków dostawców).  
    - W ramach funkcji AI do dostawców mogą trafić dane wejściowe takie jak: tekst przepisu, obraz wklejony przez użytkownika, fragmenty formularza przepisu (zakres zależy od konkretnej funkcji).
4. **Analityka**
    - **Google Analytics** (Google) — dostawca narzędzia analitycznego wykorzystywanego do pomiaru i ulepszania Serwisu.
5. **Płatności online (Premium)**
    - Operator płatności: \<OPERATOR_PŁATNOŚCI\>  
    - Dane przekazywane operatorowi zależą od wdrożenia, ale zwykle obejmują identyfikatory transakcji, kwoty, statusy płatności, oraz niezbędne dane do obsługi płatności i zwrotów.
6. **Hosting frontendu / CDN**
    - Serwis może być hostowany na platformie typu \<HOSTING_FRONTEND\> (np. Firebase Hosting) oraz korzystać z CDN w celu poprawy wydajności.
7. **Uprawnione organy publiczne**
    - Gdy jest to wymagane prawem (np. na żądanie sądu, organów ścigania).

Dodatkowo Twoje dane mogą zostać ujawnione innym użytkownikom lub osobom odwiedzającym Serwis, gdy ustawisz przepis jako **Publiczny** (szczegóły: rozdział 4 pkt 3).

---

## 6. Przekazywanie danych poza EOG (UE/EOG)

Niektórzy dostawcy usług (np. Google Analytics, OpenAI, Google Gemini, a także wybrani operatorzy płatności) mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym.

Jeżeli dochodzi do transferu danych poza EOG, stosujemy odpowiednie zabezpieczenia, w szczególności:
- **standardowe klauzule umowne (SCC)** zatwierdzone przez Komisję Europejską, i/lub
- inne mechanizmy legalizujące transfer przewidziane przez RODO (w zależności od dostawcy i konfiguracji).

\<DODAJ: KRÓTKI OPIS MECHANIZMÓW DLA KONKRETNYCH DOSTAWCÓW, GDY WYBIERZESZ FINALNĄ KONFIGURACJĘ\>

---

## 7. Okres przechowywania danych (retencja)

1. **Dane konta** przechowujemy przez czas posiadania konta w Serwisie.
2. **Treści użytkownika** (przepisy, kolekcje, plan, lista zakupów) przechowujemy przez czas posiadania konta lub do ich usunięcia w Serwisie (zależnie od funkcji).
3. **Publiczne przepisy** pozostają publiczne do czasu zmiany widoczności przez autora lub usunięcia przepisu (zależnie od funkcji Serwisu).
4. **Dane płatnicze/rozliczeniowe** przechowujemy przez okres wymagany przepisami prawa (np. podatkowymi/rachunkowymi), o ile dotyczy.
5. **Logi techniczne i bezpieczeństwa** przechowujemy co do zasady przez **12 miesięcy**, chyba że dłuższy okres jest potrzebny do wyjaśnienia incydentu bezpieczeństwa lub obrony roszczeń.
6. **Kopie zapasowe** mogą zawierać Twoje dane przez okres do **30 dni** (rotacja backupów). Dane w backupach są nadpisywane cyklicznie.

\<UWAGA WDROŻENIOWA\>: jeśli wdrożysz „soft delete” lub inne mechanizmy, uzupełnij to w tej sekcji, aby opis retencji odpowiadał rzeczywistemu działaniu.

---

## 8. Twoje prawa

W granicach przewidzianych przez RODO przysługują Ci prawa:
1. dostępu do danych,
2. sprostowania danych,
3. usunięcia danych,
4. ograniczenia przetwarzania,
5. przenoszenia danych,
6. wniesienia sprzeciwu (gdy podstawą jest uzasadniony interes),
7. cofnięcia zgody w dowolnym momencie (gdy podstawą jest zgoda) — cofnięcie zgody nie wpływa na zgodność z prawem przetwarzania przed cofnięciem.

Aby skorzystać z praw, skontaktuj się z nami: **\<EMAIL\>**.

Masz również prawo wniesienia skargi do organu nadzorczego: **Prezesa Urzędu Ochrony Danych Osobowych (UODO)**.

---

## 9. Obowiązek podania danych

1. Podanie danych wymaganych do rejestracji (np. e-mail, nazwa użytkownika, hasło) jest konieczne do założenia konta i korzystania z funkcji dostępnych po zalogowaniu.
2. Podanie danych opcjonalnych (np. treści przepisów, zdjęć) zależy od tego, z jakich funkcji korzystasz.
3. Dane do płatności są konieczne do realizacji usługi Premium (jeśli ją wykupujesz).

---

## 10. Zautomatyzowane podejmowanie decyzji i profilowanie

1. Nie podejmujemy wobec Ciebie decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, które wywoływałyby skutki prawne lub w podobny sposób istotnie na Ciebie wpływały.
2. Funkcje AI w Serwisie służą do generowania propozycji treści (np. wstępnego draftu przepisu, normalizacji składników, generowania zdjęcia) i wymagają Twojej weryfikacji — wyniki mogą zawierać błędy.

---

## 11. Bezpieczeństwo danych

Stosujemy środki techniczne i organizacyjne adekwatne do ryzyka, w szczególności:
- kontrolę dostępu do danych (m.in. mechanizmy uwierzytelniania),
- ograniczenia dostępu do danych użytkowników po stronie backendu (np. polityki typu RLS),
- szyfrowanie transmisji (TLS/HTTPS),
- mechanizmy logowania zdarzeń bezpieczeństwa i nadużyć.

---

## 12. Treści użytkownika a dane osobowe osób trzecich

W treściach (np. w przepisach, tagach, opisach) nie umieszczaj danych osobowych osób trzecich, jeśli nie masz do tego podstawy prawnej. W szczególności nie publikuj danych wrażliwych.

---

## 13. Cookies i podobne technologie oraz localStorage

### 13.1. Co stosujemy

Serwis może korzystać z:
1. **Plików cookies i podobnych technologii** (np. identyfikatory w przeglądarce) — w szczególności dla analityki (Google Analytics) oraz ewentualnie dla działania niektórych funkcji.
2. **`localStorage`** w przeglądarce — zgodnie z aktualnym założeniem technicznym:
    - do przechowywania danych sesyjnych/technicznych wymaganych do działania aplikacji (np. tokenów lub informacji o sesji — zależnie od implementacji),
    - do poprawy wygody korzystania (np. ustawienia interfejsu — jeśli zostaną dodane).

### 13.2. Google Analytics

1. Korzystamy z **Google Analytics** w celu analizy korzystania z Serwisu i jego ulepszania.
2. Dane zbierane przez Google Analytics mogą obejmować m.in.: identyfikatory online, informacje o urządzeniu/przeglądarce, zdarzenia w Serwisie, przybliżoną lokalizację (zależnie od konfiguracji).
3. Google Analytics uruchamiamy:
    - \<WARIANT A — REKOMENDOWANY\>: **dopiero po wyrażeniu zgody** w banerze cookies (zgoda może być w każdej chwili wycofana), albo
    - \<WARIANT B\>: w innej konfiguracji zgodnej z prawem (do uzupełnienia po wdrożeniu).

### 13.3. Zarządzanie zgodami / ustawieniami cookies

W Serwisie udostępniamy mechanizm zarządzania cookies: \<OPIS_MECHANIZMU_ZGÓD / LINK_DO_USTAWIEŃ\>.

---

## 14. Powiadomienia marketingowe

1. Jeżeli wyrazisz zgodę, możemy wysyłać Ci powiadomienia marketingowe (np. o nowych funkcjach, treściach, promocjach).
2. Zgodę możesz w każdej chwili wycofać:
    - poprzez link rezygnacji w wiadomości e-mail (jeśli dotyczy) i/lub
    - poprzez ustawienia konta w Serwisie: \<LINK/ŚCIEŻKA\> i/lub
    - kontaktując się z nami: **\<EMAIL\>**.

---

## 15. Zmiany Polityki

Możemy aktualizować Politykę z ważnych przyczyn, w szczególności w razie zmiany funkcjonalności Serwisu, dostawców usług lub zmian w przepisach prawa. O istotnych zmianach poinformujemy w Serwisie, a jeśli to możliwe — również e-mailem.

---

## 16. Kontakt

W sprawach prywatności skontaktujesz się z nami pod adresem: **\<EMAIL\>**.

