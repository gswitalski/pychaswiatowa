# Stos Technologiczny Projektu PychaŚwiatowa

Poniższy dokument opisuje architekturę i technologie wybrane do budowy aplikacji PychaŚwiatowa.

## Frontend

Aplikacja kliencka zostanie zbudowana jako Single Page Application (SPA) w oparciu o nowoczesne i sprawdzone technologie, co zapewni jej wydajność, responsywność i łatwość w utrzymaniu.

*   **Angular 20:** Główny framework aplikacyjny. Jego komponentowa architektura, silne typowanie dzięki TypeScript oraz wbudowane mechanizmy do zarządzania stanem i routingiem pozwolą na stworzenie ustrukturyzowanej i skalowalnej aplikacji.
*   **TypeScript:** Język programowania, który rozszerza JavaScript o statyczne typowanie. Zwiększy to bezpieczeństwo kodu, ułatwi refaktoryzację i współpracę oraz pomoże wyłapywać błędy na wczesnym etapie rozwoju.
*   **Sass:** Preprocesor CSS, który wzbogaci standardowe arkusze stylów o zmienne, zagnieżdżenia i mixiny. Umożliwi to tworzenie czystszego, bardziej modułowego i łatwiejszego w zarządzaniu kodu CSS.
*   **Angular Material:** Biblioteka gotowych komponentów UI, w pełni zgodnych z frameworkiem Angular. Znacząco przyspieszy budowę interfejsu użytkownika, zapewniając spójny i estetyczny wygląd formularzy, okien modalnych, przycisków i innych elementów interaktywnych wymaganych w projekcie.

## Backend i Baza Danych (Backend-as-a-Service)

W celu maksymalnego przyspieszenia prac nad wersją MVP i zminimalizowania kosztów utrzymania, backend aplikacji zostanie zrealizowany w modelu Backend-as-a-Service (BaaS) przy użyciu platformy Supabase.

*   **Supabase:** Platforma open-source stanowiąca alternatywę dla Firebase, oparta na PostgreSQL. Dostarczy kompletny zestaw narzędzi backendowych, które zostaną wykorzystane w następujący sposób:
    *   **Baza Danych PostgreSQL:** Sercem systemu będzie w pełni zarządzana, skalowalna baza danych PostgreSQL. Supabase automatycznie wygeneruje RESTful API na podstawie schematu bazy, co wyeliminuje konieczność pisania własnego kodu do obsługi operacji CRUD (Create, Read, Update, Delete) na przepisach, kolekcjach i tagach.
    *   **Authentication:** Gotowy do użycia, bezpieczny system uwierzytelniania użytkowników, który obsłuży rejestrację, logowanie i zarządzanie sesjami za pomocą adresu e-mail i hasła. Mechanizmy Row Level Security (RLS) zapewnią, że każdy użytkownik będzie miał dostęp wyłącznie do swoich danych.
    *   **Storage:** Usługa do przechowywania i serwowania plików, która zostanie wykorzystana do obsługi przesyłania i wyświetlania zdjęć przepisów.

## Testowanie

Jakość aplikacji jest zapewniana przez wielopoziomową strategię testowania, opartą na Piramidzie Testów, która obejmuje testy jednostkowe, integracyjne oraz end-to-end.

*   **Vitest:** Nowoczesny i wydajny framework do testów jednostkowych i integracyjnych. Vitest został wybrany ze względu na:
    *   Bardzo szybkie wykonywanie testów dzięki natywnej obsłudze ES modules.
    *   Pełną kompatybilność z TypeScript bez dodatkowej konfiguracji.
    *   Intuitive API kompatybilne z Jest, co ułatwia migrację i naukę.
    *   Możliwość izolowania i mockowania komponentów oraz serwisów Angular.
    
*   **Playwright:** Framework do automatyzacji testów end-to-end (E2E), który umożliwia symulację rzeczywistych interakcji użytkownika w przeglądarce. Playwright wyróżnia się:
    *   Wsparciem dla wielu przeglądarek (Chromium, Firefox, WebKit) z jednym API.
    *   Możliwością testowania aplikacji w różnych rozdzielczościach i na różnych urządzeniach.
    *   Zaawansowanymi możliwościami debugowania i nagrywania testów.
    *   Stabilnymi selektorami i automatycznym oczekiwaniem na elementy.

## CI/CD (Ciągła Integracja i Ciągłe Dostarczanie)

Procesy budowania, testowania i wdrażania aplikacji zostaną zautomatyzowane, aby zapewnić wysoką jakość kodu i szybkość dostarczania nowych funkcjonalności.

*   **GitHub & GitHub Actions:** Repozytorium kodu będzie hostowane na platformie GitHub. Zintegrowany z nim system GitHub Actions posłuży jako narzędzie CI/CD. Zostaną skonfigurowane automatyczne procesy (workflows), które po każdym `push` do głównej gałęzi będą:
    1.  Instalować zależności projektu.
    2.  Uruchamiać testy jednostkowe i integracyjne (Vitest).
    3.  Uruchamiać testy end-to-end (Playwright) na środowisku deweloperskim.
    4.  Budować produkcyjną wersję aplikacji frontendowej.
