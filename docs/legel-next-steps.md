# Treści prawne — co zostało do zrobienia

Jedynym źródłem treści publicznych jest `public/assets/legal/`.
Poniżej są tylko sprawy, których nie da się domknąć bez danych firmy, decyzji biznesowej albo prawnika.
Placeholdery w dokumentach zostały celowo.

## 1. Dane firmy — uzupełnić te same wartości we wszystkich plikach

| Placeholder | Gdzie |
|---|---|
| `\<NAZWA_FIRMY\>`, `\<ADRES\>`, `\<NIP\>`, `\<EMAIL\>` | `terms.md` (sekcje 2.1, 13.3, 14.1), `privacy.md` (sekcje 1.1, 1.2, 8, 14.2, 16), `publisher.md`, `subscription-terms.md` (anulowanie, zwroty, odstąpienie) |
| `\<FORMA_PRAWNA\>` | tylko `publisher.md` |
| `\<REGON — JEŚLI DOTYCZY\>` | `publisher.md` |
| `\<NUMER_WPISU LUB STOSOWNA INFORMACJA\>` | `publisher.md` |
| `\<TELEFON — OPCJONALNIE\>` | `publisher.md` |

`terms.md` i `privacy.md` mają już na sztywno „jednoosobowa działalność gospodarcza (JDG)”.
`publisher.md` nadal ma `\<FORMA_PRAWNA\>`.
Przy uzupełnianiu trzeba wybrać jedną formę i wpisać ją tak samo w trzech plikach.

Na stronie wydawcy brakuje daty uruchomienia serwisu (art. 5 ustawy o świadczeniu usług drogą elektroniczną, lista z planu reorganizacji).
Dopisać ją razem z danymi firmy.

Adres w checkoutcie anulowania to osobny placeholder w kodzie, nie w Markdownie:
`SUPPORT_EMAIL` w `src/app/pages/checkout/checkout.constants.ts` ma wartość `TODO@ustalic-przed-wdrozeniem`.
Po ustaleniu e-maila wpisać ten sam adres tutaj i w placeholdery `\<EMAIL\>`.

## 2. Operator płatności

W `privacy.md`, sekcja 5.5, został `\<OPERATOR_PŁATNOŚCI\>`.
Checkout już kieruje na Stripe (`checkout.stripe.com`) i pisze o płatności przez Stripe.
Po potwierdzeniu, że operatorem zostaje Stripe, zastąpić placeholder nazwą podmiotu (Stripe) i sprawdzić, czy opis w polityce zgadza się z tym, jakie dane faktycznie do niego trafiają.

## 3. Prawo odstąpienia

Część C w `subscription-terms.md` jest roboczym wzorem.
Przed startem sprzedaży ma ją sprawdzić prawnik i potwierdzić, że zgadza się z checkoutem.
Checkout już ma checkbox rezygnacji z prawa odstąpienia przy natychmiastowym dostępie do treści cyfrowej oraz akceptację regulaminu subskrypcji.
Do weryfikacji jest treść tych zgód, a nie sam fakt ich istnienia.

## 4. Rzeczy zależne od późniejszego kodu

- Grace period w regulaminie subskrypcji wynosi 3 dni, tak jak domyślne `BILLING_EXPIRY_GRACE_DAYS`.
  Zmiana tej zmiennej środowiskowej wymaga zmiany tego zdania w `subscription-terms.md`.
- Regulamin mówi, że przy nieudanej płatności odnowienia użytkownik zostanie poinformowany e-mailem, jeżeli to możliwe.
  Wysyłka tego maila jest w zakresie PS-67. Po wdrożeniu maila warto doprecyzować zdanie.
- W ustawieniach konta nie ma jeszcze anulowania subskrypcji ani zmiany planu.
  FAQ cennika tego nie obiecuje. Regulamin subskrypcji dopuszcza anulowanie w ustawieniach tylko wtedy, gdy taka funkcja jest dostępna, a w przeciwnym razie przez `\<EMAIL\>`.
  Gdy pojawi się samodzielna obsługa w ustawieniach, zaktualizować FAQ i sekcję 5 regulaminu subskrypcji.
- Usunięty przepis znika z serwisu, ale rekord z `deleted_at` zostaje w bazie. Nie ma automatycznego kasowania po 30 dniach.
  Polityka prywatności to opisuje. Jeśli zapadnie decyzja o trwałym usuwaniu po określonym czasie, najpierw trzeba to wdrożyć, potem zmienić pkt 7 sekcji 7 w `privacy.md`.
  Zdanie o kopiach zapasowych (do 30 dni) dotyczy backupów, nie soft delete.

## 5. Stare opisy, które wskazują złą ścieżkę

W drzewie roboczym nie ma już `docs/legal-documents/` ani `scripts/sync-legal-terms.mjs`.
Dwa opisy nadal każą edytować stare duplikaty i synchronizować je do `public/assets/legal/`:

- `docs/results/project-summary.md` — wiersz o regulaminie i syncu z `docs/legal-documents`
- `docs/results/new-features/user-stories/PS-66/PS-66-checkout-payments-deployment-plan.md` — krok o uzupełnianiu regulaminu subskrypcji w `docs/legal-documents`

Te zdania trzeba poprawić, żeby nikt nie odtworzył drugiego źródła treści.
Edytować wyłącznie pliki w `public/assets/legal/` i przy zmianie treści aktualizować datę „Ostatnia aktualizacja”.
