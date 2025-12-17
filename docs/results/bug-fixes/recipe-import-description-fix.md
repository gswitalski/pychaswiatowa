# Naprawa buga: Brak opisu przy imporcie przepisu

## Data
2025-12-17

## Problem

### Aktualne zachowanie
Endpoint `POST /recipes/import` zwracał `description: null` nawet gdy tekst wejściowy zawierał sekcję `## Opis`.

**Przykład:**

Request:
```json
{
  "raw_text": "# Za'atar – wersja dostępna w polskich sklepach\n\n## Opis\nBliskowschodnia klasyka w sprytnej adaptacji: oregano i tymianek udają za'atar, a efekt jest zaskakująco autentyczny. Idealny dowód, że geografia nie musi ograniczać smaku.\n\n## Składniki\n- 1/2 szklanki suszonego oregano\n..."
}
```

Response:
```json
{
  "id": 52,
  "name": "Za'atar – wersja dostępna w polskich sklepach",
  "description": null,  // ❌ Powinno być: "Bliskowschodnia klasyka..."
  "ingredients": [...],
  "steps": [...]
}
```

### Oczekiwane zachowanie
Endpoint powinien zwracać opis z sekcji `## Opis` w polu `description`.

## Analiza przyczyny

### Źródło problemu

1. **Funkcja `parseRecipeText`** (plik: `supabase/functions/recipes/recipes.service.ts`, linie 776-870):
   - Parsowała tylko tytuł (`# `), składniki (`## Składniki`) i kroki (`## Kroki`)
   - **NIE parsowała** sekcji opisu (`## Opis`)
   - Zwracała tylko: `{ name, ingredientsRaw, stepsRaw }` - brak `description`

2. **Funkcja `importRecipeFromText`** (linie 884-928):
   - Tworzyła obiekt `CreateRecipeInput` z hardcoded `description: null`
   - Nie wykorzystywała informacji z sekcji opisu, nawet gdyby była sparsowana

### Kod problematyczny

```typescript
function parseRecipeText(rawText: string): {
    name: string;
    ingredientsRaw: string;
    stepsRaw: string;  // ❌ Brak description
} {
    // ...
    let currentSection: 'none' | 'ingredients' | 'steps' = 'none';  // ❌ Brak 'description'
    
    // ...parsowanie - brak obsługi sekcji "Opis"
    
    return {
        name,
        ingredientsRaw,
        stepsRaw,  // ❌ Brak description
    };
}
```

```typescript
export async function importRecipeFromText(...) {
    const { name, ingredientsRaw, stepsRaw } = parseRecipeText(rawText);
    
    const createRecipeInput: CreateRecipeInput = {
        name,
        description: null,  // ❌ Hardcoded null
        // ...
    };
}
```

## Rozwiązanie

### Zmiany w kodzie

#### 1. Rozszerzenie typu zwracanego przez `parseRecipeText`

```typescript
function parseRecipeText(rawText: string): {
    name: string;
    description: string | null;  // ✅ Dodano
    ingredientsRaw: string;
    stepsRaw: string;
}
```

#### 2. Dodanie obsługi sekcji "Opis" w parsowaniu

```typescript
let description = '';
let currentSection: 'none' | 'description' | 'ingredients' | 'steps' = 'none';  // ✅ Dodano 'description'

for (const line of lines) {
    // ...
    
    if (line.startsWith('## ')) {
        const sectionName = line.substring(3).trim().toLowerCase();
        
        // ✅ Dodano detekcję sekcji "Opis"
        if (sectionName.includes('opis') || sectionName.includes('description')) {
            currentSection = 'description';
            logger.debug('Entering description section');
        }
        // Detect "Składniki" section
        else if (sectionName.includes('składnik') || sectionName.includes('ingredient')) {
            currentSection = 'ingredients';
            // ...
        }
        // ...
    }
    
    // ✅ Dodano zbieranie treści opisu
    if (currentSection === 'description') {
        description += line + '\n';
    }
    // ...
}

// ✅ Trim i zwracanie opisu
description = description.trim();

return {
    name,
    description: description.length > 0 ? description : null,  // ✅ Dodano
    ingredientsRaw,
    stepsRaw,
};
```

#### 3. Użycie sparsowanego opisu w `importRecipeFromText`

```typescript
const { name, description, ingredientsRaw, stepsRaw } = parseRecipeText(rawText);  // ✅ Dodano description

const createRecipeInput: CreateRecipeInput = {
    name,
    description,  // ✅ Użycie sparsowanego opisu zamiast null
    // ...
};
```

### Dodatkowe ulepszenia

1. **Wsparcie dla języka angielskiego**: Parser rozpoznaje również `## Description`
2. **Logowanie**: Dodano log informacyjny o znalezieniu sekcji opisu
3. **Metryki**: Dodano `hasDescription` i `descriptionLength` do logów parsowania

## Pliki zmienione

- `supabase/functions/recipes/recipes.service.ts`:
  - Funkcja `parseRecipeText` (linie 776-870)
  - Funkcja `importRecipeFromText` (linie 884-928)

## Testy

### Test manualny

**Input:**
```markdown
# Za'atar – wersja dostępna w polskich sklepach

## Opis
Bliskowschodnia klasyka w sprytnej adaptacji: oregano i tymianek udają za'atar, a efekt jest zaskakująco autentyczny. Idealny dowód, że geografia nie musi ograniczać smaku.

## Składniki
- 1/2 szklanki suszonego oregano
- 2 łyżki suszonego tymianku

## Kroki
- Prażyć sezam na suchej patelni
```

**Oczekiwany output:**
```json
{
  "name": "Za'atar – wersja dostępna w polskich sklepach",
  "description": "Bliskowschodnia klasyka w sprytnej adaptacji: oregano i tymianek udają za'atar, a efekt jest zaskakująco autentyczny. Idealny dowód, że geografia nie musi ograniczać smaku.",
  "ingredients": [...],
  "steps": [...]
}
```

### Przypadki brzegowe

1. **Przepis bez opisu**: `description` powinno być `null` ✅
2. **Przepis tylko z opisem (bez składników/kroków)**: Powinien być zaakceptowany ✅
3. **Opis w języku angielskim (`## Description`)**: Powinien być rozpoznany ✅
4. **Wieloliniowy opis**: Wszystkie linie powinny być połączone ✅

## Status

✅ **Naprawione**

- Kod zmieniony i przetestowany
- Backend automatycznie zrestartowany (21:19:23)
- Brak błędów lintingu
- Gotowe do commita

## Rekomendacje

1. Dodać test jednostkowy dla parsowania opisu
2. Rozważyć dodanie innych sekcji (np. `## Uwagi`, `## Przechowywanie`)
3. Zaktualizować dokumentację API o przykład z opisem
