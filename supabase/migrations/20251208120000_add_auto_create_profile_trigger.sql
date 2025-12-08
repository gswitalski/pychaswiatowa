-- migration: add automatic profile creation trigger
-- description: automatically creates a profile record when a new user signs up
-- tables affected: profiles
-- dependencies: auth.users, profiles

-- funkcja do automatycznego tworzenia profilu po rejestracji użytkownika
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer -- wykonywana z uprawnieniami właściciela funkcji (postgres)
set search_path = public
as $$
begin
    -- tworzymy nowy profil z id użytkownika i username z metadanych
    insert into public.profiles (id, username)
    values (
        new.id,
        -- pobieramy username z raw_user_meta_data, jeśli nie ma to ustawiamy null
        coalesce(new.raw_user_meta_data->>'username', null)
    );

    return new;
exception
    when others then
        -- w przypadku błędu logujemy go, ale nie przerywamy tworzenia użytkownika
        raise warning 'Could not create profile for user %: %', new.id, sqlerrm;
        return new;
end;
$$;

-- dodajemy komentarz do funkcji
comment on function public.handle_new_user() is
    'Automatically creates a profile record when a new user is created in auth.users';

-- trigger wywoływany po utworzeniu nowego użytkownika w auth.users
-- uwaga: nie możemy dodać komentarza do triggera w schemacie auth ze względu na ograniczenia uprawnień
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

