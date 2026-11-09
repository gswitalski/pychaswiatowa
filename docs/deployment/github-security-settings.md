# GitHub – ustawienia bezpieczeństwa repozytorium

Ocena możliwości włączenia branch protection i GitHub Environment `production` dla `gswitalski/pychaswiatowa`.

**Status:** analiza z 2026-11-09. **Żadne ustawienia repozytorium nie zostały zmienione.** Zmiany wymagają osobnej zgody właściciela.

---

## 1. Stan faktyczny (odczyt publicznego API GitHub, bez uwierzytelniania)

| Element | Wynik |
|---------|-------|
| Widoczność repozytorium | `public` |
| Właściciel | konto użytkownika `gswitalski` (typ `User`) |
| Branch `main` | `protected: false`, brak reguł ochrony |
| Rulesets | brak (`[]`) |
| Environments | brak (`total_count: 0`) |
| Ustawienia Actions (workflow permissions, polityka akcji) | **niedostępne bez uwierzytelnienia** (HTTP 401), do sprawdzenia w UI |
| Plan konta właściciela | **niewidoczny przez publiczne API** |

## 2. Dostępność funkcji

Repozytorium jest **publiczne**, więc poniższe funkcje są dostępne również na planie GitHub Free:

| Funkcja | Dostępna dla publicznego repo na Free? | Uwagi |
|---------|----------------------------------------|-------|
| Branch protection rule / Ruleset dla `main` | Tak | Wymagane PR, wymagane kontrole statusu, blokada force-push i usunięcia. |
| GitHub Environment `production` | Tak | Dostępne w publicznych repozytoriach. |
| Required reviewers w Environment | Tak (publiczne repo) | W repo jednoosobowym recenzentem byłby sam właściciel (patrz ograniczenia). |
| Deployment branches (tylko `main`) w Environment | Tak | Dodatkowa blokada od strony GitHub. |
| Environment secrets | Tak | Pozwalają odciąć sekrety produkcyjne od zwykłych jobów. |

> Jeśli repozytorium kiedykolwiek stanie się **prywatne**, na planie Free te funkcje (ochrona brancha, wymagani recenzenci Environment) przestają być dostępne i wymagają planu Pro/Team. Zweryfikuj plan w Settings → Billing and plans, bo nie da się go odczytać publicznie.

## 3. Ograniczenia, o których trzeba wiedzieć

- **Jedyny właściciel:** wymagani recenzenci w Environment i wymagane review w PR nie dadzą niezależnej kontroli, jeśli jedyną osobą z uprawnieniami jesteś Ty. Opcja „Prevent self-review” nie zadziała bez drugiej osoby. Zachowują jednak wartość jako **świadomy punkt zatrzymania** i ślad audytowy.
- **Administrator może obejść** branch protection, chyba że włączone jest „Do not allow bypassing the above settings”. W repo jednoosobowym warto je włączyć, żeby chronić się przed pomyłką, ale pamiętaj, że blokuje to też Twoje bezpośrednie pushe do `main`.
- **Wymagana kontrola statusu** działa, dopiero gdy dana kontrola uruchomiła się w repo co najmniej raz w ostatnim tygodniu (GitHub podpowiada tylko kontrole, które już były uruchomione). Po scaleniu `ci.yml` poczekaj na pierwszy bieg, potem wybierz kontrolę `Build i testy`.
- **Przeniesienie sekretów do Environment** to osobna czynność: dopóki sekrety są repozytoryjne, każdy workflow może ich użyć niezależnie od Environment. Samo dopisanie `environment: production` do workflow nie chroni sekretów repozytoryjnych.

## 4. Rekomendowana konfiguracja (do zatwierdzenia przez właściciela)

### 4.1. Ruleset / branch protection dla `main`

- [ ] Require a pull request before merging (min. 1 zatwierdzenie, jeśli jest drugi recenzent; w przeciwnym razie PR bez wymaganej liczby zatwierdzeń).
- [ ] Require status checks to pass: `Build i testy` (job z `ci.yml`), „Require branches to be up to date”.
- [ ] Block force pushes oraz deletions.
- [ ] Opcjonalnie: Require linear history, Require signed commits (commity w repo nie są obecnie podpisane: `verification.verified = false`).
- [ ] Opcjonalnie: „Do not allow bypassing the above settings”.

### 4.2. GitHub Environment `production`

- [ ] Deployment branches: tylko `main`.
- [ ] Required reviewers: właściciel (lub druga osoba).
- [ ] Przeniesienie sekretów produkcyjnych (Supabase, Firebase, klucze AI) z repozytoryjnych do Environment secrets, a następnie usunięcie wersji repozytoryjnych.
- [ ] Dopisanie w `main-deploy.yml` `environment: production` do jobów `deploy-backend` i `deploy-frontend` (osobny PR).

**Uwaga:** jeśli workflow odwoła się do nieistniejącego Environment `production`, GitHub utworzy go automatycznie **bez żadnych zabezpieczeń**. Dlatego `environment:` nie zostało jeszcze dodane do workflow. Najpierw utwórz i zabezpiecz Environment, potem dodaj odwołanie.

**Opcjonalny wariant:** rozdzielenie `deploy-backend` na job planujący (link, lista, dry-run) i job stosujący (`db push`, sekrety, funkcje) z `environment: production` tylko na drugim. Wtedy zatwierdzenie następuje **po** obejrzeniu dry-run, ale **przed** zmianą bazy.

### 4.3. Ustawienia Actions (Settings → Actions → General), do sprawdzenia w UI

- [ ] Workflow permissions: „Read repository contents and packages permissions” (workflow i tak deklarują `permissions:` jawnie).
- [ ] „Allow GitHub Actions to create and approve pull requests”: wyłączone.
- [ ] Polityka akcji: „Allow … selected actions”, wymagaj przypięcia do SHA, jeśli opcja jest dostępna.
- [ ] Fork pull requests: „Require approval for all outside collaborators”.

---

## 5. Co zostało zmienione w tej iteracji

Wyłącznie pliki w repozytorium (workflow, skrypty, dokumentacja). Ustawienia GitHub, sekrety, Environments i reguły ochrony brancha **nie** zostały zmienione.

---

**Powiązane dokumenty:**
- [Runbook wdrożenia produkcyjnego](./production-deployment-runbook.md)
- [CI/CD Pipeline](./ci-cd-pipeline.md)
