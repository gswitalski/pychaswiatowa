# PychaŚwiatowa — rejestr zrealizowanych historyjek

Indeks dokumentacji projektu. Ten plik jest krótki celowo: **jeden wiersz na historyjkę**.
Szczegóły funkcji są w historyjkach i planach (`docs/results/new-features/user-stories/PS-{N}/`,
`docs/results/impl-plans/`), w kodzie i w git.

| Dokument | Zawartość | Utrzymanie |
|---|---|---|
| `docs/results/project-brief.md` | Skrót dla planerów: stack, role, architektura, konwencje | Ręcznie, tylko przy zmianie architektury |
| `docs/results/project-reference.md` | Tabele, widoki, RPC, enumy, Edge Functions, trasy, guardy, migracje | **Generowany z kodu** (`.cursor/hooks/generate-reference.ps1`) |
| `docs/results/project-prd.md` | PRD, historyjki początkowe, dostarczone funkcje, backlog, plan testów | Stabilny, zmieniany świadomie |
| `docs/archive/project-summary-2026-11-13.md` | Pełne summary sprzed rozdzielenia | Archiwum, nie aktualizować |

Status: `zakończone` = brak zgłoszonych braków weryfikacji (statusy przeniesiono z dawnego
summary bez ponownej weryfikacji);
`zaimplementowane, niezweryfikowane` = są braki wymienione w ostatniej kolumnie.

## Historyjki

| ID | Funkcja | Status | Braki weryfikacji |
|---|---|---|---|
| — | Google OAuth: logowanie i rejestracja, uzupełnienie profilu | zakończone | — |
| — | Strona cennika, stub `/checkout`, regulamin subskrypcji | zakończone | — |
| PS-64 | Kredyty AI (pule `draft` i `image`, reset miesięczny) | zakończone | — |
| PS-91 | Metadane draftu AI (`POST /ai/recipes/draft`) | zakończone | — |
| PS-100 | Wiele zdjęć draftu AI (1–5) | zakończone | — |
| PS-65 | Limit „Mojego planu” dla Free (domyślnie 3) | zakończone | — |
| PS-92 | Przycisk „Wklej ze schowka” | zakończone | — |
| PS-95 | Osobiste flagi przepisów (ulubiony, chcę wypróbować) | zakończone | — |
| PS-96 | Filtry przepisów w Odkrywaj | zakończone | — |
| PS-99 | Oceny przepisów (1–5) | zakończone | — |
| PS-31 | Prywatna notatka użytkownika przy przepisie | zakończone | — |
| PS-15 | Autor przepisu na widoku szczegółowym | zaimplementowane, niezweryfikowane | Deno `check`/`test`, smoke API, test w przeglądarce |
| PS-37 | Nazwa użytkownika w topbarze | zaimplementowane, niezweryfikowane | Deno (CI `validate-backend`), smoke API, test w przeglądarce |
| PS-204 | Tabela przepisów publicznych w panelu admina (`/admin/recipes`) | zaimplementowane, niezweryfikowane | smoke `200`/`403`, test w przeglądarce, `pl-x-icu` na produkcji, `deno lint` |
| PS-107 | Filtrowanie tabeli przepisów w panelu admina po polach kolumn | zaimplementowane, niezweryfikowane | smoke z kontami, `deno test` całego `supabase/functions` (wcześniejsze błędy typów w recipes/plan/ai), test w przeglądarce, `deno lint` |

Znane ryzyko PS-204: funkcje `security definer` admina mają teraz `execute` tylko dla
`service_role`; inne funkcje admin/RPC z niepełnym `revoke` nie zostały zinwentaryzowane
(osobne zgłoszenie bezpieczeństwa). Przyszłe migracje przebudowujące te funkcje muszą
powtórzyć `revoke`.
