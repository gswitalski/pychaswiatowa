# Skrypty testowe funkcji `public`

Uruchom najpierw lokalne środowisko Supabase:

```powershell
supabase start
```

Następnie, z katalogu głównego projektu, uruchom wybrany skrypt:

```powershell
.\supabase\functions\public\scripts\test-feed-endpoint.ps1
.\supabase\functions\public\scripts\test-feed-cursor.ps1
.\supabase\functions\public\scripts\test-public-tips.ps1
.\supabase\functions\public\scripts\test-public-tips-simple.ps1
```

`test-feed-cursor.ps1` zawiera przykładowy kursor stronicowania i może wymagać aktualizacji, gdy dane lokalne się zmienią.
