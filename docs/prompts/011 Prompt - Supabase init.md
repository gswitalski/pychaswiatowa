# Supabase Angular Initialization

Ten dokument zawiera przewodnik do utworzenia struktury plików niezbędnej do integracji Supabase z projektem Angular.

## Wymagania wstępne

- Projekt powinien używać Angular 19 i TypeScript 5
- Zainstaluj pakiet `@supabase/supabase-js`
- Upewnij się, że plik `/supabase/config.toml` istnieje
- Upewnij się, że plik `/src/types/database.types.ts` istnieje i zawiera poprawne definicje typów dla bazy danych

**WAŻNE:** Sprawdź wymagania wstępne przed wykonaniem poniższych kroków. Jeśli nie są spełnione, zatrzymaj się i zapytaj użytkownika o rozwiązanie.

## Struktura plików i konfiguracja

### 1. Konfiguracja środowisk (Environments)

Utwórz katalog `/src/environments/` oraz pliki konfiguracyjne:

**Plik `/src/environments/environment.ts`:**

```ts
export const environment = {
  production: false,
  supabase: {
    url: 'http://127.0.0.1:54321',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  }
};
```

**Plik `/src/environments/environment.development.ts`:**

```ts
export const environment = {
  production: false,
  supabase: {
    url: 'http://127.0.0.1:54321',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  }
};
```

**Plik `/src/environments/environment.production.ts`:**

```ts
export const environment = {
  production: true,
  supabase: {
    url: 'YOUR_PRODUCTION_SUPABASE_URL',
    anonKey: 'YOUR_PRODUCTION_SUPABASE_ANON_KEY'
  }
};
```

Te pliki zawierają konfigurację URL i klucza anonimowego dla Supabase. Wartości dla środowiska lokalnego (development) to standardowe wartości z lokalnej instancji Supabase. W środowisku produkcyjnym należy zastąpić je rzeczywistymi wartościami.

### 2. Inicjalizacja klienta Supabase

Utwórz katalog `/src/app/core/services/` oraz plik serwisu:

**Plik `/src/app/core/services/supabase.service.ts`:**

```ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import type { Database } from '../../../types/database.types';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    this.supabase = createClient<Database>(
      environment.supabase.url,
      environment.supabase.anonKey
    );
  }

  get client(): SupabaseClient<Database> {
    return this.supabase;
  }

  get auth() {
    return this.supabase.auth;
  }

  get from() {
    return this.supabase.from.bind(this.supabase);
  }
}
```

Ten serwis inicjalizuje klienta Supabase i udostępnia go w całej aplikacji poprzez system Dependency Injection w Angular. Serwis używa `providedIn: 'root'`, co sprawia, że jest singletonem dostępnym globalnie.

### 3. Konfiguracja Angular.json

Upewnij się, że w pliku `angular.json` skonfigurowano wymianę plików środowiskowych:

```json
"configurations": {
  "production": {
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.production.ts"
      }
    ],
    ...
  },
  "development": {
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.development.ts"
      }
    ]
  }
}
```

### 4. Przykład użycia

**W komponencie:**

```ts
import { Component, inject, OnInit } from '@angular/core';
import { SupabaseService } from './core/services/supabase.service';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `...`
})
export class ExampleComponent implements OnInit {
  private supabase = inject(SupabaseService);

  async ngOnInit() {
    // Przykład: pobieranie danych
    const { data, error } = await this.supabase
      .from('songs')
      .select('*');
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Songs:', data);
  }

  // Przykład: autentykacja
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { data, error };
  }
}
```

### 5. Opcjonalnie: Guard dla chronionych tras

Możesz stworzyć guard do ochrony tras wymagających autentykacji:

**Plik `/src/app/core/guards/auth.guard.ts`:**

```ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};
```

**Użycie w routingu:**

```ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component')
  }
];
```

## Notatki

- Serwis `SupabaseService` jest singletonem dostępnym w całej aplikacji
- Używaj funkcji `inject()` zamiast konstruktora dla Dependency Injection (zgodnie z najnowszymi praktykami Angular)
- Wszystkie operacje na bazie danych są w pełni typowane dzięki importowi `Database` z `database.types.ts`
- Klient Supabase jest dostępny przez właściwość `client` w serwisie, ale możesz też używać skrótów `auth` i `from` dla wygody
- Guard `authGuard` jest funkcyjnym guardem (zgodnie z najnowszymi praktykami Angular 19)
