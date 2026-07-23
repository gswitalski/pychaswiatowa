# Testy manualne / smoke - konkretne endpointy i funkcje

Każdy plik to samodzielny plan testów manualnych albo kolekcja żądań `.http` dla jednego endpointu lub feature'a.

- [me-endpoint.md](./me-endpoint.md) - endpoint `GET /me` (scenariusze auth, JWT `app_role`, CORS)
- [feed-endpoints-smoke-tests.md](./feed-endpoints-smoke-tests.md) - endpointy `/public/recipes/feed` i `/recipes/feed` (paginacja, filtry, sortowanie, cache)
- [plan-recipes-post.http](./plan-recipes-post.http) - endpoint `POST /plan/recipes` (kolekcja żądań REST Client/Thunder Client)
- [recipe-times-us-040.md](./recipe-times-us-040.md) - feature czasów przygotowania/całkowitego przepisu (US-040): formularz, walidacja, widok szczegółów

## Konwencja na przyszłość

Nowy manualny plan testów dla endpointu/feature -> nowy plik `docs/testing/manual/<endpoint-lub-feature>.md` (lub `.http` dla kolekcji żądań), dopisany do listy powyżej. Nie dokładaj kolejnych plików na głównym poziomie `docs/testing/`.
