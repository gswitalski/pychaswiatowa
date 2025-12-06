# Instrukcja Bootstrapowania Aplikacji Frontendowej - PychaŚwiatowa

## Wymagania wstępne

Przed rozpoczęciem upewnij się, że masz zainstalowane następujące narzędzia:

- **Node.js** (wersja 20.x lub nowsza) - [Pobierz z nodejs.org](https://nodejs.org/)
- **npm** (zazwyczaj dołączony do Node.js) lub **yarn**
- **Angular CLI** (zostanie zainstalowany globalnie w kroku 1)

## Krok 1: Instalacja Angular CLI

Otwórz terminal w katalogu głównym projektu i wykonaj:

```bash
npm install -g @angular/cli@20
```

Lub jeśli używasz yarn:

```bash
yarn global add @angular/cli@20
```

Weryfikacja instalacji:

```bash
ng version
```

## Krok 2: Utworzenie nowego projektu Angular w bieżącym katalogu

W katalogu głównym projektu (`c:\dev\pychaswiatowa`) wykonaj:

```bash
ng new . --routing --style=scss --standalone --skip-git
```

**Uwaga:** Użycie `.` jako nazwy projektu spowoduje utworzenie aplikacji Angular bezpośrednio w bieżącym katalogu, bez tworzenia podkatalogu.

**Wyjaśnienie parametrów:**
- `.` - tworzy projekt w bieżącym katalogu (zamiast w podkatalogu)
- `--routing` - dodaje moduł routingu
- `--style=scss` - używa SCSS jako preprocesora stylów
- `--standalone` - tworzy projekt z komponentami standalone (bez NgModules)
- `--skip-git` - pomija inicjalizację git (jeśli już masz repozytorium)

**Odpowiedzi na pytania CLI:**
- Czy chcesz dodać Angular routing? → **Tak** (już dodane przez `--routing`)
- Który styl chcesz użyć? → **SCSS** (już ustawione przez `--style=scss`)
- Czy chcesz włączyć Server-Side Rendering (SSR) i Static Site Generation (SSG/Prerendering)? → **N** (Nie)

**Uwaga dotycząca SSR/SSG:**
Dla wersji MVP odpowiadamy **N** (Nie), ponieważ:
- Aplikacja wymaga autentykacji i zawiera prywatne dane użytkowników
- SSR/SSG dodaje niepotrzebną złożoność na początku projektu
- SEO nie jest priorytetem dla aplikacji wymagającej logowania
- SSR/SSG można dodać później, jeśli będzie potrzebne

**Alternatywnie** (jeśli Angular CLI zapyta o nadpisanie istniejących plików):
Jeśli w katalogu znajdują się już pliki (np. `README.md`, `docs/`, `supabase/`), Angular CLI może zapytać o nadpisanie. W takim przypadku możesz:
- Wybrać opcję, aby nie nadpisywać istniejących plików
- Lub ręcznie przenieść istniejące pliki przed utworzeniem projektu

## Krok 3: Instalacja Angular Material

Po utworzeniu projektu (już jesteś w odpowiednim katalogu), zainstaluj Angular Material:

```bash
ng add @angular/material
```

**Odpowiedzi na pytania podczas instalacji:**
- Wybierz motyw: **Custom** (lub wybierz jeden z predefiniowanych, np. Indigo/Pink)
- Czy chcesz skonfigurować animacje? → **Tak**
- Czy chcesz skonfigurować typografię? → **Tak**

## Krok 4: Konfiguracja struktury projektu

### 4.1. Utworzenie podstawowej struktury katalogów

W katalogu `src/app/` utwórz następującą strukturę:

```bash
mkdir -p src/app/core/services
mkdir -p src/app/core/models
mkdir -p src/app/core/interceptors
mkdir -p src/app/shared/services
mkdir -p src/app/shared/models
mkdir -p src/app/layout
mkdir -p src/app/pages
```

**Uwaga dla Windows PowerShell:**
```powershell
New-Item -ItemType Directory -Path "src/app/core/services" -Force
New-Item -ItemType Directory -Path "src/app/core/models" -Force
New-Item -ItemType Directory -Path "src/app/core/interceptors" -Force
New-Item -ItemType Directory -Path "src/app/shared/services" -Force
New-Item -ItemType Directory -Path "src/app/shared/models" -Force
New-Item -ItemType Directory -Path "src/app/layout" -Force
New-Item -ItemType Directory -Path "src/app/pages" -Force
```

### 4.2. Konfiguracja Angular Material

Utwórz plik `src/app/shared/material/material.module.ts` (nawet w projekcie standalone, będzie to pomocne do organizacji importów):

```typescript
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const materialProviders = [
    provideAnimationsAsync()
];
```

## Krok 5: Konfiguracja środowisk

### 5.1. Utworzenie plików środowiskowych

Zaktualizuj pliki w `src/environments/`:

**src/environments/environment.ts** (development):
```typescript
export const environment = {
    production: false,
    supabaseUrl: 'YOUR_SUPABASE_URL',
    supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

**src/environments/environment.prod.ts** (production):
```typescript
export const environment = {
    production: true,
    supabaseUrl: 'YOUR_SUPABASE_URL',
    supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

**Uwaga:** Zastąp `YOUR_SUPABASE_URL` i `YOUR_SUPABASE_ANON_KEY` rzeczywistymi wartościami z projektu Supabase.

## Krok 6: Instalacja zależności Supabase

```bash
npm install @supabase/supabase-js
```

Lub z yarn:

```bash
yarn add @supabase/supabase-js
```

## Krok 7: Konfiguracja TypeScript paths (opcjonalne, ale zalecane)

W pliku `tsconfig.json` dodaj ścieżki aliasów:

```json
{
  "compilerOptions": {
    "paths": {
      "@core/*": ["src/app/core/*"],
      "@shared/*": ["src/app/shared/*"],
      "@pages/*": ["src/app/pages/*"],
      "@environments/*": ["src/environments/*"]
    }
  }
}
```

## Krok 8: Utworzenie podstawowego serwisu Supabase

Utwórz plik `src/app/core/services/supabase.service.ts`:

```typescript
import { inject, Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    private readonly supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(
            environment.supabaseUrl,
            environment.supabaseAnonKey
        );
    }

    get client(): SupabaseClient {
        return this.supabase;
    }
}
```

## Krok 9: Konfiguracja głównego komponentu aplikacji

Zaktualizuj `src/app/app.config.ts` (lub `app.config.ts` w zależności od wersji Angular):

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),
        provideHttpClient(withInterceptorsFromDi()),
        provideAnimationsAsync()
    ]
};
```

## Krok 10: Weryfikacja instalacji

Uruchom serwer deweloperski:

```bash
ng serve
```

Lub z określonym portem:

```bash
ng serve --port 4200
```

Otwórz przeglądarkę i przejdź do `http://localhost:4200`. Powinieneś zobaczyć domyślną stronę Angular.

