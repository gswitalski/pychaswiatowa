Jesteś doświadczonym analitykiem produktowym i architektem oprogramowania. Twoim zadaniem jest przeanalizowanie informacji o projekcie aplikacji webowej i dodanie nowej funkcjonalności do istniejącego projektu.

Oto dokumenty o projekcie, które musisz przeanalizować:

<project_summary>
@docs\results\project-summary.md
</project_summary>

<functionality_analysis>
@docs\results\new-features\premium-users\analiza-funkcjonalnosci-premium-users.md
</functionality_analysis>


<user_story>

### PS-64: Model danych i egzekwowanie limitów kredytów AI

**Opis:**
Jako system, chcę przechowywać i egzekwować limity kredytów AI per użytkownik, aby kontrolować koszty infrastruktury i umożliwić model freemium (1–3 udane importy lifetime dla Free, miesięczna pula dla Premium).

**Kryteria akceptacji:**
- [ ] Nowa tabela lub kolumny w bazie danych przechowują: liczbę dostępnych kredytów AI (draft, obraz), zużyte kredyty, datę ostatniego resetu (Premium), typ limitu (lifetime dla Free, miesięczny dla Premium).
- [ ] Endpoint `/ai/recipes/draft` i `/ai/recipes/image` weryfikują stan kredytów przed wykonaniem wywołania AI.
- [ ] Przy braku kredytów zwracany jest status `402 Payment Required` z kodem błędu `AI_CREDITS_EXHAUSTED`.
- [ ] Zużycie kredytu jest odejmowane wyłącznie po pomyślnym zakończeniu wywołania AI (liczy się udany import).
- [ ] Worker normalizacji składników NIE zużywa puli kredytów UI (osobna pula wewnętrzna).
- [ ] Dla użytkownika Premium: kredyty odnawiają się miesięcznie w dacie pierwszej płatności.
- [ ] RLS oraz polityki Supabase chronią dane kredytów przed odczytem/modyfikacją przez innych użytkowników.


</user_story>

Twoim zadaniem jest:

1. Dokładnie przeanalizować wszystkie dostarczone podsumowanie projektu, aby zrozumieć obecną architekturę, funkcjonalności i strukturę aplikacji
2. Na podstawie opisu nowej funkcjonalności, stworzyć odpowiednie dokumenty umożliwiające zaplanowanie nowej implementacji:
   - 'PS-{story-no}-{nazwa-ficzera-po-angiesku}-api-plan.md' - zapisz opis nowych/zmienionych endopintów
   - 'PS-{story-no}-{nazwa-ficzera-po-angiesku}-ui-plan.md' - zapisz opis nowych/zmienionych widoków
   - 'PS-{story-no}-{nazwa-ficzera-po-angiesku}-deployment-plan.md' - zapisz opis które trzeba wykonac poza kodem aby nowy ficzer działal np. utworzenie i skonfigurowanie zewnętrzej usługi, uzyskanie kluczy i zapisanie ich w odpowiednim miejscu, migracja bazy itp. Zapis je w docs\results\new-features
   

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
Zanim przystapisz do pracy, ale po zapoznaniu się podsumowaniem projektu, zadaj mi kilka pytań uszczegóławiających moje wymagania co do nowej funkcjonalności oraz twoje rekomenacje co do odpowiedzi. 
pytania zadaj w formacie
1. {Treść pyutania pierwszego}
Moja rekomendacja:
{treść rekomendacji}

2. {Treść pyutania drugiegoo}
Moja rekomendacja:
{treść rekomendacji}

dopiero po udzieleniu przez zużytkownika odpowiedzi przystąp do wykonywannia powyższych poleceń. W swojej pracy uzyj odpowiedzi udzielonych przez użytkownika.
