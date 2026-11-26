-- PS-118: atomowy zapis szkicu AI jako nowego wariantu rodziny przepisu.

create or replace function public.create_recipe_variant_from_ai(
    p_recipe_id bigint,
    p_user_id uuid,
    p_is_admin boolean,
    p_variant_name text,
    p_family_name text,
    p_visibility public.recipe_visibility,
    p_description text,
    p_ingredients_raw text,
    p_steps_raw text,
    p_tag_names text[],
    p_tips_raw text default null,
    p_category_id bigint default null,
    p_servings smallint default null,
    p_prep_time_minutes smallint default null,
    p_total_time_minutes smallint default null,
    p_diet_type public.recipe_diet_type default null,
    p_cuisine public.recipe_cuisine default null,
    p_difficulty public.recipe_difficulty default null,
    p_is_termorobot boolean default false,
    p_is_grill boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_family public.recipe_families%rowtype;
    v_recipe_id bigint;
    v_variant_name text := btrim(p_variant_name);
    v_family_name text := nullif(btrim(p_family_name), '');
    v_ingredients jsonb;
    v_steps jsonb;
    v_tips jsonb;
    v_tag_name text;
    v_tag_id bigint;
begin
    if not public.recipe_variants_allowed(p_is_admin) then
        raise exception 'Recipe variants feature is disabled' using errcode = 'P0003';
    end if;

    if char_length(v_variant_name) < 1 or char_length(v_variant_name) > 150 then
        raise exception 'Variant name must contain 1 to 150 characters' using errcode = '22023';
    end if;
    if p_family_name is not null and (char_length(v_family_name) < 1 or char_length(v_family_name) > 150) then
        raise exception 'Family name must contain 1 to 150 characters' using errcode = '22023';
    end if;
    if p_ingredients_raw is null or btrim(p_ingredients_raw) = ''
        or p_steps_raw is null or btrim(p_steps_raw) = '' then
        raise exception 'Ingredients and steps are required' using errcode = 'P0001';
    end if;
    if p_servings is not null and (p_servings < 1 or p_servings > 99)
        or p_prep_time_minutes is not null and (p_prep_time_minutes < 0 or p_prep_time_minutes > 999)
        or p_total_time_minutes is not null and (p_total_time_minutes < 0 or p_total_time_minutes > 999)
        or p_prep_time_minutes is not null and p_total_time_minutes is not null
            and p_total_time_minutes < p_prep_time_minutes then
        raise exception 'Recipe metadata is outside the allowed range' using errcode = 'P0001';
    end if;

    select f.* into v_family
    from public.recipe_families f
    join public.recipes r on r.recipe_family_id = f.id
    where r.id = p_recipe_id
      and r.user_id = p_user_id
      and r.deleted_at is null
      and f.deleted_at is null
    for update;
    if not found then
        raise exception 'Recipe not found' using errcode = 'P0002';
    end if;

    if (select count(*) from public.recipes
        where recipe_family_id = v_family.id and deleted_at is null) >= 10 then
        raise exception 'Variant limit reached' using errcode = 'P0009';
    end if;
    if exists (
        select 1 from public.recipes
        where recipe_family_id = v_family.id
          and deleted_at is null
          and lower(btrim(variant_name)) = lower(v_variant_name)
    ) then
        raise exception 'Variant name already exists' using errcode = '23505';
    end if;

    if p_category_id is not null and not exists (
        select 1 from public.categories where id = p_category_id
    ) then
        raise exception 'Category does not exist' using errcode = 'P0002';
    end if;

    v_ingredients := public.parse_text_to_jsonb(p_ingredients_raw);
    v_steps := public.parse_text_to_jsonb(p_steps_raw);
    if jsonb_array_length(v_ingredients) = 0 then
        raise exception 'Ingredients must contain at least one item' using errcode = 'P0001';
    end if;
    if jsonb_array_length(v_steps) = 0 then
        raise exception 'Steps must contain at least one item' using errcode = 'P0001';
    end if;
    v_tips := case
        when p_tips_raw is null or btrim(p_tips_raw) = '' then '[]'::jsonb
        else public.parse_text_to_jsonb(p_tips_raw)
    end;

    update public.recipe_families
    set name = coalesce(v_family_name, name),
        visibility = p_visibility
    where id = v_family.id and user_id = p_user_id;

    insert into public.recipes (
        user_id, name, description, category_id, ingredients, steps, tips,
        image_path, servings, is_termorobot, prep_time_minutes, total_time_minutes,
        diet_type, cuisine, difficulty, is_grill, visibility, recipe_family_id,
        variant_name, is_default, sort_order, normalized_ingredients_status
    )
    values (
        p_user_id, coalesce(v_family_name, v_family.name), p_description, p_category_id,
        v_ingredients, v_steps, v_tips, null, p_servings, p_is_termorobot,
        p_prep_time_minutes, p_total_time_minutes, p_diet_type, p_cuisine,
        p_difficulty, p_is_grill, p_visibility, v_family.id, v_variant_name, false,
        coalesce((select max(sort_order) + 1 from public.recipes
            where recipe_family_id = v_family.id and deleted_at is null), 0),
        'PENDING'
    )
    returning id into v_recipe_id;

    if p_tag_names is not null and array_length(p_tag_names, 1) > 0 then
        foreach v_tag_name in array p_tag_names loop
            if btrim(v_tag_name) = '' then
                continue;
            end if;
            select id into v_tag_id from public.tags
            where user_id = p_user_id and lower(name) = lower(btrim(v_tag_name));
            if v_tag_id is null then
                insert into public.tags (user_id, name)
                values (p_user_id, lower(btrim(v_tag_name)))
                returning id into v_tag_id;
            end if;
            insert into public.recipe_tags (recipe_id, tag_id)
            values (v_recipe_id, v_tag_id)
            on conflict (recipe_id, tag_id) do nothing;
        end loop;
    end if;

    return jsonb_build_object('recipe_id', v_recipe_id);
end;
$$;

revoke all on function public.create_recipe_variant_from_ai(
    bigint, uuid, boolean, text, text, public.recipe_visibility, text, text, text, text[], text,
    bigint, smallint, smallint, smallint, public.recipe_diet_type,
    public.recipe_cuisine, public.recipe_difficulty, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.create_recipe_variant_from_ai(
    bigint, uuid, boolean, text, text, public.recipe_visibility, text, text, text, text[], text,
    bigint, smallint, smallint, smallint, public.recipe_diet_type,
    public.recipe_cuisine, public.recipe_difficulty, boolean, boolean
) to service_role;

do $$
begin
    if has_function_privilege(
        'anon',
        'public.create_recipe_variant_from_ai(bigint,uuid,boolean,text,text,public.recipe_visibility,text,text,text,text[],text,bigint,smallint,smallint,smallint,public.recipe_diet_type,public.recipe_cuisine,public.recipe_difficulty,boolean,boolean)',
        'execute'
    ) or has_function_privilege(
        'authenticated',
        'public.create_recipe_variant_from_ai(bigint,uuid,boolean,text,text,public.recipe_visibility,text,text,text,text[],text,bigint,smallint,smallint,smallint,public.recipe_diet_type,public.recipe_cuisine,public.recipe_difficulty,boolean,boolean)',
        'execute'
    ) then
        raise exception 'PS-118 RPC privilege hardening failed';
    end if;
end;
$$;
