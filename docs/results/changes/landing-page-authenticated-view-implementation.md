# Implementacja Landing Page dla Zalogowanych Użytkowników - Raport Zmian

**Data:** 2025-12-13  
**US:** US-020 - Publiczne widoki w trybie zalogowanego  
**Zakres:** Landing Page, Explore, Public Recipe Detail

## 1. Przegląd Implementacji

Zaimplementowano mechanizm renderowania publicznych widoków (`/`, `/explore`, `/explore/recipes/:idslug`) w dwóch różnych layoutach w zależności od stanu uwierzytelnienia użytkownika:

- **Gość (niezalogowany):** `PublicLayoutComponent` z nagłówkiem zawierającym CTA "Zaloguj się" / "Zarejestruj się"
- **Zalogowany:** `MainLayoutComponent` (App Shell) z Sidebar, Topbar i profilem użytkownika

## 2. Zaimplementowane Pliki

### 2.1. Nowe Guardy Routingu

#### `src/app/core/guards/authenticated-match.guard.ts`
- Funkcyjny guard typu `CanMatchFn`
- Sprawdza czy użytkownik posiada aktywną sesję Supabase
- Zwraca `true` dla zalogowanych użytkowników
- Obsługuje błędy (fallback: traktuje jako niezalogowanego)

#### `src/app/core/guards/guest-only-match.guard.ts`
- Funkcyjny guard typu `CanMatchFn`
- Sprawdza czy użytkownik NIE posiada aktywnej sesji Supabase
- Zwraca `true` dla gości (niezalogowanych)
- Obsługuje błędy (fallback: pozwala na dostęp do publicznych tras)

### 2.2. Zmodyfikowane Pliki

#### `src/app/app.routes.ts`
**Zmiany:**
- Rozdzielenie tras na dwie grupy z użyciem `canMatch`
- Pierwsza grupa: `MainLayoutComponent` + `authenticatedMatchGuard` (zalogowani)
- Druga grupa: `PublicLayoutComponent` + `guestOnlyMatchGuard` (goście)
- Publiczne trasy (`/`, `/explore`, `/explore/recipes/:idslug`) są w obu grupach

**Struktura tras:**
```typescript
// Grupa dla zalogowanych
{
    path: '',
    component: MainLayoutComponent,
    canMatch: [authenticatedMatchGuard],
    children: [
        { path: '', component: LandingPageComponent },
        { path: 'explore', component: ExplorePageComponent },
        { path: 'explore/recipes/:idslug', component: PublicRecipeDetailPageComponent },
        // ... prywatne trasy (dashboard, recipes, collections, settings)
    ]
}

// Grupa dla gości
{
    path: '',
    component: PublicLayoutComponent,
    canMatch: [guestOnlyMatchGuard],
    children: [
        { path: '', component: LandingPageComponent },
        { path: 'explore', component: ExplorePageComponent },
        { path: 'explore/recipes/:idslug', component: PublicRecipeDetailPageComponent },
        { path: 'register', component: RegisterPageComponent },
        { path: 'login', component: LoginPageComponent },
    ]
}
```

#### `src/app/pages/landing/components/hero/hero.component.ts`
**Zmiany:**
- Dodano input signal `isAuthenticated` typu `boolean`
- Komponent teraz przyjmuje informację o statusie uwierzytelnienia z rodzica

#### `src/app/pages/landing/components/hero/hero.component.html`
**Zmiany:**
- Przyciski CTA ("Rozpocznij za darmo", "Zaloguj się") są owinięte w `@if (!isAuthenticated())`
- CTA są widoczne tylko dla gości

#### `src/app/pages/landing/landing-page.component.ts`
**Zmiany:**
- Dodano import `SupabaseService`
- Dodano signal `isAuthenticated` typu `boolean`
- Dodano metodę `checkAuthStatus()` wywoływaną w `ngOnInit()`
- Metoda sprawdza sesję przez `supabase.auth.getSession()`
- Signal `isAuthenticated` jest przekazywany do komponentu `pych-hero`

