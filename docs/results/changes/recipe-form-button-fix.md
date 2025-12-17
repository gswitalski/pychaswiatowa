# Poprawka: Nieaktywny przycisk "Zapisz zmiany" w edycji przepisu

**Data:** 2025-12-17  
**Status:** ✅ Rozwiązane

## 🐛 Problem

Po implementacji nowej funkcjonalności uploadu zdjęć, przycisk "Zapisz zmiany" w trybie edycji przepisu był nieaktywny, mimo że formularz był poprawnie wypełniony.

### Objawy:
- Przycisk "Zapisz zmiany" zawsze disabled w trybie edycji
- Formularz był valid (`form.valid === true`)
- Wszystkie pola były poprawnie wypełnione
- Składniki i kroki zostały załadowane z API

### Przyczyna:

**Angular Reactive Forms nie są reactive signals!**

`computed()` w Angular obserwuje tylko zmiany w signals, ale **nie reaguje na zmiany w `FormControl`, `FormArray` czy `FormGroup`**.

Oryginalny kod:
```typescript
readonly isSaveDisabled = computed(() => 
    this.form?.invalid || this.saving() || this.imageUploading()
);
```

Problem: `this.form?.invalid` nie jest signal, więc `computed()` nie wykrywa jego zmian!

---

## 🔧 Rozwiązanie

Dodano **manual tracking** walidacji formularza przez signal:

### 1. Dodano nowy signal `formValid`:

```typescript
/** Signal: track form validity manually */
private readonly formValid = signal<boolean>(false);
```

### 2. Zaktualizowano `computed`:

```typescript
readonly isSaveDisabled = computed(() => {
    const formInvalid = !this.formValid();
    const saving = this.saving();
    const imageUploading = this.imageUploading();

    return formInvalid || saving || imageUploading;
});
```

### 3. Dodano subskrypcję na `statusChanges`:

```typescript
ngOnInit(): void {
    this.initForm();
    this.loadCategories();
    this.checkEditMode();
    
    // Subscribe to form status changes to update formValid signal
    this.form.statusChanges.subscribe(() => {
        this.formValid.set(this.form.valid);
    });
    
    // Set initial form validity
    this.formValid.set(this.form.valid);
}
```

---

## 📊 Jak to działa:

```
FormArray zmienia się (np. push nowego składnika)
  ↓
form.statusChanges emituje event
  ↓
formValid.set(this.form.valid) aktualizuje signal
  ↓
computed wykrywa zmianę w formValid signal
  ↓
isSaveDisabled przelicza się
  ↓
UI aktualizuje przycisk (enabled/disabled) ✅
```

---

## 🎯 Rezultat

✅ Przycisk "Zapisz zmiany" jest **aktywny** gdy formularz jest valid  
✅ Przycisk jest **nieaktywny** gdy:
- Formularz jest invalid
- Trwa zapis (`saving === true`)
- Trwa upload zdjęcia (`imageUploading === true`)

---

## 📝 Wnioski i lekcje

### Angular Signals vs Reactive Forms

**Problem:** Angular Signals i Reactive Forms to dwa różne systemy reactivity:
- **Signals**: nowy system reactivity w Angular (od wersji 16+)
- **Reactive Forms**: starszy system oparty o RxJS Observables

`computed()` śledzi tylko signals, **nie** śledzi:
- `FormControl.value`
- `FormGroup.valid`
- `FormArray.length`

### Rozwiązania:

**Opcja 1 (użyta):** Manual tracking przez signal + `statusChanges`:
```typescript
private readonly formValid = signal<boolean>(false);

ngOnInit() {
    this.form.statusChanges.subscribe(() => {
        this.formValid.set(this.form.valid);
    });
}
```

**Opcja 2:** Użycie `toSignal()` z RxJS:
```typescript
import { toSignal } from '@angular/core/rxjs-interop';

readonly formValid = toSignal(this.form.statusChanges.pipe(
    map(() => this.form.valid),
    startWith(this.form.valid)
));
```

**Opcja 3:** Migracja do Signal-based Forms (przyszłość Angular):
- Angular planuje wprowadzić signal-based forms
- To ujednolici reactivity w całym frameworku

---

## 🔍 Pliki zmodyfikowane

- `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`
  - Dodano `formValid` signal
  - Zaktualizowano `isSaveDisabled` computed
  - Dodano subskrypcję na `form.statusChanges`

---

**Autor:** AI Assistant  
**Czas naprawy:** ~15 minut  
**Priorytet:** Wysoki (blocker funkcjonalności)

