-- Fix PGRST203: PostgREST cannot resolve duplicate create_recipe_with_tags overloads
-- (with vs without p_tips_raw). Keep only the canonical version that includes tips.

do $drop_stale$
declare
    v_fn_args text;
begin
    for v_fn_args in
        select pg_get_function_identity_arguments(p.oid)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'create_recipe_with_tags'
          and pg_get_function_identity_arguments(p.oid) not like '%p_tips_raw text%'
    loop
        execute format('drop function public.create_recipe_with_tags(%s)', v_fn_args);
    end loop;
end;
$drop_stale$;

do $drop_stale_update$
declare
    v_fn_args text;
begin
    for v_fn_args in
        select pg_get_function_identity_arguments(p.oid)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'update_recipe_with_tags'
          and pg_get_function_identity_arguments(p.oid) not like '%p_tips_raw text%'
    loop
        execute format('drop function public.update_recipe_with_tags(%s)', v_fn_args);
    end loop;
end;
$drop_stale_update$;

-- Ensure grants remain on the canonical signatures (idempotent).
grant execute on function public.create_recipe_with_tags(
    uuid, text, text, bigint, text, text, text[],
    public.recipe_visibility, smallint, boolean, smallint, smallint,
    public.recipe_diet_type, public.recipe_cuisine, public.recipe_difficulty,
    boolean, text
) to authenticated;

grant execute on function public.update_recipe_with_tags(
    bigint, uuid, text, text, bigint, text, text, text[], boolean,
    public.recipe_visibility, text, boolean, smallint, boolean, boolean, boolean,
    smallint, boolean, smallint, boolean,
    public.recipe_diet_type, boolean, public.recipe_cuisine, boolean,
    public.recipe_difficulty, boolean, boolean, boolean, text, boolean
) to authenticated;