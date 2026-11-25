# PS-116 — plan implementacji widoków

## Status warstwy

Nie dotyczy: historyjka nie zmienia ekranów, routingu, komponentów Angular,
serwisów frontendowych, DTO ani flagi `recipe_variants`; zmiana dostępu i
agregatu jest realizowana w migracji oraz Edge Functions zgodnie z planem API.

## Zakres weryfikacji

Nie tworzyć ani nie modyfikować standalone components, sygnałów, serwisów API,
stylów Angular Material ani responsywności. Istniejące ekrany pozostają bez
zmian i korzystają z tych samych endpointów oraz kontraktów.

Pokrycie scenariuszy UI/API jest zapisane w planie API:
scenariusze 8–10 potwierdzają niezmienione ścieżki szczegółów, kolekcji,
wyszukiwania i obrazu, scenariusze 13–14 zachowanie pełnych ocen oraz panelu
administratora, a scenariusz 15 brak zmian ekranów i flag. Nie dodawać testów
Vitest, ponieważ nie ma zmienianego kodu widoku.

## Kryterium zakończenia

`viewSkipped = true`. Implementacja widoków jest pomijana przez etap procesu;
po wdrożeniu API należy wykonać jedynie smoke test istniejących ekranów opisany
w sekcji „Czynności ręczne” planu API.
