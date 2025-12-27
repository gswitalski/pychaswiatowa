Jesteś doświadczonym programistą aplikacji webowych. Twoim zadaniem jest przeanalizowanie i naprawienie buga w frontendzie aplikacji.

Zapoznaj się z dokumnetacją projektu 

<dokumentacja_projektu>



</dokumentacja_projektu>


<aktualne_zachowanie>

sciezka
http://localhost:4200/recipes/52/edit

klikam "wygeneruj zdjęcia za pomoca AI"

pojaia się komunikat
Brak autoryzacji. Zaloguj się ponownie.

endpoint POST http://127.0.0.1:54331/functions/v1/ai/recipes/image
{
  "recipe": {
    "id": 52,
    "name": "Mus z wędzonego pstrąga",
    "description": "Pyszny mus z wędzonego pstrąga, idealny na przystawkę lub elegancką kolację. Połączenie ryby z delikatną śmietaną i żelatyną sprawia, że jest to danie wyjątkowe.",
    "servings": null,
    "is_termorobot": false,
    "category_name": "Przekąska",
    "ingredients": [
      {
        "type": "item",
        "content": "500 g wędzonego pstrąga"
      },
      {
        "type": "item",
        "content": "200 ml śmietany"
      },
      {
        "type": "item",
        "content": "3 łyżeczki żelatyny"
      },
      {
        "type": "item",
        "content": "kilka plastrów wędzonego łososia"
      },
      {
        "type": "item",
        "content": "sól"
      },
      {
        "type": "item",
        "content": "świeżo mielony pieprz"
      }
    ],
    "steps": [
      {
        "type": "item",
        "content": "Obrać rybę i wyjąć ości."
      },
      {
        "type": "item",
        "content": "Zemleć w maszynce, dodać ubitą śmietanę, rozpuszczoną żelatynę, sól i pieprz do smaku."
      },
      {
        "type": "item",
        "content": "Wymieszać masę."
      },
      {
        "type": "item",
        "content": "Prostokątną foremkę wyłożyć plastrami łososia, tak by znacznie wystawały poza brzegi."
      },
      {
        "type": "item",
        "content": "Napełnić foremkę masą rybną."
      },
      {
        "type": "item",
        "content": "Wygładzić wierzch."
      },
      {
        "type": "item",
        "content": "Przykryć z wierzchu plastrami łososia."
      },
      {
        "type": "item",
        "content": "Wstawić na kilka godzin do lodówki."
      },
      {
        "type": "item",
        "content": "Po zastygniciu wyjąć z foremki i pokroić w plastry."
      },
      {
        "type": "item",
        "content": "Podawać ozdobione koperkiem, plasterkiem cytryny z dodatkiem sosu jogurtowo-chrzanowego."
      }
    ],
    "tags": [
      "eleganckie",
      "przystawka",
      "rybne",
      "szybkie"
    ]
  },
  "output": {
    "mime_type": "image/png",
    "width": 1024,
    "height": 1024
  },
  "output_format": "pycha_recipe_image_v1"
}


zwraca


{
  "code": "UNAUTHORIZED",
  "message": "Token missing app_role claim. Please sign in again."
}



</aktualne_zachowanie>

<oczekiwane_zachowanie>
generuje się zdjęcie

</oczekiwane_zachowanie>


<implementation_rules>



</implementation_rules>


Przeanalizuj przedstawiony bug, porównując aktualne zachowanie z oczekiwanym zachowaniem. Uwzględnij wszystkie dostarczone materiały: PRD, stos technologiczny, plan UI, Plan API, typy oraz aktualną implementację.

Przed podaniem rozwiązania, użyj tagów <analiza> do przemyślenia problemu:
- Zidentyfikuj różnice między aktualnym a oczekiwanym zachowaniem
- Przeanalizuj aktualną implementację w kontekście planu UI i typów i API
- Określ prawdopodobną przyczynę buga
- Zaplanuj kroki naprawy

Następnie napraw buga.

Pamiętaj, że wszystkie odpowiedzi, komentarze w kodzie i wyjaśnienia mają być w języku polskim. Kod powinien być gotowy do implementacji i zgodny z przedstawionym stosem technologicznym oraz planem API.