## Krok 11: Konfiguracja lintowania i formatowania (opcjonalne, ale zalecane)

### 11.1. Instalacja ESLint (jeśli nie jest już zainstalowany)

```bash
ng add @angular-eslint/schematics
```

### 11.2. Instalacja Prettier (opcjonalne)

```bash
npm install --save-dev prettier
```

Utwórz plik `.prettierrc` w katalogu głównym:

```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 4,
  "semi": true,
  "printWidth": 100
}
```

## Krok 12: Utworzenie pierwszego komponentu zgodnego z konwencjami projektu

Przykład utworzenia komponentu z prefiksem `pych`:

```bash
ng generate component shared/components/example --standalone --prefix pych
```

**Uwaga:** Zgodnie z zasadami projektu, wszystkie selektory komponentów powinny mieć prefiks `pych`.

## Podsumowanie

Po wykonaniu wszystkich kroków powinieneś mieć:

✅ Działającą aplikację Angular 20 z routingiem  
✅ Skonfigurowany Angular Material  
✅ Podstawową strukturę katalogów zgodną z architekturą projektu  
✅ Skonfigurowane środowiska (dev/prod)  
✅ Zainstalowany i skonfigurowany klient Supabase  
✅ Gotową bazę do dalszego rozwoju  

## Następne kroki

1. Skonfiguruj połączenie z Supabase (dodaj rzeczywiste klucze API)
2. Utwórz moduły autentykacji (logowanie/rejestracja)
3. Zaimplementuj podstawowe komponenty zgodnie z PRD
4. Skonfiguruj routing dla głównych stron aplikacji

## Przydatne komendy Angular CLI

- `ng generate component <nazwa>` - tworzy nowy komponent
- `ng generate service <nazwa>` - tworzy nowy serwis
- `ng generate guard <nazwa>` - tworzy nowy guard
- `ng build` - buduje aplikację produkcyjną
- `ng test` - uruchamia testy jednostkowe
- `ng lint` - uruchamia linter

## Rozwiązywanie problemów

### Problem: Błąd podczas instalacji Angular CLI
**Rozwiązanie:** Upewnij się, że używasz Node.js w wersji 20.x lub nowszej.

### Problem: Błąd podczas instalacji Angular Material
**Rozwiązanie:** Upewnij się, że projekt Angular został poprawnie utworzony w bieżącym katalogu i że plik `angular.json` istnieje.

### Problem: Angular CLI pyta o nadpisanie istniejących plików
**Rozwiązanie:** Jeśli masz już pliki w katalogu (np. `README.md`), możesz:
- Wybrać opcję, aby nie nadpisywać istniejących plików podczas tworzenia projektu
- Lub tymczasowo przenieść ważne pliki do innego katalogu, a następnie je przywrócić

### Problem: Błąd kompilacji TypeScript
**Rozwiązanie:** Sprawdź, czy wszystkie zależności są zainstalowane (`npm install`) i czy pliki środowiskowe są poprawnie skonfigurowane.

