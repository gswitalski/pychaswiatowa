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
| PS-63 | Strona cennika `/pricing` i regulamin subskrypcji `/legal/subscription` (oferta Premium; bez trialu, oszczędność ~41%) | zakończone | — |
| PS-66 | Checkout i płatności Stripe (karta; BLIK w API, ukryty w UI), webhook, `/billing/payments`, wygaszanie subskrypcji | zaimplementowane, niezweryfikowane | konfiguracja Stripe/sekretów, test z kartą testową i webhookiem (Stripe CLI), `deno test`/`vitest` całości, smoke na produkcji (karta live ze zwrotem), weryfikacja regulaminu przez prawnika i księgową |
| PS-64 | Kredyty AI (pule `draft` i `image`, reset miesięczny) | zakończone | — |
| PS-91 | Metadane draftu AI (`POST /ai/recipes/draft`) | zakończone | — |
| PS-100 | Wiele zdjęć draftu AI (1–5) | zakończone | — |
| PS-65 | Limit „Mojego planu” dla Free (domyślnie 7, `PLAN_LIMIT_FREE`) | zakończone | — |
| PS-92 | Przycisk „Wklej ze schowka” | zakończone | — |
| PS-95 | Osobiste flagi przepisów (ulubiony, chcę wypróbować) | zakończone | — |
| PS-96 | Filtry przepisów w Odkrywaj | zakończone | — |
| PS-99 | Oceny przepisów (1–5) | zakończone | — |
| PS-31 | Prywatna notatka użytkownika przy przepisie | zakończone | — |
| PS-15 | Autor przepisu na widoku szczegółowym | zaimplementowane, niezweryfikowane | Deno `check`/`test`, smoke API, test w przeglądarce |
| PS-37 | Nazwa użytkownika w topbarze | zaimplementowane, niezweryfikowane | Deno (CI `validate-backend`), smoke API, test w przeglądarce |
| PS-204 | Tabela przepisów publicznych w panelu admina (`/admin/recipes`) | zaimplementowane, niezweryfikowane | smoke `200`/`403`, test w przeglądarce, `pl-x-icu` na produkcji, `deno lint` |
| PS-107 | Filtrowanie tabeli przepisów w panelu admina po polach kolumn | zaimplementowane, niezweryfikowane | smoke z kontami, `deno test` całego `supabase/functions` (wcześniejsze błędy typów w recipes/plan/ai), test w przeglądarce, `deno lint` |
| PS-108 | Model grupy przepisu (`recipe_families`), migracja i widoczność (bez zmian UI) | zaimplementowane, niezweryfikowane | smoke z kontami, `deno lint`, migracja na kopii danych produkcyjnych, `deno check explore` (istniejące błędy `RecipeDetailFullRow`) |
| PS-109 | Zarządzanie wariantami przepisu przez właściciela (flaga `feature_flags`, endpointy wariantów, ekran „Warianty” przy edycji) | zaimplementowane, niezweryfikowane | smoke z kontami i Storage (kopia zdjęcia), integracyjne GWT 3–4/7–18 i test współbieżności, `deno lint` (istniejące 14 problemów), test w przeglądarce (UX/mobile/dostępność), dialogi Material zamiast `prompt`/`confirm` |
| PS-110 | Przełącznik wariantów na szczegółach przepisu (`?variant=`, lista wariantów w `GET /recipes/{id}` i `GET /explore/recipes/{id}`) | zaimplementowane, niezweryfikowane | smoke z kontami, integracyjne GWT 10 i 22, testy mutacyjne ACL/wyścigów, testy widoków GWT 14–17/20–23/25/27, `deno lint` (istniejące problemy), test w przeglądarce (UX/mobile/dostępność) |
| PS-111 | Grupowanie list i wyszukiwania wariantów (Explore, „Moje przepisy”, kolekcje, pasek boczny, wyszukiwarka; RPC `get_recipes_list`) | zaimplementowane, niezweryfikowane | smoke z kontami, GWT na realnej bazie (N/K, kursor, kolekcja ponad limit), `deno lint` (44 problemy w zmienianych funkcjach, nierozdzielone na istniejące), `supabase db lint` (istniejące `AUTHZ1`), test w przeglądarce (UX/mobile/dostępność) |
| PS-112 | Działania użytkownika na wariancie i integracje (znaczniki stanu w przełączniku, `Nazwa · wariant` w planie/zakupach, limit Free tylko dla dostępnych wpisów, czyszczenie przy usuwaniu wariantu/grupy, panel admina: kolumna „Wariant” i `variants_count`; RPC `admin_get_*_page_v2`) | zaimplementowane, niezweryfikowane | smoke z kontami, GWT na realnej bazie (wiele kont, wyścig limitu, czyszczenie), niewielkie pokrycie testami nowych scenariuszy (Deno +1, Vitest +2), migawka `active_variant_count` w `shopping_list_items`, `deno lint` (istniejące ostrzeżenia), test w przeglądarce (UX/mobile/dostępność) |
| PS-115 | Nazwy wariantów w jednym wierszu karty (bez licznika) i krótszy stan na szczegółach (bez „w planie” i „ocena N”) | zaimplementowane, niezweryfikowane | smoke z kontami, `deno lint` (istniejące problemy poza tą zmianą) |
| PS-116 | RLS przepisów: odczyt własnych i publicznych dla zalogowanych, zapis tylko rolą serwisową, `security_invoker` na `recipe_details` | zaimplementowane, niezweryfikowane | smoke z kontami, `deno lint` (istniejące problemy repozytorium) |

Znane ryzyko PS-204: funkcje `security definer` admina mają teraz `execute` tylko dla
`service_role`; inne funkcje admin/RPC z niepełnym `revoke` nie zostały zinwentaryzowane
(osobne zgłoszenie bezpieczeństwa). Przyszłe migracje przebudowujące te funkcje muszą
powtórzyć `revoke`.