#### `src/app/pages/landing/landing-page.component.html`
**Zmiany:**
- Dodano binding `[isAuthenticated]="isAuthenticated()"` w `<pych-hero>`

#### `src/app/pages/explore/public-recipe-detail/public-recipe-detail-page.component.ts`
**Zmiany:**
- Dodano import `SupabaseService`
- Dodano readonly signal `isAuthenticated` typu `boolean`
- Dodano metodę `checkAuthStatus()` wywoływaną w `ngOnInit()`
- Metoda sprawdza sesję przez `supabase.auth.getSession()`

#### `src/app/pages/explore/public-recipe-detail/public-recipe-detail-page.component.html`
**Zmiany:**
- CTA w page header owinięte w `@if (!isAuthenticated())`
- Dolna sekcja CTA (karty z zachętą do rejestracji) owinięta w `@if (!isAuthenticated())`
- CTA są widoczne tylko dla gości

## 3. Logika Działania

### 3.1. Mechanizm Routingu z `canMatch`

1. Użytkownik wchodzi na `/`
2. Angular Router sprawdza kolejne grupy tras:
   - Pierwsza grupa: `authenticatedMatchGuard` sprawdza sesję
   - Jeśli sesja istnieje → dopasowanie grupy `MainLayoutComponent`
   - Jeśli sesja nie istnieje → guard zwraca `false`, router sprawdza kolejną grupę
   - Druga grupa: `guestOnlyMatchGuard` sprawdza brak sesji
   - Jeśli sesji nie ma → dopasowanie grupy `PublicLayoutComponent`

### 3.2. Ukrywanie CTA

**Landing Page:**
- `LandingPageComponent` w `ngOnInit()` sprawdza stan sesji
- Ustawia signal `isAuthenticated`
- Przekazuje wartość do `HeroComponent`
- `HeroComponent` warunkowo renderuje przyciski CTA

**Public Recipe Detail:**
- `PublicRecipeDetailPageComponent` w `ngOnInit()` sprawdza stan sesji
- Ustawia signal `isAuthenticated`
- Template warunkowo renderuje CTA w nagłówku i na dole strony

**Explore:**
- Komponent nie wymaga zmian (nie ma CTA)

## 4. Zgodność z Zasadami FE

### 4.1. Dozwolone Użycie Supabase (✅)
Implementacja używa wyłącznie dozwolonych operacji:
- `supabase.auth.getSession()` - weryfikacja sesji
- Brak bezpośrednich zapytań do bazy (`supabase.from()`)
- Brak wywołań RPC (`supabase.rpc()`)

### 4.2. Standardy Angular (✅)
- Guardy są funkcyjne (`CanMatchFn`), nie klasowe
- Komponenty używają signals dla stanu
- Komponenty używają `OnPush` change detection
- Brak side-effectów w guardach (tylko `true/false`)

### 4.3. Stylowanie i Loading States (✅)
- Brak "białego flasha" podczas ładowania (zachowanie poprzednich danych)
- Użycie `opacity: 0.5` podczas ładowania zamiast białych overlay
- Brak `rgba(255, 255, 255, 0.6)` w loading overlays

## 5. Testowanie

### 5.1. Weryfikacja Kompilacji
```bash
npm run build
```
**Rezultat:** ✅ Sukces, brak błędów

### 5.2. Weryfikacja Lintera
**Rezultat:** ✅ Brak błędów lintera w zmodyfikowanych plikach

### 5.3. Scenariusze do Przetestowania Manualnie

#### Scenariusz 1: Gość wchodzi na `/`
**Oczekiwane zachowanie:**
- Renderuje się `PublicLayoutComponent`
- Widoczny nagłówek z logo i CTA "Zaloguj się" / "Zarejestruj się"
- W Hero widoczne przyciski CTA
- Kliknięcie w CTA → przekierowanie do `/login` lub `/register`

