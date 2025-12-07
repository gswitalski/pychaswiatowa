# 1. Dump struktury (schematy)
supabase db dump --local -f dump_schema.sql

# 2. Dump danych użytkowników (schemat auth)
supabase db dump --local --data-only --schema auth -f dump_auth.sql

# 3. Dump danych aplikacji (schemat public)
supabase db dump --local --data-only --schema public -f dump_data.sql

# 4. Połącz wszystko w jeden plik
Get-Content dump_schema.sql, dump_auth.sql, dump_data.sql | Set-Content dump.sql

# 5. Usuń tymczasowe pliki
Remove-Item dump_schema.sql, dump_auth.sql, dump_data.sql
