# Instalacja lokalnego backendu Supabase przez Docker Desktop

Ten dokument opisuje, jak uruchomić lokalny backend projektu PychaŚwiatowa przy użyciu Docker Desktop i Supabase CLI.

Instrukcja jest przygotowana pod to repozytorium. Projekt ma już gotową konfigurację w katalogu `supabase/`, migracje, seedy oraz funkcje Edge.

## Po co to jest potrzebne

W projekcie PychaŚwiatowa backend jest oparty o Supabase i obejmuje:

- bazę danych PostgreSQL,
- Supabase Auth,
- Supabase Storage,
- Supabase Studio,
- lokalne Edge Functions,
- seedy testowe do developmentu.

Frontend lokalnie jest skonfigurowany do pracy z adresem `http://127.0.0.1:54331`, więc po uruchomieniu lokalnego stosu Supabase aplikacja Angular powinna łączyć się z backendem bez dodatkowej konfiguracji.

## Wymagania

Przed rozpoczęciem upewnij się, że masz:

- zainstalowany `Docker Desktop`,
- uruchomiony `Docker Desktop`,
- włączony backend kontenerów Linux,
- `Node.js` i `npm`,
- `Supabase CLI`.

## Krok 1. Instalacja Docker Desktop

1. Pobierz Docker Desktop:
   [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Zainstaluj aplikację.
3. Uruchom Docker Desktop.
4. Poczekaj, aż Docker pokaże status gotowości.

Na Windows najlepiej używać silnika opartego o WSL2. Jeżeli Docker Desktop o to poprosi, zaakceptuj wymaganą konfigurację.

## Krok 2. Sprawdzenie Docker Desktop

W PowerShell uruchom:

```powershell
docker --version
docker ps
```

Jeżeli te komendy działają bez błędu, Docker jest gotowy.

## Krok 3. Instalacja Supabase CLI

`npm install -g supabase` nie jest wspierane i zakończy się błędem.

Na Windows użyj jednej z poniższych metod.

### Opcja A. `npx` bez instalacji globalnej

Najprostsza opcja:

```powershell
npx supabase --version
```

Potem zamiast `supabase start` używaj:

```powershell
npx supabase start
```

Analogicznie:

```powershell
npx supabase db reset
npx supabase status
npx supabase stop
```

### Opcja B. Lokalna instalacja w projekcie

Możesz też dodać CLI lokalnie do repozytorium:

```powershell
npm install --save-dev supabase
```

Wtedy uruchamiaj komendy przez:

```powershell
npx supabase --version
```

### Opcja C. Instalacja przez Scoop

Jeżeli chcesz mieć komendę `supabase` globalnie w systemie Windows, użyj wspieranego menedżera pakietów `Scoop`:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

Jeżeli wolisz inną metodę instalacji CLI, możesz użyć oficjalnej instrukcji:
[https://supabase.com/docs/guides/local-development/cli/getting-started](https://supabase.com/docs/guides/local-development/cli/getting-started)

## Krok 4. Instalacja zależności projektu

W katalogu repozytorium uruchom:

```powershell
npm install
```

## Krok 5. Start lokalnego Supabase

Przejdź do katalogu głównego projektu i uruchom:

```powershell
supabase start
```

Ta komenda pobierze wymagane obrazy Dockera i uruchomi lokalne usługi Supabase w kontenerach.

Przy pierwszym uruchomieniu może to potrwać kilka minut.

## Krok 6. Reset bazy, migracje i seedy

Repozytorium ma już skonfigurowane migracje i seedy w `supabase/config.toml`.

Aby odtworzyć lokalną bazę od zera i załadować dane developerskie, uruchom:

```powershell
supabase db reset
```

Ta komenda:

1. odtworzy lokalną bazę,
2. wykona wszystkie migracje z `supabase/migrations/`,
3. załaduje seedy z `supabase/seeds/`.

## Krok 7. Adresy i porty lokalnego środowiska

W tym projekcie lokalny Supabase używa następujących portów:

- API Supabase: `http://127.0.0.1:54331`
- PostgreSQL: `127.0.0.1:54332`
- Supabase Studio: `http://127.0.0.1:54333`
- Inbucket: `http://127.0.0.1:54334`

To jest zgodne z aktualną konfiguracją repozytorium.

## Krok 8. Uruchomienie frontendu

Po starcie Supabase możesz uruchomić frontend:

```powershell
npm start
```

Domyślnie Angular wystartuje lokalnie pod `http://localhost:4200`.

Pliki `src/environments/environment.ts` oraz `src/environments/environment.development.ts` są już ustawione na lokalny backend:

```ts
supabase: {
    url: 'http://127.0.0.1:54331'
}
```

Nie trzeba ręcznie zmieniać lokalnego URL Supabase.

## Krok 9. Dane testowe po seedach

Po `supabase db reset` baza powinna zawierać przykładowe dane developerskie, w tym testowych użytkowników i przykładowe przepisy.

W repo jest też opis seedów w `supabase/seeds/README.md`.

Przykładowe konta testowe:

- `test@pychaswiatowa.pl`
- `test2@pychaswiatowa.pl`

Jeżeli chcesz poznać szczegóły seedów albo dane testowe do logowania, sprawdź pliki w `supabase/seeds/`.

## Krok 10. Funkcje Edge

Projekt zawiera lokalne Edge Functions w katalogu `supabase/functions/`.

Po `supabase start` lokalny stack działa, ale podczas developmentu funkcje często uruchamia się dodatkowo komendą:

```powershell
supabase functions serve --env-file ./supabase/.env.local
```

Jeżeli chcesz uruchomić tylko konkretną funkcję, możesz podać jej nazwę, na przykład:

```powershell
supabase functions serve ai --env-file ./supabase/.env.local
```

## Krok 11. Lokalny plik sekretów dla AI

Część funkcji AI wymaga kluczy API. Utwórz plik:

`supabase/.env.local`

Przykładowa zawartość:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
GEMINI_API_KEY=AIza-your-gemini-api-key-here
```

Te wartości są potrzebne tylko wtedy, gdy chcesz lokalnie testować funkcje AI.

Jeżeli pracujesz tylko nad bazą, autoryzacją, Storage albo standardowymi endpointami, możesz ten krok pominąć.

## Krok 12. Przydatne komendy

Start lokalnego Supabase:

```powershell
supabase start
```

Zatrzymanie lokalnego Supabase:

```powershell
supabase stop
```

Sprawdzenie statusu:

```powershell
supabase status
```

Pełny reset lokalnej bazy:

```powershell
supabase db reset
```

## Najczęstszy scenariusz uruchomienia

Najczęściej wystarczy:

```powershell
npm install
supabase start
supabase db reset
npm start
```

## Rozwiązywanie problemów

### Docker Desktop nie działa

Sprawdź, czy Docker Desktop jest uruchomiony i czy nie ma błędów związanych z WSL2 albo wirtualizacją.

### Port jest zajęty

Jeżeli któryś z portów `54331-54334` jest już używany przez inny proces, Supabase może nie wystartować poprawnie. W takiej sytuacji:

1. zamknij konfliktujący proces,
2. uruchom ponownie `supabase start`.

### Po zmianach w migracjach dane się nie zgadzają

W developmentcie najprościej wykonać:

```powershell
supabase db reset
```

### Frontend nie łączy się z backendem

Sprawdź:

1. czy `supabase start` zakończył się sukcesem,
2. czy frontend działa na `http://localhost:4200`,
3. czy lokalny URL Supabase to `http://127.0.0.1:54331`,
4. czy Docker Desktop nadal działa.

## Podsumowanie

W tym repo lokalny backend Supabase uruchamia się przez Docker Desktop i `Supabase CLI`, bez potrzeby ręcznego stawiania osobno PostgreSQL, Auth czy Storage.

Minimalny zestaw komend do startu pracy to:

```powershell
supabase start
supabase db reset
npm start
```
