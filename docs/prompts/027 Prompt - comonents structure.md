W formacie ASCII przedstaw strukturę komponentów i zależności rozpoczynając od @RulePreview.tsx


Które elementy tego fragmentu projektu warto przetestować z wykorzystaniem unit testów i dlaczego?


Przygotuj zestaw testów jednostkowych dla `RulesBuilderService.generateRulesContent()` z uwzględnieniem kluczowych reguł biznesowych i warunków brzegowych @vitest-unit-testing.mdc



---

Otrzymasz strukturę projektu aplikacji webowej Angular do analizy. Twoim zadaniem jest przeanalizowanie tej struktury i przedstawienie hierarchii komponentów oraz ich zależności w formacie ASCII, rozpoczynając od określonego komponentu.

<struktura_projektu>
{{STRUKTURA_PROJEKTU}}
</struktura_projektu>

<komponent_startowy>
{{KOMPONENT_STARTOWY}}
</komponent_startowy>

Przeanalizuj podaną strukturę projektu Angular i wykonaj następujące kroki:

1. Zidentyfikuj wszystkie komponenty, serwisy, moduły i inne elementy w projekcie
2. Określ zależności między komponentami (które komponenty są używane przez inne)
3. Znajdź komponent startowy podany w zmiennej komponent_startowy
4. Stwórz hierarchiczne drzewo zależności w formacie ASCII, rozpoczynając od komponentu startowego

Zasady tworzenia diagramu ASCII:
- Użyj znaków ├──, └──, │ do tworzenia struktury drzewa
- Komponent startowy powinien być na szczycie hierarchii
- Komponenty potomne powinny być wcięte i połączone liniami
- Jeśli komponent ma wiele zależności, pokaż je wszystkie
- Dodaj krótkie opisy funkcjonalności przy każdym komponencie w nawiasach
- Oznacz typy elementów: [Komponent], [Serwis], [Moduł], [Dyrektywa], itp.

Przykład formatu wyjściowego:
```
AppComponent [Komponent] (główny komponent aplikacji)
├── HeaderComponent [Komponent] (nagłówek strony)
│   ├── NavigationService [Serwis] (obsługa nawigacji)
│   └── UserService [Serwis] (zarządzanie użytkownikami)
├── MainContentComponent [Komponent] (główna zawartość)
│   ├── ProductListComponent [Komponent] (lista produktów)
│   │   └── ProductService [Serwis] (operacje na produktach)
│   └── FilterComponent [Komponent] (filtrowanie)
└── FooterComponent [Komponent] (stopka strony)
```

Jeśli nie możesz znaleźć podanego komponentu startowego w strukturze projektu, zacznij od komponentu głównego (zwykle AppComponent) i wyraźnie to zaznacz.

Przedstaw swoją analizę w języku polskim, a następnie umieść finalny diagram ASCII w tagach <diagram_ascii>.
