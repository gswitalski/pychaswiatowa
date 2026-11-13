---
name: ps-user-story
description: Tworzy lub rozwija pełną historyjkę PS-N w formacie Given-When-Then.
disable-model-invocation: true
---
# Historyjka użytkownika
Przeczytaj konwencje i `docs/results/project-brief.md`. Szczegóły techniczne
czytaj punktowo z `docs/results/project-reference.md` (generowany z kodu), a
kontekst produktowy z `docs/results/project-prd.md` (przez `rg`, nie w całości).
Zidentyfikuj slug i zapisz historyjkę w jej folderze.

## Tryb `pytania`
Działaj według sekcji „Pytania do użytkownika” z konwencji; limit to 2 rundy,
najwyżej 5 pytań na rundę. Przed sformułowaniem pytań sprawdź kod, migracje i RLS.
Przejdź przez poniższe obszary i pytaj tylko o te, których nie rozstrzyga opis,
kod ani wcześniejsze odpowiedzi (resztę przyjmij jako założenie z rekomendacją):
- aktorzy, role i uprawnienia (gość, użytkownik, premium, admin), RLS,
- dane: pola, walidacja, limity, wartości domyślne, istniejące rekordy,
- przepływ główny i alternatywne, stany pusty, ładowania i błędu,
- przypadki brzegowe: duplikaty, usuwanie, współbieżność, brak uprawnień,
  wyczerpane kredyty AI lub nieudana płatność,
- wpływ na istniejące funkcje i kontrakty, zgodność wsteczna,
- UX: miejsce w nawigacji, responsywność, komunikaty, potwierdzenia,
- zakres wyłączony z historyjki i miernik sukcesu.

`STATUS: BRAK_PYTAŃ` zwróć, gdy żaden z obszarów nie wymaga decyzji
użytkownika.

## Tryb `zapis`
Uwzględnij cel, zakres i zakres wyłączony, zależności, kryteria Given-When-Then
(numerowane scenariusze), przypadki brzegowe, sekcję „Decyzje i założenia”
z rund pytań oraz DoD obejmujące testy jednostkowe i lint/build. Dodaj pustą
sekcję „Historia zmian” (data, etap, zmiana, powód) — wypełniają ją kolejne etapy.
Zachowaj zwięzłość (≤ ~15 KB): bez powtarzania tych samych reguł w kolejnych
scenariuszach.
