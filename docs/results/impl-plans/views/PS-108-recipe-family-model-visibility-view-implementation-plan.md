# PS-108 — plan implementacji widoków

Nie dotyczy: PS-108 jest migracją modelu i kompatybilności backendu; nie
udostępnia użytkownikowi operacji na grupach/wariantach, nie zmienia routingu,
widoków, stanów UI ani kształtu istniejących DTO. Kontrakty pozostają
addytywne, więc aktualne komponenty nie wymagają zmian. `viewSkipped = true`
wynika z obecności tego oznaczenia w planie (procedura `feature-stage.ps1`).

Pokrycie scenariuszy GWT **8–20** i testy jednostkowe frontendowe pozostają po
stronie planu API tylko w zakresie niezbędnym do potwierdzenia braku regresji;
nie planuje się nowych komponentów standalone, sygnałów, serwisów, routingu,
stanów loading/error/empty ani testów Vitest. Brak E2E.
