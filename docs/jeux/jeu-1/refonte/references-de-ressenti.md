# Refonte: références de ressenti

| Champ | Valeur |
|---|---|
| Statut | note du manager pour toute l'équipe, version 0.1 |
| Date | 2026-11-10 |
| But | fixer le ressenti visé (prise en main, rythme, narration) à partir des jeux que le client cite |

## Limites de cette note

- Le manager ne peut pas regarder de vidéo: il lit des pages et des résumés. Les liens de vidéos plus bas sont pour le client et pour mémoire; aucun n'a été visionné.
- Les sites de guides (strategywiki.org, thesimswiki.com) sont refusés par le réseau de la session. Ce qui est marqué « de mémoire » vient des connaissances générales du manager sur ces jeux et reste à confirmer par le client.
- Règle du studio: on s'inspire d'un genre et d'une intention. On ne reprend ni noms, ni personnages, ni lieux, ni interface, ni combinaison reconnaissable de règles.

## 1. Le quotidien: le genre « jeu de vie tranquille »

Référence du client: Animal Crossing. Ce qu'on en retient pour le ressenti (critiques lues, plus de mémoire):

1. **Une touche pour agir.** Un seul bouton fait la bonne action selon ce qu'on regarde et ce qu'on tient. Les critiques reprochent pourtant à ce jeu ses outils imprécis à cause de la vue: chez nous, la cible de l'action doit toujours être montrée avant d'appuyer (l'objet visé réagit, la case visée se marque).
2. **Tout répond.** Chaque geste a un son court, une petite animation de l'objet touché et souvent une particule. Secouer un arbre, creuser, pêcher: le plaisir vient de la réponse immédiate, pas de la récompense.
3. **Le personnage est expressif.** Il réagit à ce qu'il attrape (il le montre à la caméra, avec un jingle et une phrase), il a des émotions lisibles. Les habitants aussi: bulles d'émotion au-dessus de la tête.
4. **Dialogues courts, écrits lettre par lettre, avec un babil** propre à chaque personnage. Les habitants parlent de ce que le joueur a fait la veille et des événements à venir. Les développeurs disent s'être inspirés de vraies personnes pour chaque caractère: le but est qu'un habitant rappelle quelqu'un qu'on connaît.
5. **Collectionner donne un but sans obligation.** Chaque prise nouvelle est fêtée, rangée dans un registre, avec ses conditions (heure, météo, saison) qui poussent à revenir.
6. **Décorer à la souris, vu du dessus.** La version récente sur la nouvelle console permet de déplacer les meubles à la souris: c'est exactement le mode déco demandé par le client.
7. **Peu de choses à l'écran.** L'heure, l'argent; le reste vient quand il sert.
8. **Défaut à éviter**: les petites demandes répétées (« apporte-moi trois fruits ») lassent. Le client n'en veut presque pas.

Autres jeux du genre, pour des points précis:

- **Basse-cour**: dans les jeux de ferme, le soin des bêtes tient en un geste par jour, puis s'automatise par une amélioration (un distributeur qui remplit les mangeoires). Les joueurs se perdent quand l'état du distributeur n'est pas visible: chez nous, la nourriture restante et les œufs pondus se voient d'un coup d'œil, dans le monde et dans le panneau.
- **Jeux de ferme en coopération à deux** (plusieurs titres récents): chacun libre de ses gestes, progression commune, repas ou fêtes partagés comme temps forts.

## 2. La narration: une histoire guidée, de lieu en lieu

Référence du client: les versions portables des Sims 2 (PSP et DS). Ce qu'on en retient (pages lues, plus de mémoire):

1. **On dirige son personnage directement**, comme dans un jeu d'aventure, et non de haut. Ces versions sacrifient la liberté du bac à sable au profit d'une histoire.
2. **Une arrivée par accident, un lieu étrange.** Le personnage tombe en panne à l'entrée d'une ville bizarre et découvre peu à peu ce qui s'y trame. Ton: drôle, un peu inquiétant, jamais sombre. Du paranormal traité avec humour.
3. **Des quartiers qui s'ouvrent avec l'histoire.** Environ cinq quartiers et une vingtaine de lieux sur PSP; sur DS, huit lieux principaux et quatre petits. On débloque le suivant en accomplissant un objectif majeur de l'histoire (un but « en or » parmi les envies du personnage).
4. **Un logement qui grandit avec l'histoire**: sur DS, on reçoit un hôtel à remettre en état, à meubler, dont les clients sont des personnages de l'intrigue.
5. **Des objectifs personnels en plus de l'histoire** (sociabilité, savoir, argent), qui donnent des façons différentes de jouer.
6. **De mémoire, à confirmer**: les conversations sont un petit jeu en soi (on choisit un ton selon l'humeur de l'autre pour le convaincre); on collectionne des « secrets » appris auprès des habitants, qui servent de monnaie d'échange pour l'histoire; les besoins restent présents et un personnage épuisé ou sale rate ses échanges. C'est très proche de la jauge d'hygiène que demande le client (réponse 23).

Ce que ça donne pour nous: chaque lieu est une petite saison de série, avec un mystère central, des habitants qui cachent quelque chose, des secrets à apprendre en gagnant leur amitié, et un dénouement qui change le lieu. Le quotidien (ferme, pêche, cuisine, déco) nourrit l'histoire: on gagne la confiance d'un habitant par ce qu'on fait pour lui, pas par un compteur.

## 3. Règles de ressenti pour la refonte

À respecter par le design, l'interface, le rendu et le son:

| Sujet | Règle |
|---|---|
| Réponse à une action | visible et audible en moins d'un dixième de seconde; l'objet touché bouge |
| Cible | toujours montrée avant d'agir; une seule cible à la fois; jamais de zone d'action sans objet visible |
| Prise | une prise nouvelle (poisson, insecte, trésor) est fêtée: le personnage la montre, un jingle, une ligne de texte; une prise déjà connue va vite |
| Déplacement | accélération et freinage doux, le personnage se penche dans les virages, la caméra suit avec un léger retard |
| Caméra | proche du personnage, rotation libre, zoom à la molette; les murs et les toits s'effacent sans à-coup |
| Dialogue | bandeau bas avec portrait, texte lettre par lettre, babil, une touche pour tout afficher puis continuer; jamais plus de trois lignes par page |
| Habitants | une émotion lisible au-dessus de la tête; ils se souviennent d'hier |
| Attente | aucune action courante ne bloque plus d'une seconde et demie |
| Écran | l'heure et l'argent; les besoins n'apparaissent que quand ils changent d'état |
| Quêtes | de longues suites avec des rebondissements; presque pas de livraisons isolées |

## 4. Vidéos repérées (non visionnées)

Pour que le client dise ce qui lui plaît, à quelle minute:

- Versions portables des Sims 2, parties complètes sans commentaire: https://www.youtube.com/watch?v=h1-s6AVKNHs, https://www.youtube.com/watch?v=A2ruohP-ma0, https://www.youtube.com/watch?v=-6lOO8WO5Xw
- Jeux de vie en coopération: https://www.youtube.com/watch?v=NMJ2XhEKGTc (ferme en coopération), https://www.youtube.com/watch?v=eBk3EfM4fiQ (île en coopération)

## Sources lues

- https://www.analogstickgaming.com/game-reviews/2020/4/4/animal-crossing-new-horizons
- https://www.highgroundgaming.com/animal-crossing-new-horizons-review/
- https://twinfinite.net/guides/animal-crossing-new-horizons-controls-guide/
- https://nintendoeverything.com/animal-crossing-new-horizons-devs-on-creating-the-villagers-early-designs-shown
- https://www.thegamer.com/animal-crossing-new-horizons-villager-design/
- https://www.gamedeveloper.com/design/q-a-designing-for-empathy-in-wholesome-life-sim-i-cozy-grove-i-
- https://giantbomb.com/wiki/Games/The_Sims_2_87183
- https://www.mobygames.com/game/20451/the-sims-2/
- https://www.commonsensemedia.org/game-reviews/the-sims-2-psp
- https://gamezone.com/reviews/the_sims_2_psp_review
- https://screenrant.com/stardew-valley-how-to-feed-chickens-guide/
