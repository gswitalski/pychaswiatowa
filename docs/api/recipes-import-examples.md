# API Examples: POST /recipes/import

## Endpoint Overview

**URL:** `POST /functions/v1/recipes/import`

**Purpose:** Create a new recipe by importing from a raw text block. The server automatically parses the text to extract the recipe name, ingredients, and steps.

**Authentication:** Required (JWT token)

---

## Request Format

### Headers
```http
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

### Body Schema
```typescript
{
  raw_text: string  // Required, non-empty
}
```

### Expected Text Format

The `raw_text` should follow this markdown-like structure:

```markdown
# Recipe Title (Required - must start with #)

## Składniki (or ## Ingredients)
### Subsection Header (optional)
- ingredient item 1
- ingredient item 2

### Another Subsection (optional)
- ingredient item 3

## Kroki (or ## Steps or ## Instructions)
- step 1
- step 2
- step 3
```

**Rules:**
- **Title** (required): Line starting with `# `
- **Main sections** (optional): Lines starting with `## `
  - "Składniki" or "Ingredients" for ingredients section
  - "Kroki", "Steps", or "Instructions" for steps section
- **Subsection headers** (optional): Lines starting with `### `
- **Items** (optional): Lines starting with `- `

---

## Example 1: Complete Recipe (Success)

### Request

```typescript
// TypeScript/Angular
import { HttpClient } from '@angular/common/http';

const rawText = `# Pizza Margherita

## Składniki

### Ciasto
- 500g mąki pszennej
- 10g drożdży świeżych
- 300ml ciepłej wody
- 1 łyżeczka soli

### Sos
- 400g pomidorów z puszki
- 2 ząbki czosnku
- oregano
- sól, pieprz

### Do posmarowania
- 200g mozzarelli
- świeża bazylia

## Kroki

- Wymieszaj mąkę z solą, dodaj rozrobione drożdże i wodę
- Wyrabiaj ciasto przez 10 minut
- Zostaw do wyrośnięcia na 2 godziny
- Przygotuj sos: zblenduj pomidory z czosnkiem i przyprawami
- Rozwałkuj ciasto na cienki placek
- Nałóż sos i ser
- Piecz w 250°C przez 10-12 minut
- Udekoruj świeżą bazylią`;

this.http.post('/functions/v1/recipes/import', { raw_text: rawText })
  .subscribe({
    next: (response) => {
      console.log('Recipe created:', response);
      // Navigate to edit page
      this.router.navigate(['/recipes', response.id, 'edit']);
    },
    error: (error) => {
      console.error('Import failed:', error);
    }
  });
```

### Response (201 Created)

```json
{
  "id": 123,
  "user_id": "uuid-...",
  "name": "Pizza Margherita",
  "description": null,
  "category_id": null,
  "category_name": null,
  "image_path": null,
  "ingredients": [
    { "type": "header", "content": "Ciasto" },
    { "type": "item", "content": "500g mąki pszennej" },
    { "type": "item", "content": "10g drożdży świeżych" },
    { "type": "item", "content": "300ml ciepłej wody" },
    { "type": "item", "content": "1 łyżeczka soli" },
    { "type": "header", "content": "Sos" },
    { "type": "item", "content": "400g pomidorów z puszki" },
    { "type": "item", "content": "2 ząbki czosnku" },
    { "type": "item", "content": "oregano" },
    { "type": "item", "content": "sól, pieprz" },
    { "type": "header", "content": "Do posmarowania" },
    { "type": "item", "content": "200g mozzarelli" },
    { "type": "item", "content": "świeża bazylia" }
  ],
  "steps": [
    { "type": "item", "content": "Wymieszaj mąkę z solą, dodaj rozrobione drożdże i wodę" },
    { "type": "item", "content": "Wyrabiaj ciasto przez 10 minut" },
    { "type": "item", "content": "Zostaw do wyrośnięcia na 2 godziny" },
    { "type": "item", "content": "Przygotuj sos: zblenduj pomidory z czosnkiem i przyprawami" },
    { "type": "item", "content": "Rozwałkuj ciasto na cienki placek" },
    { "type": "item", "content": "Nałóż sos i ser" },
    { "type": "item", "content": "Piecz w 250°C przez 10-12 minut" },
    { "type": "item", "content": "Udekoruj świeżą bazylią" }
  ],
  "tags": [],
  "created_at": "2023-10-28T10:00:00Z",
  "updated_at": "2023-10-28T10:00:00Z"
}
```

---

## Example 2: Minimal Recipe (Only Title)

### Request

```json
{
  "raw_text": "# Szybki obiad"
}
```

### Response (201 Created)

```json
{
  "id": 124,
  "user_id": "uuid-...",
  "name": "Szybki obiad",
  "description": null,
  "category_id": null,
  "category_name": null,
  "image_path": null,
  "ingredients": [
    { "type": "item", "content": "(empty)" }
  ],
  "steps": [
    { "type": "item", "content": "(empty)" }
  ],
  "tags": [],
  "created_at": "2023-10-28T10:00:00Z",
  "updated_at": "2023-10-28T10:00:00Z"
}
```

**Use case:** User wants to quickly create a recipe placeholder and fill in details later in the edit form.

---

## Example 3: English Format

### Request

