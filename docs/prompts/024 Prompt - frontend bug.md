Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w frontendzie aplikacji.

Zapoznaj się z dokumnetacją projektu 

<dokumentacja_projektu>



</dokumentacja_projektu>


<aktualne_zachowanie>
wdrozenie na produkcjid daje github actions taki błąd:
Run supabase db push
WARN: no SMS provider is enabled. Disabling phone login
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 20251216120000_add_category_to_get_recipes_list.sql

 [Y/n] 
Applying migration 20251216120000_add_category_to_get_recipes_list.sql...
ERROR: cannot change return type of existing function (SQLSTATE 42P13)                                     
Row type defined by OUT parameters is different.                                                           
At statement: 0                                                                                            
-- migration: update get_recipes_list function to include category information                             
-- description: adds category_id and category_name fields to get_recipes_list function output              
-- function updated: get_recipes_list                                                                      
-- dependencies: recipes, categories, profiles, collections, recipe_tags, recipe_collections               
-- reason: bug fix - recipe cards should display category information                                      
                                                                                                           
/**                                                                                                        
 * Zaktualizowana funkcja get_recipes_list która zwraca również informacje o kategorii przepisu.           
 *                                                                                                         
 * Zmiany w stosunku do poprzedniej wersji:                                                                
 * - Dodano zwracanie category_id i category_name                                                          
 * - Dodano JOIN do tabeli categories w końcowym SELECT                                                    
 *                                                                                                         
 * @param p_user_id - UUID zalogowanego użytkownika                                                        
 * @param p_view - Typ widoku: 'owned' lub 'my_recipes'                                                    
 * @param p_page - Numer strony (1-based)                                                                  
 * @param p_limit - Liczba elementów na stronę                                                             
 * @param p_sort_field - Pole sortowania: 'name', 'created_at', lub 'updated_at'                           
 * @param p_sort_direction - Kierunek sortowania: 'asc' lub 'desc'                                         
 * @param p_category_id - Opcjonalny filtr kategorii                                                       
 * @param p_tag_ids - Opcjonalna tablica ID tagów                                                          
 * @param p_search - Opcjonalny termin wyszukiwania                                                        
 *                                                                                                         
 * @returns TABLE z kolumnami:                                                                             
 *   - id: ID przepisu                                                                                     
 *   - name: nazwa przepisu                                                                                
 *   - image_path: ścieżka do obrazu przepisu                                                              
 *   - created_at: znacznik czasu utworzenia                                                               
 *   - visibility: widoczność przepisu ('PRIVATE', 'SHARED', 'PUBLIC')                                     
 *   - is_owner: true jeśli użytkownik jest właścicielem przepisu                                          
 *   - in_my_collections: true jeśli przepis jest w kolekcji użytkownika                                   
 *   - author_id: ID autora                                                                                
 *   - author_username: nazwa użytkownika autora                                                           
 *   - category_id: ID kategorii (null jeśli nie przypisano)                                               
 *   - category_name: nazwa kategorii (null jeśli nie przypisano)                                          
 *   - total_count: całkowita liczba elementów spełniających filtry (do paginacji)                         
 */                                                                                                        
create or replace function public.get_recipes_list(                                                        
    p_user_id uuid,                                                                                        
    p_view text default 'owned',                                                                           
    p_page integer default 1,                                                                              
    p_limit integer default 20,                                                                            
    p_sort_field text default 'created_at',                                                                
    p_sort_direction text default 'desc',                                                                  
    p_category_id bigint default null,                                                                     
    p_tag_ids bigint[] default null,                                                                       
    p_search text default null                                                                             
)                                                                                                          
returns table (                                                                                            
    id bigint,                                                                                             
    name text,                                                                                             
    image_path text,                                                                                       
    created_at timestamptz,                                                                                
    visibility recipe_visibility,                                                                          
    is_owner boolean,                                                                                      
    in_my_collections boolean,                                                                             
    author_id uuid,                                                                                        
    author_username text,                                                                                  
    category_id bigint,                                                                                    
    category_name text,                                                                                    
    total_count bigint                                                                                     
)                                                                                                          
language plpgsql                                                                                           
security definer                                                                                           
set search_path = public                                                                                   
as $$                                                                                                      
declare                                                                                                    
    v_offset integer;                                                                                      
    v_sort_clause text;                                                                                    
