# Recipe AI Image on Create — wymagania

## Cel

Umożliwić użytkownikom z rolą `premium` (lub `admin`) **wygenerowanie zdjęcia AI już podczas tworzenia nowego przepisu** w formularzu `/recipes/new`, bez konieczności wcześniejszego zapisu przepisu i ponownego otwierania edycji.

## Kontekst architektury (istniejące założenia)

- Aplikacja SPA w Angular + Angular Material, podejście desktop-first (App Shell).
- Role użytkownika przenoszone w JWT jako claim `app_role` (`user`/`premium`/`admin`).
- Generowanie zdjęć AI istnieje już jako funkcja premium (model `gpt-image-1.5`) oraz jako endpoint Edge Function `POST /ai/recipes/image`, zwracający podgląd base64.
- Upload zdjęcia przepisu realizowany jest przez istniejący endpoint `POST /recipes/{id}/image` (multipart) i wymaga istnienia przepisu (ID).

## Problem do rozwiązania

Aktualnie w UI nie da się wygenerować zdjęcia AI w trakcie tworzenia przepisu. Użytkownik musi najpierw zapisać przepis, a dopiero potem wejść ponownie w edycję, aby uruchomić generowanie zdjęcia AI.

## Zakres (MVP dla tego ficzera)

### Wymagania funkcjonalne

- **FR-AIIMG-001 (dostępność w kreatorze)**: W formularzu tworzenia przepisu `/recipes/new` dostępny jest przycisk generowania zdjęcia AI (w sekcji „Zdjęcie”) dla roli `premium`/`admin`.
- **FR-AIIMG-002 (feature gating)**: Dla roli `user` przycisk AI jest niedostępny:
    - wariant A: ukryty,
    - wariant B (preferowany): widoczny, ale `disabled` z tooltipem „Funkcja Premium” + CTA do upgrade (jeśli istnieje w aplikacji).
- **FR-AIIMG-003 (źródło danych do generowania)**: Generowanie korzysta z **aktualnego stanu formularza** (również niezapisanych zmian), w szczególności: nazwa, opis, składniki, kroki, tagi oraz opcjonalna klasyfikacja.
- **FR-AIIMG-004 (doprecyzowanie opisu obrazka)**: Użytkownik może opcjonalnie doprecyzować wynik przez krótkie pole tekstowe (np. „Doprecyzuj opis obrazka”).
    - Pole jest opcjonalne; brak wartości nie blokuje generowania.
- **FR-AIIMG-005 (tryby generowania: auto / recipe-only / with-reference)**: UI obsługuje tryb `auto`:
    - jeśli dostępne jest zdjęcie referencyjne (wklejone/dodane w formularzu) — generowanie z referencją,
    - w przeciwnym razie — generowanie wyłącznie z treści przepisu.
- **FR-AIIMG-006 (podgląd + decyzja użytkownika)**: Po wygenerowaniu zdjęcia UI pokazuje podgląd i akcje:
    - „Użyj tego zdjęcia” (akceptacja),
    - „Wygeneruj ponownie” (regeneracja),
    - „Usuń” (odrzucenie podglądu).
- **FR-AIIMG-007 (brak zapisu po stronie backendu przed `POST /recipes`)**: Wygenerowane zdjęcie przed zapisem przepisu jest trzymane **tymczasowo w stanie formularza** (frontend) i **nie jest** uploadowane do Storage przed powstaniem przepisu.
- **FR-AIIMG-008 (upload po utworzeniu przepisu)**: Po kliknięciu „Zapisz” i udanym `POST /recipes`:
    - jeśli użytkownik zaakceptował wygenerowane zdjęcie, aplikacja uploaduje je przez `POST /recipes/{id}/image`,
    - upload zdjęcia nie może blokować samego utworzenia przepisu (rekomendacja: wykonać upload po otrzymaniu `201 Created`; w razie błędu uploadu pokazać komunikat i umożliwić ponowienie z poziomu edycji).
- **FR-AIIMG-009 (odświeżenie / nawigacja wstecz)**: Odświeżenie strony lub opuszczenie formularza przed zapisem może spowodować utratę tymczasowego zdjęcia (zgodnie z założeniem). UI powinno ostrzegać o niezapisanych zmianach.
- **FR-AIIMG-010 (cooldown)**: Po wygenerowaniu zdjęcia UI wprowadza krótki cooldown (np. 20–30 sekund) lub inny limit UX, aby ograniczyć przypadkowe wielokrotne uruchomienia (koszt).

### Poza zakresem (explicitly out-of-scope)

- Serwerowe przechowywanie tymczasowych obrazów dla niezapisanych przepisów.
- Przywracanie wygenerowanego obrazu po odświeżeniu strony.
- Historia wielu wygenerowanych wariantów (galeria) — w MVP wystarczy ostatni wynik + regeneracja.
- Zmiany w modelu danych `recipes` (np. nowe kolumny pod prompt) — w MVP nie wymagane.

## User stories

### US-AIIMG-001 — Generowanie zdjęcia AI w trakcie tworzenia nowego przepisu

Jako **użytkownik premium** chcę wygenerować zdjęcie AI podczas tworzenia nowego przepisu, aby od razu zobaczyć i wybrać ilustrację bez zapisywania przepisu „na pusto” i wracania do edycji.

**Kryteria akceptacji:**

- Na `/recipes/new` widzę przycisk AI przy sekcji zdjęcia (tylko `premium`/`admin`; dla `user` niedostępny zgodnie z FR-AIIMG-002).
- Po kliknięciu AI mogę (opcjonalnie) doprecyzować opis obrazka.
- Widzę loader w trakcie generowania.
- Po sukcesie widzę podgląd + akcje: „Użyj”, „Wygeneruj ponownie”, „Usuń”.
- Po „Użyj” zdjęcie jest ustawione jako główne zdjęcie w formularzu (stan „tymczasowy” do czasu zapisu).
- Po udanym zapisie przepisu zdjęcie zostaje uploadowane i jest widoczne na szczegółach/edycji przepisu.

### US-AIIMG-002 — Generowanie z referencją bez zapisanego przepisu

Jako **użytkownik premium** chcę móc wkleić/dodać zdjęcie referencyjne w formularzu nowego przepisu i wygenerować na jego podstawie nowe zdjęcie, aby uzyskać lepszy efekt bez konieczności wcześniejszego zapisu.

**Kryteria akceptacji:**

- W formularzu `/recipes/new` mogę dodać zdjęcie (np. paste/drop) jako referencję.
- UI informuje, że generowanie użyje referencji (tryb `auto` -> `with_reference`).
- Wygenerowane zdjęcie nie jest kopią referencji (nowa fotografia/ujęcie).

## Wymagania niefunkcjonalne

- **Bezpieczeństwo**: Serwer musi egzekwować feature gating (403 dla nie-premium) niezależnie od UI.
- **Koszty i limity**: Po stronie backendu powinien istnieć rate limit na generowanie (per user).
- **UX**: Brak blokowania tworzenia przepisu przez ewentualne problemy z uploadem zdjęcia; komunikaty błędów muszą być czytelne.

