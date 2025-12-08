# Konfiguracja zmiennych środowiskowych dla testów

## Dla testów E2E

Utwórz plik `.env.local` w głównym katalogu projektu:

```bash
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
BASE_URL=http://localhost:4200
```

### Jak utworzyć plik .env.local

#### Windows (PowerShell)
```powershell
New-Item -Path .env.local -ItemType File
notepad .env.local
```

#### Linux/Mac
```bash
touch .env.local
nano .env.local
```

Następnie wklej powyższe zmienne i zapisz plik.

## Uwagi

- Plik `.env.local` jest ignorowany przez git (jest w .gitignore)
- Nie commituj tego pliku z rzeczywistymi danymi logowania
- Dla testów lokalnych możesz użyć konta testowego z bazy danych development
- Dla CI/CD użyj GitHub Secrets do przechowywania tych wartości

