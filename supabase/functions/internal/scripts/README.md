# Skrypty testowe funkcji `internal`

Uruchom lokalne środowisko Supabase oraz funkcję `internal` z opcją `--no-verify-jwt`, a następnie wykonaj z katalogu głównego projektu:

```powershell
.\supabase\functions\internal\scripts\test-normalized-ingredients-worker.ps1
```

Skrypt wywołuje worker normalizacji składników przy użyciu lokalnego sekretu deweloperskiego.
