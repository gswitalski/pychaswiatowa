# Konfiguracja Środowisk - Angular Environments

Ten katalog zawiera pliki konfiguracyjne dla różnych środowisk aplikacji PychaŚwiatowa.

## 📁 Struktura plików

```
src/environments/
├── environment.ts                        ✅ Commitowany (lokalne/domyślne)
├── environment.development.ts            ✅ Commitowany (lokalne/dev)
├── environment.production.ts             ❌ ZIGNOROWANY w Git (produkcja)
├── environment.production.template.ts    ✅ Commitowany (template)
└── README.md                             ✅ Ten plik
```

## 🚀 Jak to działa?

Angular automatycznie wymienia plik `environment.ts` podczas budowania:

- **`ng serve`** → używa `environment.development.ts`
- **`ng build`** → używa `environment.production.ts`

Konfiguracja zamiany znajduje się w pliku `angular.json` (sekcja `fileReplacements`).

## 🔧 Setup dla nowego dewelopera

### 1. Środowisko lokalne (Development)
**Nie wymaga żadnej konfiguracji!** 

Pliki `environment.ts` i `environment.development.ts` są gotowe do użycia i wskazują na lokalną instancję Supabase (`http://127.0.0.1:54321`).

Aby uruchomić lokalną instancję Supabase:
```bash
supabase start
```

### 2. Środowisko produkcyjne (Production)

Jeśli potrzebujesz zbudować wersję produkcyjną lokalnie:

1. Skopiuj plik template:
   ```bash
   cp src/environments/environment.production.template.ts src/environments/environment.production.ts
   ```

2. Otwórz `environment.production.ts` i uzupełnij prawdziwe wartości z dashboard Supabase

3. Zbuduj aplikację:
   ```bash
   npm run build
   ```

**UWAGA**: Plik `environment.production.ts` jest zignorowany w Git i NIE POWINIEN być commitowany!

## 🔐 Bezpieczeństwo

### Pliki bezpieczne do commitowania:
- ✅ `environment.ts` - lokalna konfiguracja (127.0.0.1)
- ✅ `environment.development.ts` - lokalna konfiguracja (127.0.0.1)
- ✅ `environment.production.template.ts` - template bez wrażliwych danych

### Pliki NIE do commitowania:
- ❌ `environment.production.ts` - zawiera klucze produkcyjne

## 🎯 GitHub Actions / CI/CD

W pipeline CI/CD plik produkcyjny jest tworzony dynamicznie z GitHub Secrets:

```yaml
- name: Create production environment file
  run: |
    cat > src/environments/environment.production.ts << EOF
    export const environment = {
      production: true,
      supabase: {
        url: '\${{ secrets.SUPABASE_URL }}',
        anonKey: '\${{ secrets.SUPABASE_ANON_KEY }}'
      }
    };
    EOF
```

## 📚 Dodatkowe informacje

Więcej o zmiennych środowiskowych w Angular:
- [Angular Environments Guide](https://angular.dev/tools/cli/environments)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

## ❓ FAQ

**Q: Dlaczego nie używamy plików `.env`?**  
A: Angular to framework frontendowy - kod jest kompilowany do statycznych plików. Wartości z `environment.ts` są wkompilowane bezpośrednio w bundle JavaScript podczas budowania.

**Q: Czy klucz `anonKey` jest tajny?**  
A: Klucz `anonKey` jest techniczne "publiczny" (używany w przeglądarce), ale zabezpieczony przez Row Level Security (RLS) w Supabase. Mimo to, dobrą praktyką jest nie udostępnianie URL produkcyjnego publicznie.

**Q: Co jeśli przypadkowo commitnę `environment.production.ts`?**  
A: Natychmiast zmień klucze w dashboard Supabase (Settings > API > Regenerate API Keys) i usuń plik z historii Git.

