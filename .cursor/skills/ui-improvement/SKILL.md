---
name: ui-improvement
description: Proces poprawy interfejsu (tylko frontend): rundy pytań z rekomendacjami, plan zapisany i zaakceptowany, implementacja widoków, lint, Vitest, build i przegląd responsywności.
disable-model-invocation: true
---
# Poprawa interfejsu użytkownika

Wywołanie: `/ui-improvement [opis problemów i pomysłów]`. Proces jak przy nowej
funkcji, ale **bez backendu**: pytania → plan (bramka) → implementacja →
weryfikacja → raport. Całość wykonujesz sam w głównym agencie (bez subagentów,
bez `feature-stage.ps1`; hook weryfikacji dla subagentów tu nie działa).

## Zasady
1. Przeczytaj `ps-feature-conventions` (sekcje „Pytania do użytkownika” i
   „Poprawki UI”). Reguły `frontend.mdc` i `vitest.mdc` obowiązują; nie
   przepisuj ich do planu.
2. Zakres: wyłącznie frontend (`src/**`). Nie zmieniaj `supabase/**` ani
   `shared/contracts/**`, nie dodawaj `supabase.from`/`rpc`. Gdy poprawa wymaga
   backendu lub nowego API, nie implementuj jej: zapisz w planie i zaproponuj
   osobne `/ps-new-feature`.
3. Zmiany globalne (motyw M3, `styles.scss`, komponenty w `shared/`, układ
   w `layout/`) wolno wprowadzić **tylko za jawną zgodą** użytkownika na bramce
   planu. Bez zgody ogranicz plan do zmian lokalnych.
4. Tylko testy jednostkowe Vitest; bez E2E. Nie wykonuj commita, wpisu w
   `project-summary.md`, retrospektywy ani review.
5. Koszt: czytaj `rg` + fragmenty plików, nie całe pliki ani dokumenty
   (`project-prd.md`, historyjki, `project-reference.md` tylko przez `rg` po
   trasach). Jedna sesja `AskQuestion` na rundę. Nie powtarzaj planu w czacie.

## Etapy
1. **Wejście i rozpoznanie.** Sprawdź Glob-iem `docs/results/ui-improvements/*`:
   jeśli plan dla tematu istnieje, wznów od bramki planu lub implementacji.
   Inaczej: `rg` po widokach i komponentach z opisu, potem tylko potrzebne
   fragmenty (HTML/SCSS/TS widoku, motyw). Opcjonalny baseline w przeglądarce
   tylko dla problemów wizualnych i tylko gdy aplikacja już działa
   (najpierw tani `browser_snapshot`, zrzut ekranu najwyżej raz na szerokość).
   Ustal slug (angielski `kebab-case`, ok. 4 słów, raz).
2. **Runda pytań 1.** Jedna sesja `AskQuestion` (3–5 pytań) w formacie z
   konwencji; rekomendowana opcja pierwsza, z dopiskiem „(Rekomendowane)”.
   Pytaj tylko o to, czego nie rozstrzyga kod ani opis (priorytety, kierunek
   wizualny, zachowanie na mobile, zakres widoków). Dodaj jedno pytanie
   wielokrotnego wyboru z **własnymi propozycjami** agenta (UX, responsywność,
   dostępność, nowoczesny design), każda z krótkim uzasadnieniem.
3. **Runda 2 (opcjonalna, ostatnia).** Tylko gdy odpowiedzi stworzyły
   sprzeczności lub nowe luki; nie powtarzaj rozstrzygniętych pytań. Resztę
   zapisz jako „Założenia” z wariantem rekomendowanym. Odpowiedzi użytkownika
   mają trafić do planu i implementacji.
4. **Plan** (≤ ~6 KB) w
   `docs/results/ui-improvements/{slug}/{slug}-ui-plan.md`. Sekcje:
   - Problem i cel (z opisu użytkownika).
   - Decyzje z odpowiedzi i założenia.
   - Zakres: widoki i pliki (HTML/SCSS/TS/spec).
   - **Zmiany globalne**: lista dotkniętych widoków albo „brak”.
   - Per widok: układ mobile-first i breakpointy, komponenty Material, stany
     loading/empty/error, dostępność, tokeny `--mat-sys-*`.
   - Testy Vitest (przypadki).
   - Weryfikacja: pusta tabela (lint, Vitest, build, przegląd 375/768/1280).
5. **Bramka planu.** Podaj w czacie ścieżkę, kluczowe decyzje i założenia, potem
   `AskQuestion`: `Zatwierdzam` / `Zmień plan` (własna instrukcja: popraw plan
   i ponów bramkę) / `Zatrzymaj się` (wznowisz tym samym poleceniem). Gdy plan
   ma zmiany globalne, zadaj w tej samej sesji osobne pytanie o zgodę na nie.
   Do zatwierdzenia nie edytuj kodu aplikacji.
6. **Implementacja.** Wg planu i `frontend.mdc`: standalone, `inject`,
   sygnały, `OnPush`, `@if`/`@for`, selektory z prefiksem `pych`. Dodaj lub
   zaktualizuj testy Vitest tylko dla zmienionego zachowania (stany, atrybuty
   dostępności, logika responsywna).
7. **Weryfikacja.**
   - W trakcie: celowane `npx vitest run <zmienione pliki spec>`.
   - Na końcu raz: `npm run lint`, `npm run test:run`, `npm run build`;
     z wyjścia czytaj tylko błędy i końcówkę. Błędy popraw i powtórz.
   - Przegląd w przeglądarce (`cursor-ide-browser`): tylko zmienione kluczowe
     widoki, szerokości 375, 768, 1280 (`Emulation.setDeviceMetricsOverride`,
     na koniec `Emulation.clearDeviceMetricsOverride`). Najpierw
     `browser_snapshot`, potem jeden zrzut na szerokość. Sprawdź: brak
     poziomego scrolla, cele dotykowe ≥ 44–48 px, widoczny focus, kontrast AA.
     Dane logowania tylko z `.env.local`. Brak działającej aplikacji lub kont
     to `NIE_WYKONANO` z opisem braku; nie pytaj, nie eskaluj.
   - Wynik wpisz do tabeli „Weryfikacja” w planie (statusy: `PASS`, `FAIL`,
     `NIE_WYKONANO`, `WYMAGA_WERYFIKACJI`).
8. **Zakończenie.** Raz przejrzyj `git diff --stat` i diff zmienionych plików.
   Krótki raport: tabela statusów, zmienione pliki, odstępstwa od planu,
   założenia. Nie zgłaszaj „gotowe”, gdy którykolwiek krok ma `FAIL` lub
   `NIE_WYKONANO`.

## Lista kontrolna UX
- Mobile-first; breakpointy przez CDK `BreakpointObserver` lub CSS; brak
  poziomego scrolla; spójność z istniejącymi wzorcami przed nowymi.
- Odstępy z siatki 4/8 px, skala typografii M3, kolory z `--mat-sys-*`
  (działają w jasnym i ciemnym motywie).
- Cele dotykowe ≥ 48 px, widoczny focus, obsługa klawiatury, ARIA, kontrast
  WCAG AA, `prefers-reduced-motion`.
- Stany: szkielet (`@defer`/skeleton) zamiast samego spinnera, sensowny empty
  state, błąd z akcją ponowienia; podczas ładowania `opacity: 0.5` na danych,
  bez białych nakładek.
