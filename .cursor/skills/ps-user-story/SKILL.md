---
name: ps-user-story
description: Tworzy lub rozwija pełną historyjkę PS-N w formacie Given-When-Then.
disable-model-invocation: true
---
# Historyjka użytkownika
Przeczytaj konwencje i summary, zidentyfikuj slug oraz zapisz historyjkę w jej
folderze.

## Tryb `pytania`
Działaj według sekcji „Rundy pytań” z konwencji; limit to 3 rundy. Przed
sformułowaniem pytań sprawdź kod, migracje i RLS. Przejdź przez poniższe obszary
i pytaj o każdy, którego nie rozstrzyga opis, kod ani wcześniejsze odpowiedzi:
- aktorzy, role i uprawnienia (gość, użytkownik, premium, admin), RLS,
- dane: pola, walidacja, limity, wartości domyślne, istniejące rekordy,
- przepływ główny i alternatywne, stany pusty, ładowania i błędu,
- przypadki brzegowe: duplikaty, usuwanie, współbieżność, brak uprawnień,
  wyczerpane kredyty AI lub nieudana płatność,
- wpływ na istniejące funkcje i kontrakty, zgodność wsteczna,
- UX: miejsce w nawigacji, responsywność, komunikaty, potwierdzenia,
- zakres wyłączony z historyjki i miernik sukcesu.

`STATUS: BRAK_PYTAŃ` zwróć dopiero wtedy, gdy każdy obszar jest rozstrzygnięty
albo świadomie oznaczony jako nie dotyczy.

## Tryb `zapis`
Uwzględnij cel, zakres i zakres wyłączony, zależności, kryteria Given-When-Then,
przypadki brzegowe, sekcję „Decyzje i założenia” z rund pytań oraz DoD
obejmujące testy jednostkowe, lint/build oraz review. Dodaj pustą sekcję
„Historia zmian” (data, etap, zmiana, powód) — wypełniają ją kolejne etapy.
