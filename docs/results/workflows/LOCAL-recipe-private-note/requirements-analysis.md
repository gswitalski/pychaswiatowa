# Analiza wymagań — prywatna notatka przy przepisie

**Workflow:** `LOCAL-recipe-private-note` (pilotaż procesu pojedynczej User Story)  
**Powiązanie Jira:** [PS-31](https://gswitalski.atlassian.net/browse/PS-31) — „notatka użytkownika" (Do zrobienia, bez opisu w eksporcie)  
**Status:** wersja robocza — wymaga odpowiedzi na pytania uszczegóławiające i jawnej akceptacji (`approvals.requirements`)

---

## 1. Zrozumienie kontekstu projektu

PychaŚwiatowa to cyfrowa książka kucharska (Angular 21 + Supabase). Użytkownik gromadzi własne przepisy, korzysta z publicznego katalogu `/explore`, kolekcji i „Mój plan". Dane osobiste per użytkownik i przepis są już w produkcie wzorowane na **PS-95** (`user_recipe_flags`: ulubiony / chcę wypróbować) oraz **PS-99** (`recipe_ratings` — publiczne oceny).

W `project-summary.md` PS-31 jest w backlogu jako „Notatka użytkownika przy przepisie", natomiast w sekcji „Granice" wymienione są m.in. „notatki użytkownika przy cudzym przepisie" jako zaplanowane później — to wymaga świadomej decyzji produktowej w tej historyjce (spójność z PS-95, które już dotyczy cudzych przepisów publicznych).

**Brak implementacji w kodzie:** nie ma tabeli, endpointu ani pola DTO pod notatkę użytkownika (w przeciwieństwie do flag i ocen).

---

## 2. Analiza wymagań (wejście użytkownika)

| Element | Interpretacja |
|--------|----------------|
| **Aktor** | Zalogowany użytkownik (gość poza zakresem — spójnie z flagami/ocenami). |
| **Obiekt** | Prywatna notatka powiązana z **konkretnym przepisem**, widoczna **tylko dla autora notatki**. |
| **Wartość** | Zapisywanie osobistych uwag (zamienniki, czas w piekarniku u siebie, „podwoić porcje", link do wideo) bez zmiany treści przepisu i bez ujawniania ich autorowi przepisu ani innym użytkownikom. |
| **Prywatność** | Kluczowe — „prywatna" oznacza brak wpływu na widoczność przepisu, brak powiadomień, brak w API publicznym dla gości. |
| **Zakres MVP story** | Jedna notatka tekstowa na parę (użytkownik, przepis), edycja na widoku szczegółów — **do potwierdzenia** (pytania poniżej). |

---

## 3. Propozycja wzorca technicznego (na etap story, bez implementacji)

Analogia do PS-95:

- Tabela np. `user_recipe_notes` (`user_id`, `recipe_id`, `body` / `note`, `updated_at`), PK `(user_id, recipe_id)`, RLS tylko `auth.uid() = user_id`, `ON DELETE CASCADE` przy usunięciu przepisu/użytkownika.
- Endpoint np. `PUT /recipes/{id}/note` (upsert / wyczyść przez pusty string) + pole `my_note` (lub podobne) w `GET /recipes/{id}` i `GET /public/recipes/{id}` **wyłącznie dla zalogowanego** — nigdy w listach/public feed dla anonimowych.
- UI: sekcja „Moja notatka" na `/recipes/:id-:slug` i `/explore/recipes/:id-:slug` (dla widocznych przepisów), autosave lub przycisk „Zapisz", limity długości, komunikaty błędów jak przy flagach.

Ryzyka: synchronizacja z `project-summary` (granice produktu), nadużycie długich notatek (limit znaków), edycja równoległa z wielu kart (ostatni zapis wygrywa — akceptowalne na MVP).

---

## 4. Luki wymagające decyzji

1. Czy notatka dotyczy **tylko własnych** przepisów, czy także **cudzych publicznych** (jak flagi PS-95)?
2. Format treści: zwykły tekst vs wieloliniowy bez formatowania vs Markdown.
3. Miejsce w UI i tryb zapisu (autosave vs przycisk).
4. Czy wyczyścenie notatki = usunięcie wiersza w bazie?
5. Czy pokazywać skrót notatki na kafelkach list — poza zakresem rekomendowane.
6. Czy workflow ma używać ID **PS-31** zamiast `LOCAL-recipe-private-note`?

---

## 5. Decyzje (potwierdzone 2026-11-08, zaktualizowane)

- Zakres przepisów (PS-31): jak PS-95 — własne (dowolna `visibility`) oraz cudze `PUBLIC`; notatka prywatna per użytkownik. Cudzy `SHARED` w kolekcji — **poza** PS-31 (przyszła story).
- Format: **tekst wieloliniowy** bez formatowania.
- Zapis: **przycisk „Zapisz"** + snackbar.
- Identyfikator dokumentacji: **PS-31**.

Pozostałe do ewentualnej korekty przy akceptacji wymagań: limit 2000 znaków, dokładna nazwa pola API/UI, teksty komunikatów.
