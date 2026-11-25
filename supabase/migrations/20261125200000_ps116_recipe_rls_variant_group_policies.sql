-- PS-116: recipes are readable by authenticated users according to visibility,
-- while all direct writes remain service-role-only.

DO $$
DECLARE
    policy_record record;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'recipes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.recipes', policy_record.policyname);
    END LOOP;
END
$$;

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can select visible recipes"
    ON public.recipes
    FOR SELECT
    TO authenticated
    USING (
        deleted_at IS NULL
        AND (auth.uid() = user_id OR visibility = 'PUBLIC')
    );

ALTER VIEW public.recipe_details SET (security_invoker = true);

DO $$
DECLARE
    recipe_policy_count integer;
    has_write_policy boolean;
    recipes_rls boolean;
    view_security_invoker text;
BEGIN
    SELECT relrowsecurity
    INTO recipes_rls
    FROM pg_class
    WHERE oid = 'public.recipes'::regclass;

    SELECT count(*)::integer
    INTO recipe_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipes';

    SELECT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'recipes'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    )
    INTO has_write_policy;

    SELECT reloptions[array_position(reloptions, 'security_invoker=true')]
    INTO view_security_invoker
    FROM pg_class
    WHERE oid = 'public.recipe_details'::regclass;

    IF NOT recipes_rls
        OR recipe_policy_count <> 1
        OR has_write_policy
        OR view_security_invoker IS NULL
    THEN
        RAISE EXCEPTION
            'PS-116 verification failed: rls=%, policies=%, write_policy=%, security_invoker=%',
            recipes_rls,
            recipe_policy_count,
            has_write_policy,
            view_security_invoker;
    END IF;
END
$$;
