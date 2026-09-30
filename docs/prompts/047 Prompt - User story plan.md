Jesteś doświadczonym analitykiem produktowym i architektem oprogramowania. Twoim zadaniem jest przeanalizowanie informacji o projekcie aplikacji webowej i dodanie nowej funkcjonalności do istniejącego projektu.

Oto dokumenty o projekcie, które musisz przeanalizować:

<project_summary>
@docs\results\project-summary.md
</project_summary>

<functionality_analysis>
@docs\results\new-features\premium-users\analiza-funkcjonalnosci-premium-users.md
</functionality_analysis>


<user_story>


### PS-66: Checkout i płatności (subskrypcja Premium)

**Opis:**
Jako zalogowany użytkownik Free, chcę zakupić subskrypcję Premium przez bezpieczny checkout, aby uzyskać dostęp do zaawansowanych funkcji aplikacji.

**Kryteria akceptacji:**
- [ ] Strona checkoutu jest dostępna pod `/checkout` lub jako modal (auth required).
- [ ] Obsługiwane są metody płatności: BLIK oraz karta (PayU lub odpowiednik).
- [ ] Domyślnie wybrany jest plan roczny (z możliwością przełączenia na miesięczny).
- [ ] Po pomyślnej płatności webhook dostawcy płatności aktualizuje `app_role` na `premium` w `auth.users.raw_app_meta_data` oraz zapisuje dane subskrypcji (data startu, data następnej płatności, ID transakcji).
- [ ] Użytkownik otrzymuje potwierdzenie zakupu na e-mail.
- [ ] Faktura/paragon jest generowany i dostępny dla użytkownika.
- [ ] W przypadku błędu płatności użytkownik widzi czytelny komunikat i może ponowić próbę.
- [ ] Checkout nie jest dostępny dla gości (redirect do rejestracji/logowania).
- [ ] Obsługiwany jest scenariusz zakupu, gdy użytkownik ma aktywny trial.

</user_story>

Twoim zadaniem jest:

1. Dokładnie przeanalizować wszystkie dostarczone podsumowanie projektu, aby zrozumieć obecną architekturę, funkcjonalności i strukturę aplikacji
2. Na podstawie opisu nowej funkcjonalności, stworzyć odpowiednie dokumenty umożliwiające zaplanowanie nowej implementacji:
   - 'PS-{story-no}-{nazwa-ficzera-po-angiesku}-api-plan.md' - zapisz opis nowych/zmienionych endopintów
   - 'PS-{story-no}-{nazwa-ficzera-po-angiesku}-ui-plan.md' - zapisz opis nowych/zmienionych widoków
   - 'PS-{story-no}-{nazwa-ficzera-po-angiesku}-deployment-plan.md' - zapisz opis które trzeba wykonac poza kodem i aby nowy ficzer działal np. utworzenie i skonfigurowanie zewnętrzej usługi, uzyskanie kluczy i zapisanie ich w odpowiednim miejscu, migracja bazy itp. Nie uwzgledniaj akcji, które wykonają się automatycznie w github actions. Uwzglenij tylko to co musi być zrobione recznie. Zapisz je w docs\results\new-features\user-stories\PS-{story-no}
   

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
1. {Treść pytania pierwszego}
Moja rekomendacja:
{treść rekomendacji}

2. {Treść pyutania drugiegoo}
Moja rekomendacja:
{treść rekomendacji}

dopiero po udzieleniu przez zużytkownika odpowiedzi przystąp do wykonywannia powyższych poleceń. W swojej pracy uzyj odpowiedzi udzielonych przez użytkownika.
