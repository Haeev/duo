# Carnet du game designer

Apprentissages durables (pièges, conventions, repères vérifiés). Pas d'avancement ici.

## Conventions de rédaction

- Dans les documents que lit le client, ne pas nommer les jeux qu'il cite en référence: écrire « le jeu de référence « île paisible » » ou « le jeu de référence de simulation de vie », et lister les éléments emblématiques écartés de façon générique.
- Tutoiement: le jeu tutoie chaque joueur; un personnage qui s'adresse aux deux joueurs à la fois dit « vous » (pluriel), ce qui reste conforme.
- Chiffres d'un plan de sortie: vérifier que version 1 + épisodes + activités transversales retombent sur le total annoncé (erreur commise puis corrigée le 2026-10-30).

## Homonymies et concepts déjà pris (à vérifier avant de proposer)

- Village bâti sur le dos d'une créature géante qui marche: existe déjà (city builder sorti en 2022).
- Taverne ou auberge avec ferme, brassage et coopération en ligne: genre encombré, plusieurs jeux existants; s'en distinguer nettement.
- « Les Discrets »: nom d'un groupe de musique français; éviter comme titre.
- « La Petite Ligne » (vérifié le 2026-10-30): aucun jeu, film, livre ni marque; expression courante (« petites lignes » ferroviaires), donc peu distinctive. Voisin: podcast « Monsieur Petites Lignes ». « Aubrune », « Samedi, le train », « Les Saisons d'Aubrune »: aucun résultat.
- Piège de l'outil de recherche: son résumé peut affirmer « de mémoire », sans source, qu'une œuvre existe. Ne jamais le reprendre sans une page qui le confirme; le signaler comme non vérifié.

## Écriture neutre (Duo ne connaît pas le genre des joueurs)

- Noms de traits épicènes qui marchent: Bonne fourchette, Craint le froid, Lève-tôt, Couche-tard, Langue bien pendue, Tête dans les nuages, Nid douillet, Nez au vent. Niveaux de forme: Petite forme, Ça va, En forme, Pleine forme, Forme rayonnante. Liens: Connaissance, Voisinage, Amitié, Grande amitié, Comme la famille.
- « Plus d'énergie » plutôt que « épuisé », « La fatigue se fait sentir » plutôt que « tu es fatigué ».
- Relire aussi les textes de conception: « deux habitantes » pour un homme et une femme est passé une fois.

## Repères de rythme (script `docs/jeux/jeu-1/simulations/rythme_et_collections.py`)

- Une journée de jeu d'environ 17 minutes réelles et quatre saisons d'environ 20 jours donnent environ 24 heures par année de jeu: 100 heures font environ 4 années de jeu et 150 séances de 40 minutes.
- À 2 heures de jeu par semaine, 100 heures font environ un an de vie réelle.
- Jeu 1, cahier v0.1 (`docs/jeux/jeu-1/simulations/economie_et_chapitres.py`): 0,8 s par minute de jeu, journée de 16,6 min en moyenne, 21 jours par saison, 23,3 h par année; 100 h = 361 journées.

## Collections tirées au hasard

- Sans aide, avec raretés (poids 6, 3, 1) et disponibilité saisonnière, atteindre 100 % prend 2 à 4 fois plus longtemps qu'atteindre 90 %: la fin traîne et ennuie.
- Un coup de pouce (poids x4 pour les entrées jamais vues) ramène l'achèvement juste après le dernier contenu débloqué. En faire la règle par défaut, réglable dans les tables d'équilibrage.

## Pièges de simulation

- Ne pas déduire un numéro de saison par division d'un temps en virgule flottante: au retour sur une frontière (6,6 x 3), l'arrondi peut bloquer la boucle sans fin. Compter les saisons par un entier.
- Pour une collection, seul compte l'instant de la prochaine entrée nouvelle: simuler cet événement (loi exponentielle entre deux changements d'état) est exact et des centaines de fois plus rapide que de simuler chaque tirage.

## Contrôles

- En AZERTY, la rangée des chiffres demande Maj: ne jamais en faire un passage obligé (barre d'outils à la molette, chiffres en raccourci facultatif).
- Entre AZERTY et QWERTY, seules A/Q, Z/W et M changent de place (le M AZERTY est le code `Semicolon`). Choisir les touches par défaut parmi les lettres qui ne bougent pas (B, C, E, F, G, R, X, Tab...), plus ZQSD par position et A et E (`KeyQ`, `KeyE`) pour tourner la caméra.
- Échap est réservé à la pause de la plateforme: un menu du jeu se ferme par sa propre touche ou par Retour arrière, jamais par Échap.

## Règles pour un jeu sans fin de partie sur Duo

- Horloge arrêtée pendant l'absence d'un joueur: plafonner ce que l'autre peut faire (endurance), sinon le temps figé devient un temps infini exploitable.
- La plateforme (H-11) inscrit « interrompue » une partie arrêtée par « Retour au salon »; pour un jeu à séances (H-20), c'est la fin normale d'une séance. À signaler au manager à chaque jeu de ce type.
- Rattacher chaque personnage à l'identifiant stable du joueur, jamais au rôle d'hôte, et prévoir un écran « Qui joue qui ? » quand l'identifiant n'est plus reconnu.

## Méthode de simulation (vérifiée sur le jeu 1)

- Des étapes calées sur un événement hebdomadaire (inauguration le dimanche) font des durées en marches d'une semaine: écrire « jour 23 [23-30] », pas une moyenne. Avant de rédiger une lecture (« c'est la confiance qui fixe le chapitre 1 »), mesurer quelle condition bloque vraiment: une première lecture était fausse.
- Une zone débloquée en cours de saison: ses entrées de collection doivent rester visibles les saisons suivantes, sinon l'achèvement glisse d'une année entière (17 % au lieu de 95 % sur le carnet d'oiseaux). Un coup de pouce par collection (x6 pour la plus grande, x4 ailleurs) vaut mieux qu'un seul réglage.
- Tenir les tables du cahier et les données des scripts identiques, et le prouver par un contrôle croisé automatique (analyse des tableaux Markdown contre les données du script).
- Un rattrapage proportionnel à ce qui reste (15 % des matériaux restants chaque samedi) ne change presque rien pour un duo médian et resserre la queue des duos lents: c'est le bon profil.
- `python3 script.py | head` lève BrokenPipeError: c'est le tube, pas le script.

## Démos courtes

- Une démo d'une heure qui couvre une semaine de jeu demande une horloge accélérée (0,35 s par minute de jeu pour 8 journées en 63 min, script `docs/jeux/jeu-1/simulations/demo_rythme.py`). Avec une horloge rapide, la marche mange la journée: carte compacte (64x48 m) et distances données en secondes.
- Pour une démo, fixer la commande et la météo (déroulé identique pour tous), et caler chaque quête sur un jour précis pour qu'il y ait une nouveauté par journée.
- Un objet livré au dernier jour (catalogue au train final) n'a pas d'effet jouable: mettre ce qui change la forme (le lit) en fabrication au milieu de la semaine.
