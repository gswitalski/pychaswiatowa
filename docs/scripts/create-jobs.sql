-- =====================================================
-- Skrypt: Utworzenie jobów normalizacji dla wszystkich przepisów
-- Opis: Tworzy joby w kolejce dla przepisów bez znormalizowanych składników
-- =====================================================
--
-- UWAGA: Ten skrypt może być uruchomiony:
-- 1. Na produkcji - przez Supabase Dashboard SQL Editor
-- 2. Lokalnie - przez psql lub Supabase Studio
--
-- Co robi ten skrypt:
-- - Znajduje wszystkie przepisy z status 'PENDING' (nie przetworzone)
-- - Pomija przepisy usunięte (deleted_at IS NOT NULL)
-- - Pomija przepisy bez składników
-- - Tworzy joby w kolejce normalized_ingredients_jobs
-- - Ustawia status przepisów na 'PENDING'
--
-- =====================================================

-- Wyłącz automatyczne commit (bezpieczeństwo)
BEGIN;

-- =====================================================
-- KROK 1: Sprawdź ile przepisów wymaga przetworzenia
-- =====================================================

DO $$
DECLARE
    v_pending_count INTEGER;
    v_failed_count INTEGER;
    v_no_ingredients_count INTEGER;
BEGIN
    -- Przepisy bez normalizacji (PENDING lub NULL)
    SELECT COUNT(*) INTO v_pending_count
    FROM recipes
    WHERE deleted_at IS NULL
      AND (normalized_ingredients_status IS NULL
           OR normalized_ingredients_status = 'PENDING')
      AND ingredients IS NOT NULL
      AND jsonb_array_length(ingredients) > 0;

    -- Przepisy FAILED (do ponownego przetworzenia)
    SELECT COUNT(*) INTO v_failed_count
    FROM recipes
    WHERE deleted_at IS NULL
      AND normalized_ingredients_status = 'FAILED'
      AND ingredients IS NOT NULL
      AND jsonb_array_length(ingredients) > 0;

    -- Przepisy bez składników (pominięte)
    SELECT COUNT(*) INTO v_no_ingredients_count
    FROM recipes
    WHERE deleted_at IS NULL
      AND (ingredients IS NULL OR jsonb_array_length(ingredients) = 0);

    -- Wyświetl podsumowanie
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Analiza przepisów do przetworzenia:';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Przepisy z status PENDING: %', v_pending_count;
    RAISE NOTICE 'Przepisy z status FAILED: %', v_failed_count;
    RAISE NOTICE 'Przepisy bez składników (pominięte): %', v_no_ingredients_count;
    RAISE NOTICE 'RAZEM do przetworzenia: %', v_pending_count + v_failed_count;
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- KROK 2: Utwórz joby dla przepisów PENDING
-- =====================================================

INSERT INTO normalized_ingredients_jobs (
    recipe_id,
    user_id,
    status,
    attempts,
    last_error,
    next_run_at,
    created_at,
    updated_at
)
SELECT
    r.id AS recipe_id,
    r.user_id,
    'PENDING' AS status,
    0 AS attempts,
    NULL AS last_error,
    NOW() AS next_run_at,
    NOW() AS created_at,
    NOW() AS updated_at
FROM recipes r
WHERE r.deleted_at IS NULL
  AND (r.normalized_ingredients_status IS NULL
       OR r.normalized_ingredients_status = 'PENDING')
  AND r.ingredients IS NOT NULL
  AND jsonb_array_length(r.ingredients) > 0
  -- Nie duplikuj istniejących jobów
  AND NOT EXISTS (
      SELECT 1
      FROM normalized_ingredients_jobs j
      WHERE j.recipe_id = r.id
  )
ORDER BY r.created_at DESC  -- Najnowsze przepisy najpierw
ON CONFLICT (recipe_id) DO NOTHING;  -- Zabezpieczenie przed duplikatami

-- =====================================================
-- KROK 3: Zresetuj przepisy FAILED (opcjonalnie)
-- =====================================================

-- Odkomentuj poniższe linie jeśli chcesz ponownie przetworzyć przepisy FAILED:

