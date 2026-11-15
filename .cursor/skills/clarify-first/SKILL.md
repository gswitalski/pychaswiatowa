---
name: clarify-first
description: Doprecyzowanie wymagań przed pracą. Agent najpierw zadaje kilka pytań z zaznaczoną rekomendacją, a odpowiedzi użytkownika uwzględnia w wyniku. Wywoływany wyłącznie ręcznie przez `/clarify-first`.
disable-model-invocation: true
---
# Najpierw doprecyzuj, potem pracuj

Wywołanie: `/clarify-first [opis zadania]`. Zadanie to opis podany razem z
poleceniem albo ostatnia prośba użytkownika w rozmowie. Skill działa tylko na
żądanie; sam z siebie nie włącza się przy innych zadaniach.

## Zasady
1. **Nie zaczynaj pracy.** Do czasu odpowiedzi użytkownika nie edytuj plików,
   nie uruchamiaj poleceń zmieniających stan (instalacje, migracje, commity)
   i nie generuj wyniku zadania. Dozwolone jest tylko czytanie (`Grep`, `Glob`,
   `Read`).
2. **Najpierw sprawdź sam.** Zanim zapytasz, przejrzyj kod, konfigurację i
   dokumenty związane z zadaniem. Nie pytaj o to, co rozstrzyga repozytorium,
   reguły projektu lub treść prośby.
3. **Pytaj tylko o to, co zmienia wynik**: zakres, kierunek rozwiązania,
   zachowanie w przypadkach brzegowych, ograniczenia, format wyniku. Nie pytaj
   o oczywistości i nie dziel jednego pytania na kilka.

## Przebieg
1. **Rozpoznanie.** Krótko przeczytaj to, co potrzebne, by pytania były
   konkretne (nazwy plików, istniejące wzorce, obecne zachowanie).
2. **Pytania.** Jedna sesja `AskQuestion`, do 10 pytań. Każde pytanie:
   - zrozumiałe bez otwierania plików (jedno zdanie kontekstu w treści),
   - 2–4 opcje, każda ze skutkiem widocznym dla użytkownika,
   - **rekomendowana opcja jest pierwsza**, a jej etykieta kończy się
     dopiskiem „(Rekomendowane)”; powód rekomendacji podaj w treści pytania
     w jednym zdaniu,
   - gdy opcje się nie wykluczają, ustaw `allow_multiple: true`.
   Użytkownik zawsze może wpisać własną odpowiedź („Other”).
3. **Doprecyzowanie (opcjonalnie, raz).** Jeśli odpowiedzi stworzyły
   sprzeczność lub nową lukę, zadaj jedną krótką dodatkową sesję. Nie
   powtarzaj pytań rozstrzygniętych. Pozostałe niejasności rozstrzygnij
   wariantem rekomendowanym i zapisz jako założenie.
4. **Podsumowanie ustaleń.** Przed pracą wypisz w 3–7 punktach: decyzje
   użytkownika i przyjęte założenia (z oznaczeniem, co jest założeniem).
5. **Wykonanie.** Zrealizuj zadanie ściśle według ustaleń. Gdy odpowiedź
   użytkownika różni się od rekomendacji, obowiązuje odpowiedź użytkownika.
   Nie wracaj do rozstrzygniętych kwestii i nie dodawaj zakresu, o który nie
   prosił.
6. **Raport.** Na końcu krótko wskaż, jak każda decyzja i założenie wpłynęły
   na wynik, oraz odstępstwa od ustaleń (jeśli były, z powodem).

## Gdy pytania są zbędne
Jeśli po rozpoznaniu nic nie zmienia wyniku (zadanie jednoznaczne), napisz to
jednym zdaniem, wypisz założenia i przejdź do wykonania. Nie wymyślaj pytań,
żeby spełnić minimum.

## Przykład pytania
- Treść: „Gdzie pokazać filtr kategorii? Dziś lista przepisów ma tylko
  wyszukiwarkę. Rekomendacja: panel nad listą, bo jest widoczny na mobile bez
  dodatkowego kliknięcia.”
- Opcje: „Panel nad listą (Rekomendowane)”, „Szuflada boczna”, „Okno
  dialogowe”.
