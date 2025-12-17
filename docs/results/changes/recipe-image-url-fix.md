# Poprawka: 404 dla zdjęć przepisów (storage path vs public URL)

**Data:** 2025-12-17  
**Status:** ✅ Rozwiązane

## 🐛 Problem

Po dodaniu zdjęcia przez drag & drop i zapisaniu przepisu, na widoku szczegółów przepisu nie wyświetlało się zdjęcie. W konsoli błąd 404:

```
GET http://localhost:4200/c553b8d1-3dbb-488f-b610-97eb6f95d357/17/cover_1765928512529.jpg 404 (Not Found)
```

### Analiza problemu:

1. **Backend zapisuje storage path, nie public URL:**
   - Backend zapisuje do bazy `image_path` jako relatywną ścieżkę storage
   - Przykład: `"c553b8d1-3dbb-488f-b610-97eb6f95d357/17/cover_1765928512529.jpg"`
   - To jest poprawne dla Supabase Storage, ale nie jest to URL!

2. **Frontend używał storage path jako src obrazka:**
   ```html
   <img [src]="recipe().image_path" />
   ```
   - Przeglądarka interpretuje to jako relatywny URL do localhost → 404!

3. **Backend zwraca `image_url` w response, ale nie zawsze:**
   ```typescript
   // Response z POST /recipes/{id}/image
   {
     id: 17,
     image_path: "c553b8d1.../17/cover_xxx.jpg",  // storage path
     image_url: "http://127.0.0.1:54331/storage/..."  // public URL (może być undefined!)
   }
   ```

4. **Frontend używał fallback który nie działał:**
   ```typescript
   this.currentImageUrl.set(event.imageUrl || event.imagePath);
   ```
   - Jeśli `imageUrl` było undefined, używał `imagePath` (storage path) → błąd!

---

## 🔧 Rozwiązanie

Dodano automatyczne konstruowanie pełnego public URL ze storage path w komponentach wyświetlających obrazki.

### 1. `RecipeImageComponent` (widok szczegółów przepisu)

**Dodano computed property `fullImageUrl`:**

```typescript
import { SupabaseService } from '../../../../../core/services/supabase.service';

export class RecipeImageComponent {
    private readonly supabase = inject(SupabaseService);

    readonly imageUrl = input<string | null>(null);
    
    /**
     * Computed property that returns full public URL for the image
     * If imageUrl is already a full URL (starts with http), return as is
     * Otherwise, construct public URL using Supabase storage
     */
    readonly fullImageUrl = computed(() => {
        const url = this.imageUrl();
        
        if (!url) {
            return null;
        }

        // If already a full URL, return as is
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // Otherwise, construct public URL from storage path
        const { data } = this.supabase.storage
            .from('recipe-images')
            .getPublicUrl(url);

        return data?.publicUrl || null;
    });
}
```

**Zaktualizowano template:**

```html
<img [src]="fullImageUrl()" />  <!-- Zamiast imageUrl() -->
```

### 2. `RecipeCardComponent` (karty przepisów na listach)

Identyczna zmiana - dodano `fullImageUrl` computed property i zaktualizowano template.

---

## 📊 Jak to działa:

```
Backend zwraca image_path: "user-id/17/cover_xxx.jpg"
  ↓
Frontend: fullImageUrl computed wykrywa że to nie pełny URL
  ↓
Wywołuje: supabase.storage.from('recipe-images').getPublicUrl(path)
  ↓
Zwraca: "http://127.0.0.1:54331/storage/v1/object/public/recipe-images/user-id/17/cover_xxx.jpg"
  ↓
Template używa pełnego URL jako src ✅
  ↓
Obrazek się wyświetla!
```

---

## 🎯 Rezultat

✅ Zdjęcia przepisów wyświetlają się poprawnie w:
- Widoku szczegółów przepisu
- Kartach przepisów na listach
- Wszystkich miejscach używających `RecipeCardComponent` lub `RecipeImageComponent`

✅ Kompatybilność wsteczna:
- Jeśli `image_path` jest już pełnym URL (http/https) - używany bez zmian
- Jeśli `image_path` jest storage path - automatycznie konstruowany public URL

---

## 📝 Pliki zmodyfikowane

1. `src/app/pages/recipes/recipe-detail/components/recipe-image/recipe-image.component.ts`
   - Dodano inject `SupabaseService`
   - Dodano `fullImageUrl` computed property
   
2. `src/app/pages/recipes/recipe-detail/components/recipe-image/recipe-image.component.html`
   - Zmieniono `imageUrl()` na `fullImageUrl()`

3. `src/app/shared/components/recipe-card/recipe-card.ts`
   - Dodano inject `SupabaseService`
   - Dodano `fullImageUrl` computed property

4. `src/app/shared/components/recipe-card/recipe-card.html`
   - Zmieniono `recipe().imageUrl` na `fullImageUrl()`

5. `src/app/pages/recipes/recipe-form/components/recipe-image-upload/recipe-image-upload.component.ts`
   - Dodano inject `SupabaseService`
   - Dodano `fullCurrentImageUrl` computed property
   - Zaktualizowano `displayImageUrl` getter aby używał `fullCurrentImageUrl()`
   - Zaktualizowano `createUndoSnapshot()` aby używał pełnego URL
   - Zaktualizowano `hasImage` getter i `effect()` w konstruktorze

---

## 🔍 Alternatywne rozwiązania (nie wybrane)

### Opcja 1: Backend zawsze zwraca pełny URL
**Plusy:** Frontend nie musi konstruować URL  
**Minusy:** Wymaga zmiany w backendzie, migracja danych w bazie

### Opcja 2: Stworzenie Angular Pipe
```typescript
{{ recipe().image_path | storageUrl }}
```
**Plusy:** Reusable w templatech  
**Minusy:** Mniej type-safe, pipe wykonuje się przy każdym change detection

### Opcja 3 (wybrana): Computed property w komponentach
**Plusy:** 
- Type-safe
- Computed wykonuje się tylko gdy input się zmienia
- Czytelny kod
- Nie wymaga zmian w backendzie

**Minusy:**
- Trzeba dodać do każdego komponentu wyświetlającego obrazki

---

## 💡 Wnioski

### Backend design:
W idealnym świecie backend powinien ZAWSZE zwracać pełny public URL w `image_path`, nie storage path. Storage path to szczegół implementacji, którego frontend nie powinien znać.

**Rekomendacja dla przyszłości:**
- Migracja: zmienić `image_path` w bazie na pełny public URL
- Lub: backend zawsze transformuje storage path → public URL przed zwróceniem response

### Frontend resilience:
Obecne rozwiązanie czyni frontend bardziej odpornym:
- Obsługuje zarówno storage paths jak i pełne URLs
- Automatycznie konstruuje URL gdy potrzeba
- Kompatybilność wsteczna

---

**Autor:** AI Assistant  
**Czas naprawy:** ~20 minut  
**Priorytet:** Wysoki (obrazki się nie wyświetlały)

