# Assets

- `commun/`: ce qui sert dans tous les lieux. `commun/interface/` (vignettes et portraits à la plume, générés depuis `assets-src/interface-encre/`). `commun/personnages/` (lot L5): un GLB par emplacement, squelette commun de 24 os (ADR 0021). `commun/son/` (lot L9).
- `lieux/<lieu>/`: décor et sons d'un lieu, chargés à l'arrivée et libérés au départ (ADR 0018). Budget: 25 Mo par lieu.

Chaque asset généré garde sa fiche et ses sources à côté de lui (règles de `CLAUDE.md`).

## Exception acceptée: source du bonnet à pompon

Règle du studio: les sorties brutes d'un outil de génération ne se versionnent pas. Exception acceptée le 2026-11-10 par l'architecte pour `assets-src/personnages/meshy/hat-beanie-pompom.source.glb`: c'est la seule géométrie de l'aperçu (16 Ko, sans texture), entrée du script de conformité `construire_catalogue.py`. Meshy efface ses fichiers trois jours après la tâche; sans cette source, la pièce ne se régénérerait plus. Conditions: géométrie seule, moins de 100 Ko, fiche de génération à côté (`hat-beanie-pompom.meshy.json`). La même exception vaut pour toute pièce rigide de Meshy du catalogue, aux mêmes conditions; tout le reste des sorties brutes reste hors du dépôt (`meshy_output/`).