begin                                                                                                      
    -- Oblicz offset paginacji                                                                             
    v_offset := (p_page - 1) * p_limit;                                                                    
                                                                                                           
    -- Walidacja i budowa klauzuli sortowania (whitelist zapobiegający SQL injection)                      
    -- Uwaga: alias 'cr' odnosi się do CTE 'counted_recipes' w głównym zapytaniu                           
    case p_sort_field                                                                                      
        when 'name' then                                                                                   
            v_sort_clause := 'cr.name';                                                                    
        when 'created_at' then                                                                             
            v_sort_clause := 'cr.created_at';                                                              
        when 'updated_at' then                                                                             
            v_sort_clause := 'cr.updated_at';                                                              
        else                                                                                               
            v_sort_clause := 'cr.created_at';                                                              
    end case;                                                                                              
                                                                                                           
    -- Dodaj kierunek                                                                                      
    if lower(p_sort_direction) = 'asc' then                                                                
        v_sort_clause := v_sort_clause || ' ASC';                                                          
    else                                                                                                   
        v_sort_clause := v_sort_clause || ' DESC';                                                         
    end if;                                                                                                
                                                                                                           
    -- Główne zapytanie                                                                                    
    return query execute format('                                                                          
        with filtered_recipes as (                                                                         
            select distinct on (r.id)                                                                      
                r.id,                                                                                      
                r.name,                                                                                    
                r.image_path,                                                                              
                r.created_at,                                                                              
                r.visibility,                                                                              
                r.user_id,                                                                                 
                r.category_id,                                                                             
                -- Sprawdź czy użytkownik jest właścicielem                                                
                (r.user_id = $1) as is_owner,                                                              
                -- Sprawdź czy przepis jest w kolekcjach użytkownika                                       
                exists(                                                                                    
                    select 1                                                                               
                    from public.recipe_collections rc                                                      
                    inner join public.collections c on c.id = rc.collection_id                             
                    where rc.recipe_id = r.id                                                              
                      and c.user_id = $1                                                                   
                ) as in_my_collections                                                                     
            from public.recipes r                                                                          
            where r.deleted_at is null                                                                     
              -- Filtr widoku                                                                              
              and (                                                                                        
                  -- widok owned: tylko przepisy użytkownika                                               
                  ($2 = ''owned'' and r.user_id = $1)                                                      
                  or                                                                                       
                  -- widok my_recipes: przepisy użytkownika LUB publiczne przepisy w kolekcjach użytkownika
                  (                                                                                        
                      $2 = ''my_recipes''                                                                  
                      and (                                                                                
                          r.user_id = $1                                                                   
                          or (                                                                             
                              r.visibility = ''PUBLIC''                                                    
                              and exists(                                                                  
                                  select 1                                                                 
                                  from public.recipe_collections rc                                        
                                  inner join public.collections c on c.id = rc.collection_id               
                                  where rc.recipe_id = r.id                                                
                                    and c.user_id = $1                                                     
                              )                                                                            
                          )                                                                                
                      )                                                                                    
                  )                                                                                        
              )                                                                                            
              -- Filtr kategorii                                                                           
              and ($3::bigint is null or r.category_id = $3)                                               
              -- Filtr tagów (przepis musi posiadać WSZYSTKIE wskazane tagi)                               
              and (                                                                                        
                  $4::bigint[] is null                                                                     
                  or array(                                                                                
                      select rt.tag_id                                                                     
                      from public.recipe_tags rt                                                           
                      where rt.recipe_id = r.id                                                            
                  ) @> $4                                                                                  
              )                                                                                            
              -- Filtr wyszukiwania (dopasowanie wzorca case-insensitive w nazwie)                         
              and (                                                                                        
                  $5::text is null                                                                         
                  or r.name ilike ''%%'' || $5 || ''%%''                                                   
              )                                                                                            
        ),                                                                                                 
        counted_recipes as (                                                                               
            select                                                                                         
                fr.*,                                                                                      
                count(*) over() as total_count                                                             
            from filtered_recipes fr                                                                       
        )                                                                                                  
        select                                                                                             
            cr.id,                                                                                         
            cr.name,                                                                                       
            cr.image_path,                                                                                 
            cr.created_at,                                                                                 
            cr.visibility,                                                                                 
            cr.is_owner,                                                                                   
            cr.in_my_collections,                                                                          
            cr.user_id as author_id,                                                                       
            p.username as author_username,                                                                 
            cr.category_id,                                                                                
            c.name as category_name,                                                                       
            cr.total_count                                                                                 
        from counted_recipes cr                                                                            
        left join public.profiles p on p.id = cr.user_id                                                   
        left join public.categories c on c.id = cr.category_id                                             
        order by %s                                                                                        
        limit $6                                                                                           
        offset $7                                                                                          
    ', v_sort_clause)                                                                                      
    using                                                                                                  
        p_user_id,           -- $1                                                                         
        p_view,              -- $2                                                                         
        p_category_id,       -- $3                                                                         
        p_tag_ids,           -- $4                                                                         
        p_search,            -- $5                                                                         
        p_limit,             -- $6                                                                         
        v_offset;            -- $7                                                                         
end;                                                                                                       
$$                                                                                                         
Try rerunning the command with --debug to troubleshoot the error.
Error: Process completed with exit code 1.

</aktualne_zachowanie>

<oczekiwane_zachowanie>

brak błedów deployowania backendu

</oczekiwane_zachowanie>


<implementation_rules>



</implementation_rules>


Przeanalizuj przedstawiony bug, porównując aktualne zachowanie z oczekiwanym zachowaniem. Uwzględnij wszystkie dostarczone materiały: PRD, stos technologiczny, plan UI, Plan API, typy oraz aktualną implementację.

Przed podaniem rozwiązania, użyj tagów <analiza> do przemyślenia problemu:
- Zidentyfikuj różnice między aktualnym a oczekiwanym zachowaniem
- Przeanalizuj aktualną implementację w kontekście planu UI i typów i API
- Określ prawdopodobną przyczynę buga
- Zaplanuj kroki naprawy

Następnie napraw buga.

Pamiętaj, że wszystkie odpowiedzi, komentarze w kodzie i wyjaśnienia mają być w języku polskim. Kod powinien być gotowy do implementacji i zgodny z przedstawionym stosem technologicznym oraz planem API.
