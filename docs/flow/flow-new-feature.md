# Nowa funkcjonalność

Aby zaplanować, zaimplementować i wdrożyć nową funkcjonalność, wybierz jedną z dwóch ścieżek:

- **Funkcjonalność złożona** (oparta na więcej niż jednej historyjce użytkownika): wykonaj [analizę funkcjonalności](#analiza-funkcjonalności), a następnie [generowanie historyjek użytkownika](#user-stories).
- **Funkcjonalność prosta** (jedna historyjka użytkownika): wykonaj [generowanie pojedynczej historyjki użytkownika](#pojedyncza-historyjka-użytkownika) i przejdź do [planu implementacji](#plan-implementacji).

## Pojedyncza historyjka użytkownika

- Wykonaj prompt `046 Prompt - New feature - user story`.
- Zrewiduj treść historyjki i w razie potrzeby ją popraw.
- Przejdź do punktu [Plan implementacji](#plan-implementacji).

## Analiza funkcjonalności

- Wykonaj prompt `043 Prompt - New features analysis`.
- Zrewiduj dokument za pomocą prompta `044 Prompt - New features analysis review` i **innego modelu**.
- W razie potrzeby skoryguj dokument, kontynuując konwersację z modelem.

## User stories

- Wygeneruj historyjki użytkownika za pomocą prompta `045 Prompt - New features - user stories`.

## Plan implementacji

- Rozpisz wymagania dotyczące API, widoków i planu wdrożenia za pomocą prompta `047 Prompt - User story plan`.
- Wynikowe dokumenty wykorzystaj w kolejnych krokach.

## Implementacja API

- Wykorzystaj prompt `048 Prompt - API Implementation Plan`, aby stworzyć plan implementacji API.
- Zrewiduj plan i w razie potrzeby go skoryguj.
- Wykorzystaj prompt `015 Prompt - Endpoint Implementation` do zaimplementowania API.

## Implementacja widoków

- Wykorzystaj prompt `049 Prompt - View Implementation plan` do stworzenia planu implementacji widoku.
- Zrewiduj plan i w razie potrzeby go skoryguj.
- Wdróż implementację za pomocą prompta `020 Prompt - View Implementation`.

## Aktualizacja project summary

- Zaktualizuj `project-summary` za pomocą prompta `050 Prompt - Project summary update`.
