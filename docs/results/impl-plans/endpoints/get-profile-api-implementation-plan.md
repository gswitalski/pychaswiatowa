# API Endpoint Implementation Plan: GET /profile

## 1. Przegląd punktu końcowego
Ten punkt końcowy umożliwia uwierzytelnionemu użytkownikowi pobranie podstawowych informacji o swoim profilu, takich jak unikalny identyfikator i nazwa użytkownika. Jest to operacja tylko do odczytu, kluczowa dla personalizacji interfejsu użytkownika.

## 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/profile`
- **Parametry**:
  - **Wymagane**: Brak parametrów w ścieżce, query stringu czy ciele żądania. Wymagany jest nagłówek `Authorization: Bearer <JWT_TOKEN>`.
  - **Opcjonalne**: Brak.
- **Request Body**: Brak.

## 3. Wykorzystywane typy
- **`ProfileDto`**: Obiekt transferu danych używany do strukturyzacji odpowiedzi.
  ```typescript
  interface ProfileDto {
    id: string;
    username: string;
  }
  ```

## 4. Szczegóły odpowiedzi
- **Odpowiedź sukcesu (200 OK)**:
  ```json
  {
    "id": "a1b2c3d4-...",
    "username": "john.doe"
  }
  ```
- **Odpowiedzi błędów**:
  - `401 Unauthorized`: Gdy token JWT jest nieprawidłowy, wygasł lub go brakuje.
  - `404 Not Found`: Gdy uwierzytelniony użytkownik nie ma jeszcze utworzonego profilu w tabeli `profiles`.
  - `500 Internal Server Error`: W przypadku nieoczekiwanych błędów serwera.

## 5. Przepływ danych
1.  Żądanie `GET` dociera do Supabase Edge Function dla ścieżki `/profile`.
2.  Główny router (`index.ts`) przekazuje żądanie do handlera odpowiedzialnego za ten endpoint (`profile.handlers.ts`).
3.  Middleware lub dedykowana funkcja weryfikuje token JWT z nagłówka `Authorization`. Jeśli token jest nieprawidłowy, zwracany jest błąd `401`.
4.  Z tokenu JWT wyodrębniany jest identyfikator użytkownika (`user_id`).
5.  Handler wywołuje funkcję `getProfileByUserId(userId)` z warstwy serwisowej (`profile.service.ts`).
6.  Funkcja serwisowa wykonuje zapytanie `SELECT id, username FROM profiles WHERE id = userId` do bazy danych Supabase.
7.  Jeśli zapytanie nie zwróci żadnego rekordu, serwis rzuca błąd `ApplicationError` z kodem `NOT_FOUND`.
8.  Handler przechwytuje błąd i zwraca odpowiedź z kodem statusu `404 Not Found`.
9.  Jeśli dane zostaną pomyślnie pobrane, serwis zwraca obiekt `ProfileDto`.
10. Handler formatuje odpowiedź HTTP z kodem `200 OK` i zwraca obiekt `ProfileDto` w ciele odpowiedzi.

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: Dostęp do punktu końcowego jest bezwzględnie chroniony i wymaga prawidłowego tokenu JWT. Każde żądanie bez ważnego tokenu zostanie odrzucone.
- **Autoryzacja**: Polityki RLS (Row Level Security) w Supabase na tabeli `profiles` muszą być skonfigurowane tak, aby zezwalać użytkownikowi na odczyt wyłącznie własnego wiersza (`USING (auth.uid() = id)`).
- **Walidacja**: Nie ma danych wejściowych od użytkownika do walidacji, co zmniejsza ryzyko ataków typu injection.

## 7. Rozważania dotyczące wydajności
- **Zapytanie do bazy danych**: Zapytanie jest bardzo proste i operuje na kluczu głównym (`id`), co zapewnia wysoką wydajność. Należy upewnić się, że na kolumnie `id` tabeli `profiles` istnieje indeks (co jest domyślne dla klucza głównego).
- **Rozmiar odpowiedzi**: Zwracany ładunek jest minimalny (tylko `id` i `username`), co zapewnia szybki transfer danych.
- **Zimny start (Cold Start)**: Czas pierwszego uruchomienia funkcji Supabase może być dłuższy. W kontekście tej operacji nie jest to krytyczny problem.

## 8. Etapy wdrożenia
1.  **Struktura plików**: Utwórz nową funkcję Supabase `profile` zgodnie z architekturą opisaną w `.cursor/rules/backend.mdc`:
    ```
    supabase/functions/profile/
      ├── index.ts
      ├── profile.handlers.ts
      └── profile.service.ts
    ```
2.  **Definicja typu**: W pliku `shared/contracts/types.ts` upewnij się, że istnieje lub dodaj typ `ProfileDto`.
3.  **Warstwa serwisowa (`profile.service.ts`)**:
    -   Zaimplementuj funkcję `getProfileByUserId(supabaseClient, userId)`.
    -   Funkcja powinna wykonywać zapytanie `select('id, username')` do tabeli `profiles` z filtrem `.eq('id', userId)`.
    -   Jeśli dane nie zostaną znalezione (`data` jest `null` lub puste), rzuć `ApplicationError` z typem `NOT_FOUND`.
    -   W przypadku sukcesu, zwróć pobrane dane jako `ProfileDto`.
4.  **Warstwa handlera (`profile.handlers.ts`)**:
    -   Zaimplementuj `handleGetProfile(req)`.
    -   Pobierz `supabaseClient` i `user` z `req`.
    -   Wywołaj `profileService.getProfileByUserId` z `user.id`.
    -   Zwróć odpowiedź `200 OK` z danymi z serwisu lub odpowiedni kod błędu w bloku `catch`.
    -   Stwórz i wyeksportuj router, który mapuje metodę `GET` na `handleGetProfile`.
5.  **Router główny (`index.ts`)**:
    -   Zaimportuj router z `profile.handlers.ts`.
    -   Skonfiguruj główny serwer Deno do obsługi żądań i przekazywania ich do routera.
    -   Zaimplementuj globalną obsługę błędów, która mapuje `ApplicationError` na odpowiednie odpowiedzi HTTP.
6.  **Polityki RLS**: W panelu Supabase lub w migracji SQL, zweryfikuj lub dodaj politykę RLS dla tabeli `profiles`, która pozwala na operacje `SELECT` tylko dla właściciela rekordu.
    ```sql
    CREATE POLICY "Enable read access for authenticated users on their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);
    ```
7.  **Testowanie**: Uruchom funkcję lokalnie (`supabase functions serve profile`) i przetestuj endpoint za pomocą narzędzia API (np. Postman), używając prawidłowego tokenu JWT. Sprawdź scenariusze sukcesu i błędów (brak tokenu, nieistniejący profil).
