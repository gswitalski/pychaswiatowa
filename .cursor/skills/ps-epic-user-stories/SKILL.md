---
name: ps-epic-user-stories
description: Generuje historyjki epiku z identyfikatorami PS-N i kryteriami GWT.
disable-model-invocation: true
---
Na podstawie zaakceptowanej analizy zapisz plik `{obszar}-user-stories.md`.
Każda historyjka ma `PS-{N}`, angielski slug, zależności i kryteria
Given-When-Then. Jeśli numer nie jest potwierdzony w Jirze, zapytaj zamiast
zgadywać. W trybie `pytania` działaj według sekcji „Pytania do użytkownika”
z konwencji (limit 2 rundy) i dopytuj o granice między historyjkami, kolejność
oraz zależności.
