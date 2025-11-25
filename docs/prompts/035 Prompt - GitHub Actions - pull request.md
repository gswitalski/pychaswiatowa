Jesteś specjalistą GitHub Actions w scacku 

Utwórz scenariusz "pull-request.yml" na podstawie

Workflow:
Scenariusz "pull-request.yml" powinien działać następująco:

- lintowanie kodu
- unit tests
 - finalnie - status-comment (komentarz do PRa o statusie całości)

 Dodatkowe uwagi:
- status-comment uruchamia się tylko kiedy poprzrdni zestaw przejdzie poprawnie.
- zbieraj coverage unit testów
