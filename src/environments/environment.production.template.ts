// Template dla environment.production.ts
// 
// INSTRUKCJA:
// 1. Skopiuj ten plik do: environment.production.ts
// 2. Uzupełnij prawdziwe wartości z Twojego projektu Supabase
// 3. NIE commituj pliku environment.production.ts do repozytorium!
//
// Gdzie znaleźć wartości:
// - Zaloguj się do dashboard Supabase: https://supabase.com/dashboard
// - Wybierz swój projekt
// - Przejdź do: Settings > API
// - Skopiuj "Project URL" jako 'url'
// - Skopiuj "anon/public" key jako 'anonKey'

export const environment = {
    production: true,
    supabase: {
        url: 'YOUR_PRODUCTION_SUPABASE_URL',      // np. https://xxxxxxxxxxxxx.supabase.co
        anonKey: 'YOUR_PRODUCTION_SUPABASE_ANON_KEY'  // klucz anon/public z dashboard
    }
};

