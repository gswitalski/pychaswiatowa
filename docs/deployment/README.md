# Dokumentacja wdrożeniowa – PychaŚwiatowa

## Infrastruktura

| Warstwa | Technologia | Środowisko |
|---------|-------------|------------|
| Frontend | Firebase Hosting | `pychaswiatowa.web.app` |
| Backend (Edge Functions) | Supabase Edge Functions (Deno) | Supabase Cloud |
| Baza danych | PostgreSQL (Supabase) | Supabase Cloud |
| CI/CD | GitHub Actions | `main-deploy.yml` |
| AI – generowanie draftów/obrazów | OpenAI API | Edge Function `ai` |
| AI – obrazy z referencją | Gemini API | Edge Function `ai` |
| Worker – normalizacja składników | Supabase Cron + Edge Function `internal` | Supabase Cloud |

---

## Nawigacja po dokumentach

### Ogólne

| Dokument | Opis |
|----------|------|
| [CI/CD Pipeline](./ci-cd-pipeline.md) | Opis automatycznego procesu wdrożenia (GitHub Actions → Supabase → Firebase) |
| [Zarządzanie sekretami](./secrets-management.md) | Kompletna lista sekretów, jak je dodawać i aktualizować |

### Konfiguracja funkcji

| Dokument | Opis |
|----------|------|
| [Gemini API Setup](./gemini-api-setup.md) | Jednorazowa konfiguracja integracji Gemini + troubleshooting + koszty |
| [Worker Normalized Ingredients](./worker-production-deployment.md) | Wdrożenie workera normalizacji składników (migracje, cron, monitoring) |

### Bezpieczeństwo (RLS)

| Dokument | Opis |
|----------|------|
| [RLS – Procedura wdrożenia](./rls-deployment.md) | Plan i kroki włączenia Row Level Security na produkcji |
| [RLS – Rollback i monitoring](./rls-rollback-and-monitoring.md) | Procedury awaryjne, monitoring, troubleshooting po włączeniu RLS |
| [Skrypt SQL](./enable_rls_for_production.sql) | Wykonywalny skrypt włączający RLS i tworzący polityki |

---

## Status środowisk

### Produkcja

| Element | Status | Uwagi |
|---------|--------|-------|
| CI/CD Pipeline | ✅ Aktywny | Auto-deploy po push do `main` |
| Gemini API | ✅ Skonfigurowany | Klucz w GitHub Secrets |
| OpenAI API | ✅ Skonfigurowany | Klucz w GitHub Secrets |
| Worker NI | ✅ Aktywny | Cron co minutę |
| RLS | ⚠️ Częściowo | 5/12 tabel z RLS – wymaga akcji |

### Development

| Element | Status | Uwagi |
|---------|--------|-------|
| RLS | ❌ Wyłączony (celowo) | Plik: `20251125121000_disable_rls_for_development.sql` |

---

## Ścieżka lektury

### Pierwsze wdrożenie (nowy deweloper)

1. Przeczytaj [CI/CD Pipeline](./ci-cd-pipeline.md)
2. Skonfiguruj sekrety wg [Zarządzanie sekretami](./secrets-management.md)
3. W razie potrzeby: [Gemini API Setup](./gemini-api-setup.md)

### Włączenie RLS na produkcji

1. Przeczytaj [RLS – Procedura wdrożenia](./rls-deployment.md) **w całości**
2. Przygotuj [procedury rollback](./rls-rollback-and-monitoring.md)
3. Wykonaj [skrypt SQL](./enable_rls_for_production.sql)

### Wdrożenie workera NI

1. Postępuj wg [Worker Normalized Ingredients](./worker-production-deployment.md)
2. Sekrety workera opisane w [Zarządzanie sekretami](./secrets-management.md)

---

---

## Dokumenty powiązane

- [Architektura hostingu](../results/hosting.md) – ogólny opis architektury produkcyjnej (Supabase + Firebase + CORS)
- [Konfiguracja środowiska](../configuration/environment-setup.md) – konfiguracja zmiennych środowiskowych lokalnie

---

**Ostatnia aktualizacja:** 2026-07-21