```json
{
  "raw_text": "# Chocolate Cake\n\n## Ingredients\n\n### Dry\n- 2 cups flour\n- 1 cup sugar\n\n### Wet\n- 3 eggs\n- 1 cup milk\n\n## Steps\n\n- Mix dry ingredients\n- Add wet ingredients\n- Bake at 180°C for 30 minutes"
}
```

### Response (201 Created)

Parser recognizes English section names: "Ingredients", "Steps", "Instructions".

---

## Error Responses

### Error 1: Missing Title (400 Bad Request)

#### Request
```json
{
  "raw_text": "## Składniki\n- mąka\n## Kroki\n- piecz"
}
```

#### Response
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid recipe format. A title (#) is required."
}
```

---

### Error 2: Empty Text (400 Bad Request)

#### Request
```json
{
  "raw_text": ""
}
```

#### Response
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input: raw_text: Raw text cannot be empty"
}
```

---

### Error 3: Missing Authorization (401 Unauthorized)

#### Request
```http
POST /functions/v1/recipes/import
Content-Type: application/json
(No Authorization header)
```

#### Response
```json
{
  "code": "UNAUTHORIZED",
  "message": "Missing Authorization header"
}
```

---

### Error 4: Invalid/Expired Token (401 Unauthorized)

#### Request
```http
POST /functions/v1/recipes/import
Authorization: Bearer invalid_token_here
Content-Type: application/json
```

#### Response
```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

---

## Frontend Integration Example (Angular)

### Service Method

```typescript
// recipe.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RecipeDetailDto, ImportRecipeCommand } from '@shared/contracts/types';

@Injectable({ providedIn: 'root' })
export class RecipeService {
    private apiUrl = '/functions/v1/recipes';

    constructor(private http: HttpClient) {}

    importRecipe(rawText: string): Observable<RecipeDetailDto> {
        const command: ImportRecipeCommand = { raw_text: rawText };
        return this.http.post<RecipeDetailDto>(`${this.apiUrl}/import`, command);
    }
}
```

### Component Usage

```typescript
// recipe-import-page.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { RecipeService } from '@core/services/recipe.service';

@Component({
    selector: 'app-recipe-import-page',
    template: `
        <mat-card>
            <mat-card-header>
                <mat-card-title>Importuj przepis</mat-card-title>
            </mat-card-header>
            <mat-card-content>
                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Wklej tekst przepisu</mat-label>
                    <textarea
                        matInput
                        [(ngModel)]="rawText"
                        rows="20"
                        placeholder="# Nazwa przepisu&#10;&#10;## Składniki&#10;- składnik 1&#10;&#10;## Kroki&#10;- krok 1"
                    ></textarea>
                </mat-form-field>
                
                @if (errorMessage) {
                    <mat-error>{{ errorMessage }}</mat-error>
                }
            </mat-card-content>
            <mat-card-actions>
                <button
                    mat-raised-button
                    color="primary"
                    (click)="importRecipe()"
                    [disabled]="!rawText || isLoading"
                >
                    {{ isLoading ? 'Importowanie...' : 'Importuj i edytuj' }}
                </button>
            </mat-card-actions>
        </mat-card>
    `
})
export class RecipeImportPageComponent {
    rawText = '';
    isLoading = false;
    errorMessage = '';

    constructor(
        private recipeService: RecipeService,
        private router: Router
    ) {}

    importRecipe(): void {
        if (!this.rawText.trim()) {
            this.errorMessage = 'Proszę wkleić tekst przepisu';
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        this.recipeService.importRecipe(this.rawText).subscribe({
            next: (recipe) => {
                // Navigate to edit page with the new recipe ID
                this.router.navigate(['/recipes', recipe.id, 'edit']);
            },
            error: (error) => {
                this.isLoading = false;
                this.errorMessage = error.error?.message || 'Nie udało się zaimportować przepisu';
            },
            complete: () => {
                this.isLoading = false;
            }
        });
    }
}
```

---

## Notes for Frontend Developers

1. **Post-import flow:**
   - After successful import, immediately navigate to the edit page
   - User can then add: category, tags, description, and image
   - This provides a smooth UX: quick import → detailed editing

2. **Text format instructions:**
   - Display example format or template for users
   - Consider adding a "help" button with formatting guidelines
   - Optional: Provide a template button to insert example text

3. **Error handling:**
   - Display clear error messages for validation errors
   - For missing title error, highlight the requirement
   - For auth errors, redirect to login

4. **Loading states:**
   - Show spinner during import
   - Disable button to prevent double-submission
   - Consider adding a preview feature before final import

5. **Validation on frontend (optional):**
   - Check for `#` in the text before sending
   - Warn user if no sections are detected
   - This provides immediate feedback and reduces server load

---

## Testing Checklist

- [ ] Test with complete recipe (title + ingredients + steps)
- [ ] Test with only title
- [ ] Test with missing title (should fail)
- [ ] Test with empty text (should fail)
- [ ] Test with very long text (>5000 characters)
- [ ] Test with special characters and emoji
- [ ] Test with English section names
- [ ] Test without authentication (should fail with 401)
- [ ] Test with expired token (should fail with 401)
- [ ] Verify navigation to edit page after success
- [ ] Verify error messages are user-friendly

