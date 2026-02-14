Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w backendzie aplikacji.

Zapoznaj się z  projektem

<project_summary>



</project_summary>


<aktualne_zachowanie>

endpoint
admin-api.service.ts:14  GET http://127.0.0.1:54331/functions/v1/admin/summary 503 (Service Unavailable)

2026-02-13T21:30:51.859803838Z worker boot error: failed to bootstrap runtime: failed to create the graph: Relative import path "@angular/forms" not prefixed with / or ./ or ../
2026-02-13T21:30:51.859892708Z   hint: If you want to use a JSR or npm package, try running `deno add jsr:@angular/forms` or `deno add npm:@angular/forms`
2026-02-13T21:30:51.859899700Z     at file:///dev/pychaswiatowa/shared/contracts/types.ts:9:29
2026-02-13T21:30:51.860403251Z worker boot error: failed to bootstrap runtime: failed to create the graph: Relative import path "@angular/forms" not prefixed with / or ./ or ../
2026-02-13T21:30:51.860420488Z   hint: If you want to use a JSR or npm package, try running `deno add jsr:@angular/forms` or `deno add npm:@angular/forms`
2026-02-13T21:30:51.860423607Z     at file:///dev/pychaswiatowa/shared/contracts/types.ts:9:29
2026-02-13T21:30:51.874127050Z InvalidWorkerCreation: worker boot error: failed to bootstrap runtime: failed to create the graph: Relative import path "@angular/forms" not prefixed with / or ./ or ../
2026-02-13T21:30:51.874166578Z   hint: If you want to use a JSR or npm package, try running `deno add jsr:@angular/forms` or `deno add npm:@angular/forms`
2026-02-13T21:30:51.874170372Z     at file:///dev/pychaswiatowa/shared/contracts/types.ts:9:29
2026-02-13T21:30:51.874173027Z     at async Function.create (ext:user_workers/user_workers.js:155:29)
2026-02-13T21:30:51.874175592Z     at async Object.handler (file:///var/tmp/sb-compile-edge-runtime/root/index.ts:174:22)
2026-02-13T21:30:51.874178597Z     at async mapped (ext:runtime/http.js:242:18) {
2026-02-13T21:30:51.874181201Z   name: "InvalidWorkerCreation"
2026-02-13T21:30:51.874184906Z }
2026-02-13T21:30:52.827104171Z [Info] {"level":"info","message":"[plan] GET /plan","timestamp":"2026-02-13T21:30:52.799Z"}
2026-02-13T21:30:52.827156229Z 
2026-02-13T21:30:53.915439281Z [Info] {"level":"info","message":"[handleGetPlan] User c553b8d1-3dbb-488f-b610-97eb6f95d357 fetching plan","timestamp":"2026-02-13T21:30:53.915Z"}
2026-02-13T21:30:53.915482732Z 
2026-02-13T21:30:54.128919519Z [Info] {"level":"info","message":"[getPlan] User c553b8d1-3dbb-488f-b610-97eb6f95d357 plan: 10 accessible items (filtered from 10 total)","timestamp":"2026-02-13T21:30:54.128Z"}
2026-02-13T21:30:54.129193541Z 
2026-02-13T21:30:54.129203879Z [Info] {"level":"info","message":"[handleGetPlan] Returned 10 items for user c553b8d1-3dbb-488f-b610-97eb6f95d357","timestamp":"2026-02-13T21:30:54.128Z"}
2026-02-13T21:30:54.129207557Z
2026-02-13T21:30:54.132248753Z [Info] {"level":"info","message":"[plan] GET /plan - 200 (1333ms)","timestamp":"2026-02-13T21:30:54.131Z"}
2026-02-13T21:30:54.132295211Z
</aktualne_zachowanie>


<oczekiwane_zachowanie>

brak błedu

</oczekiwane_zachowanie>


<implementation_rules>



</implementation_rules>



Przeanalizuj przedstawiony bug, porównując aktualne zachowanie z oczekiwanym zachowaniem. Uwzględnij wszystkie dostarczone materiały: PRD, stos technologiczny, plan API, typy oraz aktualną implementację.

Przed podaniem rozwiązania, użyj tagów <analiza> do przemyślenia problemu:
- Zidentyfikuj różnice między aktualnym a oczekiwanym zachowaniem
- Przeanalizuj aktualną implementację w kontekście planu API i typów
- Określ prawdopodobną przyczynę buga
- Zaplanuj kroki naprawy

Następnie napraw buga.

Pamiętaj, że wszystkie odpowiedzi, komentarze w kodzie i wyjaśnienia mają być w języku polskim. Kod powinien być gotowy do implementacji i zgodny z przedstawionym stosem technologicznym oraz planem API.

