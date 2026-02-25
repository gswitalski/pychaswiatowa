# Instrukcja: dodawanie kolejnej strony ze statyczną treścią

Minimalny proces dla nowej strony (np. „O nas”) w obecnym mechanizmie.

## 1) Gdzie trzymać treść

- Plik źródłowy (edytowany przez zespół): `doc/<nazwa>.md`
- Plik renderowany przez aplikację: `public/assets/legal/<nazwa>.md`

Przykład:
- `doc/o-nas.md`
- `public/assets/legal/o-nas.md`

## 2) Jak podpiąć synchronizację pliku

W `scripts/sync-legal-terms.mjs` dodaj wpis w `legalAssetsToSync`:
- `sourcePath`: ścieżka do `doc/<nazwa>.md`
- `targetPath`: ścieżka do `public/assets/legal/<nazwa>.md`

Następnie uruchom:
- `npm run sync:legal`

## 3) Jaka opcja wyświetla treść (mapowanie page -> plik)

W `src/app/pages/legal/legal-page.component.html`:
- dodaj nowy `@case ('<pageId>')`,
- w nim użyj:
  - `<pych-legal-markdown-viewer [assetPath]="'/assets/legal/<nazwa>.md'" [documentName]="'<nazwa dokumentu w dopełniaczu>'" />`

Przykład:
- `@case ('about')` -> `'/assets/legal/o-nas.md'`

## 4) Jak udostępnić stronę pod URL

W `src/app/app.routes.ts` dodaj trasę `path` w obu grupach routingu (dla zalogowanego i gościa):
- `path: 'about'` (lub inny docelowy URL),
- `loadComponent: LegalPageComponent`,
- `data.page: '<pageId>'` (musi pasować do `@case`),
- `data.title: '<Tytuł strony>'`.

## 5) (Opcjonalnie) link w UI

Jeśli strona ma być widoczna w stopce:
- dodaj link w `src/app/shared/components/footer/footer.component.ts`.

## 6) Szybki check po wdrożeniu

- `npm run sync:legal`
- uruchom aplikację i wejdź na nowy URL
- potwierdź: tytuł strony, render markdown, brak błędu ładowania
