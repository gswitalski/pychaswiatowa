# PychaŚwiatowa — brief dla planerów

Zwięzły skrót projektu (ok. 3 KB). Szczegóły czytaj punktowo:
- struktura bazy, RPC, Edge Functions, trasy, guardy: `docs/results/project-reference.md`
  (generowany z kodu),
- kontekst produktowy, backlog, plan testów: `docs/results/project-prd.md`,
- zrealizowane historyjki: `docs/results/project-summary.md` (rejestr).

Używaj `rg -n "<fraza>"` i `Read` z `offset`/`limit`. Przy sprzeczności prawdą jest kod.

## Stack i architektura
- Frontend: Angular 21, Angular Material, standalone components (prefiks `pych`),
  sygnały, `inject`, Sass. Testy: Vitest.
- Backend: Supabase (PostgreSQL + RLS, Auth, Storage, Edge Functions/Deno).
  REST = Edge Functions w `supabase/functions/{funkcja}` (`/recipes` →
  `/functions/v1/recipes`), współdzielony kod w `supabase/functions/_shared`.
- Kontrakty DTO: `shared/contracts/types.ts`; typy bazy:
  `shared/types/database.types.ts` i `supabase/functions/_shared/database.types.ts`.
- AI: OpenAI (draft przepisu, normalizacja), Gemini (zdjęcia). Hosting: Firebase
  (frontend), Supabase Cloud (backend). CI: GitHub Actions.
- Lokalnie (`supabase/config.toml`): API `54331`, baza `54332`, Studio `54333`,
  Mailpit `54334`.

## Role i uprawnienia
- `user` (Free), `premium`, `admin`; rola z JWT (`app_metadata.app_role`), nigdy
  z body. Gość = brak JWT. Rola nie jest w `profiles`.
- Kredyty AI: pule `draft` i `image` (Free dożywotnio, Premium miesięcznie,
  admin bez limitu). Limit „Mojego planu”: Free 3, Premium/admin 50.

## Dane
- Tabele: `profiles`, `categories`, `recipes` (soft delete `deleted_at`,
  JSONB: składniki/kroki/wskazówki), `tags`, `collections`,
  `recipe_collections`, `recipe_tags`, `user_ai_credits`, `user_recipe_flags`,
  `user_recipe_notes`, `recipe_ratings`, plan i lista zakupów, joby
  normalizacji składników.
- RLS włączone na tabelach użytkownika (własność `auth.uid() = user_id`;
  przepisy `PUBLIC` czytelne dla wszystkich). Funkcje `security definer`:
  `revoke` dla `public/anon/authenticated`, jawny `grant` (zwykle `service_role`).
- Migracje: `supabase/migrations/{timestamp}_{opis}.sql`.

## Edge Functions
`admin`, `ai`, `billing`, `categories`, `checkout`, `collections`, `explore`,
`internal`, `me`, `payments-webhook`, `plan`, `profile`, `public`, `recipes`,
`search`, `shopping-list`, `tags`, `utils`.

## Frontend (`src/app`)
- `core` (serwisy, guardy, modele), `shared`, `layout`, `pages/{strona}`:
  `admin`, `auth`, `checkout`, `collections`, `dashboard`, `explore`,
  `forbidden`, `landing`, `legal`, `login`, `pricing`, `recipes`, `register`,
  `settings`, `shopping`.
- Trasy: `app.routes.ts`; guardy m.in. `authenticatedMatchGuard`,
  `usernameCompleteMatchGuard`, `adminRoleMatchGuard`, `premiumRoleMatchGuard`,
  `unsavedChangesGuard`. Layout: App Shell (Sidebar + Topbar), Bottom Bar
  poniżej 960 px.
- Komunikacja z API: serwisy wywołujące Edge Functions; stany ładowania, błędu
  i pustej listy są standardem.

## Zasady procesu
- Tylko testy jednostkowe (Vitest, `deno test`), bez E2E.
- Nie wdrażaj zdalnie; commit wykonuje użytkownik.
