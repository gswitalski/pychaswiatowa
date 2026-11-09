-- PS-31: lokalny test RLS i RPC notatek.
-- Uruchom po migracjach jako właściciel bazy, np.:
-- psql "$DATABASE_URL" -v user_a="'<uuid-a>'" -v user_b="'<uuid-b>'" -v recipe_id=123 -f supabase/tests/ps31_user_recipe_notes.sql
\set ON_ERROR_STOP on

begin;

-- Testy wykonujemy jako authenticated; request.jwt.claim.sub jest odczytywane przez auth.uid().
set local role authenticated;
select set_config('request.jwt.claim.sub', :user_a, true);

select out_recipe_id, out_note
from public.set_recipe_note(:recipe_id, '  konto A  ');

do $$
begin
    if not exists (
        select 1 from public.user_recipe_notes
        where user_id = current_setting('request.jwt.claim.sub')::uuid
          and recipe_id = :'recipe_id'
          and note = 'konto A'
    ) then
        raise exception 'PS-31: zapis lub normalizacja notatki nie powiodły się';
    end if;
end
$$;

-- Wszystkie trzy reprezentacje usunięcia muszą zakończyć się jednym wierszem RPC
-- i nie mogą próbować wstawić NULL do kolumny note.
select * from public.set_recipe_note(:recipe_id, null);
select * from public.set_recipe_note(:recipe_id, '');
select * from public.set_recipe_note(:recipe_id, '   ');

do $$
begin
    if exists (
        select 1 from public.user_recipe_notes
        where user_id = current_setting('request.jwt.claim.sub')::uuid
          and recipe_id = :'recipe_id'
    ) then
        raise exception 'PS-31: notatka nie została usunięta';
    end if;
end
$$;

-- Drugie konto nie może odczytać ani usunąć notatki konta A.
select set_config('request.jwt.claim.sub', :user_a, true);
insert into public.user_recipe_notes(user_id, recipe_id, note)
values (current_setting('request.jwt.claim.sub')::uuid, :recipe_id, 'prywatna');

select set_config('request.jwt.claim.sub', :user_b, true);
do $$
begin
    if exists (
        select 1 from public.user_recipe_notes
        where recipe_id = :'recipe_id'
    ) then
        raise exception 'PS-31: RLS ujawnia notatkę drugiego użytkownika';
    end if;
end
$$;

delete from public.user_recipe_notes where recipe_id = :recipe_id;

-- RPC drugiego konta nie może zmienić notatki na przepisie niedostępnym dla tego konta.
do $$
begin
    perform public.set_recipe_note(:recipe_id, 'nieuprawniona');
    raise exception 'PS-31: RPC pozwoliło na zapis bez dostępu do przepisu';
exception
    when sqlstate 'P0002' then null;
end
$$;

rollback;
