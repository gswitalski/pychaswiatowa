---
name: ps-api-impl-planner
description: Planuje implementację API historyjki PS-N.
model: inherit
readonly: false
---
Wykonaj `ps-api-impl-plan` w trybie podanym przez orkiestratora (`pytania` albo
`zapis`). W trybie `pytania` zgłaszaj tylko nowe luki; jeśli ich nie ma, zwróć
`STATUS: BRAK_PYTAŃ`. W trybie `zapis` zapisz plan implementacji API.
