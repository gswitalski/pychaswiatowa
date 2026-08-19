Jesteś doświadczonym analitykiem produktowym i architektem oprogramowania. Twoim zadaniem jest przeanalizowanie informacji o projekcie aplikacji webowej i dodanie nowej funkcjonalności do istniejącego projektu.

Oto dokumenty streszczczenie informacji o projekcie, które musisz przeanalizować:

<project_summary>
@docs\results\project-summary.md
</project_summary>

<preminm_features>
@docs\analizaf0funkcjonalnosci-premium-v02.md
</preminm_features>


<nowa_funkcjonalnosc>

Jednolity model uprawnień (entitlements)


Opis:
Jako system chcę jedno źródło prawdy o tym, co konto może zrobić (rola, trial, kredyty, limity Free), żeby UI i backend konsekwentnie odmawiały lub pozwalały na funkcje Premium.

Kryteria akceptacji:
Istnieje serwis/warstwa (frontend + backend) zwracająca dla sesji: app_role, status subskrypcji (none / trial / active / past_due / canceled), datę końca okresu, pozostałe kredyty per pula.
admin ma co najmniej uprawnienia premium (bez reklam, dostęp do funkcji Premium), plus dostęp do /admin/*.
Guardy i Edge Functions nie polegają wyłącznie na ukryciu przycisku w UI — decyzja jest weryfikowana po stronie serwera.
Brak subskrypcji = traktowanie jak user (Free), nawet jeśli w JWT kiedyś była rola premium.

</nowa_funkcjonalnosc>

Twoim zadaniem jest:

1. Dokładnie przeanalizować wszystkie dostarczone podsumowanie projektu, aby zrozumieć obecną architekturę, funkcjonalności i strukturę aplikacji
2. Na podstawie opisu nowej funkcjonalności, stworzyć odpowiednie dokumenty umozliwiające zaplanowanie nowej implementacji:
   - '{nazwa-ficzera-po-angiesku}-requirements.md' - zapisz nowe funkcje i story tasks
   - '{nazwa-ficzera-po-angiesku}-api-plan.md' - zapisz opis nowych/zmienionych endopintów
   - '{nazwa-ficzera-po-angiesku}-ui-plan.md' - zapisz opis nowych/zmienionych widoków
   - '{nazwa-ficzera-po-angiesku}-deployment-plan.md' - zapisz opis które trzeba wykonac poza kodem aby nowy ficzer działal np. utworzenie i skonfigurowanie zewnętrzej usługi, uzyskanie kluczy i zapisanie ich w odpowiednim miejscu, migracja bazy itp.
   

Przed przystąpieniem do tworzenia rozszerzeń, użyj scratchpad do zaplanowania swojego podejścia:

<scratchpad>
[Tutaj przeanalizuj dokumenty, zidentyfikuj kluczowe elementy obecnej architektury, zastanów się jak nowa funkcjonalność wpasuje się w istniejący system, zaplanuj jakie konkretnie elementy trzeba dodać do każdego dokumentu]
</scratchpad>

Wymagania dotyczące odpowiedzi:
- Wszystko ma być napisane w języku polskim
- Zachowaj spójność ze stylem i formatem istniejących dokumentów
- Upewnij się, że nowe elementy logicznie wpasowują się w obecną architekturę
- Dla requirements: dodaj konkretne funkcje i przynajmniej jedną szczegółową historyjkę użytkownika
- Dla planu UI: opisz nowy widok/widoki z uwzględnieniem UX i interfejsu
- Dla planu API: dodaj konkretne endpointy z metodami HTTP, parametrami i odpowiedziami
- pliki wynikowe umieśc w foldzedze docs/results/new-features/{nazwa-ficzera-po-angielsku}


Twoja końcowa odpowiedź powinna zawierać cztery wyraźnie oznaczone sekcje:
1. wymagania (funkcje i taski)
2. Nowe lub zmienione API w planie API
3. Nowe lub zmienone widoki w planie UI  
4. Plan wdrożenia


Sformatuj swoją odpowiedź używając odpowiednich nagłówków i zachowując czytelną strukturę.


UWAGA:
Zanim przystapisz do pracy, ale po zapoznaniu się podsumowaniem projektu, zadaj mi kilka pytań uszczegóławiających moje wymagania co do nowej funkcjonalności oraz twoje rekomenacje co do odpoiwiedzi. 
pytania zadaj w formacie
1. {Treść pyutania pierwszego}
Moja rekomendacja:
{treść rekomendacji}

2. {Treść pyutania drugiegoo}
Moja rekomendacja:
{treść rekomendacji}

dopiero po udzieleniu przez zużytkownika odpowiedzi przystąp do wykonywannia powyższych poleceń. W swojej pracy uzyj odpowiedzi udzielonych przez użytkownika.

