# Naprawa: Generowanie obrazów przez Gemini API

**Data:** 2026-01-16
**Typ:** Bugfix
**Moduł:** `supabase/functions/ai/ai.service.ts`
**Problem:** "Gemini AI service did not return an image"

## Problem

Generowanie obrazów przepisów z użyciem Gemini API (tryb `with_reference`) nie działało poprawnie. System zgłaszał błąd: **"Gemini AI service did not return an image"**.

### Objawy
```
[Error] No image in Gemini response
"Gemini AI service did not return an image"
```

## Przyczyny

Po porównaniu z oficjalną dokumentacją Gemini API zidentyfikowano trzy główne problemy:

### 1. **Nieistniejący model**

**Przed:**
```typescript
const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";
```

**Problem:** Model `gemini-3-pro-image-preview` nie istnieje w API Gemini.

### 2. **Błędna konwencja nazewnictwa w payloadzie (snake_case zamiast camelCase)**

**Przed:**
```typescript
{
    inline_data: {
        mime_type: referenceImage.mimeType,
        data: imageBase64,
    },
}
```

**Problem:** Gemini REST API wymaga **camelCase**, a nie snake_case.

### 3. **Błędne parsowanie odpowiedzi**

**Przed:**
```typescript
const imagePart = parts.find((p: any) => p.inline_data?.data);
const generatedBase64 = imagePart.inline_data.data;
const generatedMime = imagePart.inline_data.mime_type;
```

**Problem:** Odpowiedź z Gemini używa **camelCase** (`inlineData`, `mimeType`), a kod szukał snake_case.

## Rozwiązanie

### Zmiana 1: Poprawka nazwy modelu

```typescript
// Po
const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-exp";
```

**Uwaga:** Użyto modelu eksperymentalnego `gemini-2.0-flash-exp` zgodnego z dokumentacją Gemini API.

### Zmiana 2: Poprawka payloadu (camelCase)

```typescript
// Po
{
    inlineData: {
        mimeType: referenceImage.mimeType,
        data: imageBase64,
    },
}
```

### Zmiana 3: Poprawka parsowania odpowiedzi

```typescript
// Po
const imagePart = parts.find((p: any) => p.inlineData?.data);

const generatedBase64 = imagePart.inlineData.data as string;
const generatedMime = imagePart.inlineData.mimeType ?? "image/png";
```

### Zmiana 4: Ulepszone logowanie błędów

Dodano więcej kontekstu diagnostycznego:

```typescript
logger.error("No image in Gemini response", { 
    geminiJson,
    candidatesCount: geminiJson.candidates?.length ?? 0,
    partsCount: parts.length,
});
```

## Porównanie z dokumentacją Gemini

### Przykład z dokumentacji (SDK):

```javascript
const prompt = [
    { text: "..." },
    {
      inlineData: {  // camelCase
        mimeType: "image/png",  // camelCase
        data: base64Image,
      },
    },
];

// Odpowiedź:
for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {  // camelCase
        const imageData = part.inlineData.data;
        // ...
    }
}
```

### Nasza implementacja REST API (po poprawce):

```typescript
const geminiPayload = {
    contents: [{
        parts: [
            { text: prompt },
            {
                inlineData: {  // camelCase ✓
                    mimeType: referenceImage.mimeType,  // camelCase ✓
                    data: imageBase64,
                },
            },
        ],
    }],
    generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
    },
};

// Parsowanie:
const imagePart = parts.find((p: any) => p.inlineData?.data);  // camelCase ✓
const generatedBase64 = imagePart.inlineData.data;  // camelCase ✓
const generatedMime = imagePart.inlineData.mimeType;  // camelCase ✓
```

## Weryfikacja

Po wprowadzeniu zmian:

1. ✅ Poprawna nazwa modelu zgodna z Gemini API
2. ✅ Payload używa camelCase zgodnie z REST API Gemini
3. ✅ Parsowanie odpowiedzi szuka pól w camelCase
4. ✅ Ulepszone logowanie dla diagnozowania problemów

## Wpływ

- **Funkcjonalność:** Użytkownicy premium mogą teraz poprawnie generować obrazy AI z użyciem obrazu referencyjnego (tryb `with_reference`)
- **Model:** Przełączono na aktualny model `gemini-2.0-flash-exp`
- **Debugging:** Lepsze logowanie ułatwi identyfikację przyszłych problemów

## Uwagi techniczne

### Nazewnictwo API

Gemini REST API konsekwentnie używa **camelCase** dla wszystkich pól:
- Request: `inlineData`, `mimeType`
- Response: `inlineData`, `mimeType`

### Model

`gemini-2.0-flash-exp` to eksperymentalny model do generowania obrazów. W przyszłości może być konieczna aktualizacja na stabilną wersję modelu gdy będzie dostępna.

## Zgodność

Zmiana jest w pełni kompatybilna wstecz - nie wymaga migracji danych ani zmian w API dla klientów.

## Powiązane zmiany

- [fix-ai-reference-image-storage-path.md](./fix-ai-reference-image-storage-path.md) - Naprawa pobierania obrazu referencyjnego ze storage (pierwszy krok naprawy funkcjonalności)