-- UPDATE recipes
-- SET
--     normalized_ingredients_status = 'PENDING',
--     normalized_ingredients_updated_at = NULL
-- WHERE deleted_at IS NULL
--   AND normalized_ingredients_status = 'FAILED'
--   AND ingredients IS NOT NULL
--   AND jsonb_array_length(ingredients) > 0;

-- INSERT INTO normalized_ingredients_jobs (
--     recipe_id,
--     user_id,
--     status,
--     attempts,
--     last_error,
--     next_run_at,
--     created_at,
--     updated_at
-- )
-- SELECT
--     r.id AS recipe_id,
--     r.user_id,
--     'PENDING' AS status,
--     0 AS attempts,
--     NULL AS last_error,
--     NOW() AS next_run_at,
--     NOW() AS created_at,
--     NOW() AS updated_at
-- FROM recipes r
-- WHERE r.deleted_at IS NULL
--   AND r.normalized_ingredients_status = 'FAILED'
--   AND r.ingredients IS NOT NULL
--   AND jsonb_array_length(r.ingredients) > 0
-- ON CONFLICT (recipe_id)
-- DO UPDATE SET
--     status = 'PENDING',
--     attempts = 0,
--     last_error = NULL,
--     next_run_at = NOW(),
--     updated_at = NOW();

-- =====================================================
-- KROK 4: Podsumowanie utworzonych jobów
-- =====================================================

DO $$
DECLARE
    v_created_jobs INTEGER;
    v_pending_jobs INTEGER;
    v_total_jobs INTEGER;
BEGIN
    -- Policz nowo utworzone joby (created_at w ostatniej minucie)
    SELECT COUNT(*) INTO v_created_jobs
    FROM normalized_ingredients_jobs
    WHERE created_at >= NOW() - INTERVAL '1 minute';

    -- Policz wszystkie joby PENDING
    SELECT COUNT(*) INTO v_pending_jobs
    FROM normalized_ingredients_jobs
    WHERE status = 'PENDING';

    -- Policz wszystkie joby
    SELECT COUNT(*) INTO v_total_jobs
    FROM normalized_ingredients_jobs;

    RAISE NOTICE '';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Podsumowanie operacji:';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Nowo utworzone joby: %', v_created_jobs;
    RAISE NOTICE 'Joby w kolejce (PENDING): %', v_pending_jobs;
    RAISE NOTICE 'Wszystkie joby: %', v_total_jobs;
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Worker automatycznie przetworzy joby w ciągu kilku minut.';
    RAISE NOTICE 'Możesz monitorować postęp zapytaniem:';
    RAISE NOTICE '';
    RAISE NOTICE 'SELECT status, COUNT(*) FROM normalized_ingredients_jobs GROUP BY status;';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- COMMIT lub ROLLBACK
-- =====================================================

-- Sprawdź wyniki powyżej. Jeśli wszystko wygląda OK:
COMMIT;

-- Jeśli coś jest nie tak, odkomentuj poniższą linię zamiast COMMIT:
-- ROLLBACK;

-- =====================================================
-- Monitorowanie postępu (opcjonalne zapytania)
-- =====================================================

-- Sprawdź rozkład statusów jobów:
-- SELECT status, COUNT(*) as count
-- FROM normalized_ingredients_jobs
-- GROUP BY status
-- ORDER BY status;

-- Sprawdź najnowsze joby:
-- SELECT
--     j.id,
--     j.recipe_id,
--     r.name as recipe_name,
--     j.status,
--     j.attempts,
--     j.next_run_at,
--     j.created_at
-- FROM normalized_ingredients_jobs j
-- JOIN recipes r ON r.id = j.recipe_id
-- ORDER BY j.created_at DESC
-- LIMIT 10;

-- Sprawdź postęp przetwarzania (ile gotowych):
-- SELECT
--     normalized_ingredients_status,
--     COUNT(*) as count
-- FROM recipes
-- WHERE deleted_at IS NULL
-- GROUP BY normalized_ingredients_status
-- ORDER BY normalized_ingredients_status;

-- Sprawdź przepisy z błędami:
-- SELECT
--     r.id,
--     r.name,
--     j.attempts,
--     j.last_error,
--     j.updated_at
-- FROM recipes r
-- JOIN normalized_ingredients_jobs j ON j.recipe_id = r.id
-- WHERE j.status IN ('RETRY', 'FAILED')
-- ORDER BY j.updated_at DESC;