#### Scenariusz 2: Zalogowany użytkownik wchodzi na `/`
**Oczekiwane zachowanie:**
- Renderuje się `MainLayoutComponent` (App Shell)
- Widoczny Sidebar z nawigacją
- Widoczny Topbar z profilem użytkownika
- W Hero BRAK przycisków CTA
- Możliwość nawigacji do `/dashboard`, `/recipes`, etc.

#### Scenariusz 3: Gość wchodzi na `/explore`
**Oczekiwane zachowanie:**
- Renderuje się `PublicLayoutComponent`
- Widoczny nagłówek z CTA
- Lista publicznych przepisów

#### Scenariusz 4: Zalogowany użytkownik wchodzi na `/explore`
**Oczekiwane zachowanie:**
- Renderuje się `MainLayoutComponent`
- Sidebar + Topbar widoczne
- Lista publicznych przepisów

#### Scenariusz 5: Gość wchodzi na `/explore/recipes/123-przepis`
**Oczekiwane zachowanie:**
- Renderuje się `PublicLayoutComponent`
- Widoczne CTA w page header
- Widoczna karta CTA na dole strony ("Chcesz zapisać ten przepis?")

#### Scenariusz 6: Zalogowany użytkownik wchodzi na `/explore/recipes/123-przepis`
**Oczekiwane zachowanie:**
- Renderuje się `MainLayoutComponent`
- BRAK CTA w page header
- BRAK karty CTA na dole strony

#### Scenariusz 7: Zalogowanie się podczas przeglądania `/`
**Oczekiwane zachowanie:**
- Po zalogowaniu użytkownik pozostaje na `/`
- Layout zmienia się z `PublicLayoutComponent` na `MainLayoutComponent`
- CTA znikają z Hero

#### Scenariusz 8: Wylogowanie się podczas przeglądania `/`
**Oczekiwane zachowanie:**
- Po wylogowaniu użytkownik pozostaje na `/`
- Layout zmienia się z `MainLayoutComponent` na `PublicLayoutComponent`
- CTA pojawiają się w Hero

## 6. Edge Cases i Obsługa Błędów

### 6.1. Błąd `getSession()`
- Guard: traktuje użytkownika jako niezalogowanego
- Komponent: ustawia `isAuthenticated = false`
- Logowanie do konsoli

### 6.2. Timeout `getSession()`
- Guard: fallback do `false` (niezalogowany)
- Umożliwia dostęp do publicznych tras

### 6.3. Sesja wygasa podczas przeglądania
- Użytkownik pozostaje w aktualnym layoutzie do momentu odświeżenia/nawigacji
- Po nawigacji guardy ponownie sprawdzą sesję

## 7. Potencjalne Usprawnienia (Opcjonalne)

### 7.1. Centralizacja Stanu Uwierzytelnienia
Zamiast sprawdzać sesję w każdym komponencie, można:
- Utworzyć `AuthService` z signalem `session`
- Aktualizować signal przez `onAuthStateChange`
- Guardy i komponenty używają tego samego signala
- Zmniejszy liczbę wywołań `getSession()`

### 7.2. Optymalizacja Guardów
- Cachowanie wyniku `getSession()` przez krótki czas (np. 100ms)
- Uniknie wielokrotnego wywołania API podczas jednej nawigacji

## 8. Podsumowanie

✅ **Zakończono implementację zgodnie z planem**

**Zaimplementowane funkcjonalności:**
1. Routing z `canMatch` dla zalogowanych i gości
2. Ukrywanie CTA w Landing Page (Hero)
3. Ukrywanie CTA w Public Recipe Detail
4. Weryfikacja sesji w guardach i komponentach
5. Obsługa błędów i edge cases

**Zgodność:**
- ✅ Plan implementacji
- ✅ Zasady FE (dozwolone użycie Supabase)
- ✅ Standardy Angular (signals, functional guards, OnPush)
- ✅ Brak błędów kompilacji i lintera

**Kolejne kroki:**
- Testowanie manualne wszystkich scenariuszy
- Weryfikacja UX (płynność przejść między layoutami)
- Opcjonalne: Implementacja centralizacji stanu uwierzytelnienia
