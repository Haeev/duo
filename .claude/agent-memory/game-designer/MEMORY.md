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
- Pièges passés en recette (LPL-R04) et tournures neutres qui les remplacent: « les nouveaux » (de nouvelles têtes, les gens de la maisonnette), « tous les deux » (à deux, Retrouvez-vous à la maison), « des débutants » (pour un premier toit), « Chers nouveaux gardiens » (Bonjour à la nouvelle équipe), « Vous êtes les premiers voyageurs » (Personne n'était descendu ici). « Personne » et « quelqu'un » s'accordent comme pronoms, pas au joueur: permis.
- Le validateur des données de La Petite Ligne avertit de ces tournures et lit aussi le README: ne pas y citer de mauvais exemples, sinon il avertit sur le README lui-même.

## Libellés d'interface dans les données

- Avant de changer un libellé de `textes.json`, chercher dans `tests/e2e/` (Playwright clique par `getByRole(..., { name })`) et dans le code qui le réutilise: `ui.hud.day` sert aussi au libellé de la sauvegarde dans la bibliothèque de Duo (« samedi, jour 1, 14 h 20 »), où « jour N » distingue l'heure du jeu de la date réelle.
- Un brief peut demander un texte qui existe déjà (passe précédente non reportée dans ETAT.md): regarder `git log -S` avant d'écrire, puis améliorer et donner l'avant/après.
- Le manager peut committer pendant la mission: vérifier `git diff HEAD` avant le compte rendu pour dire ce qui reste à committer.
- « Chacun » est un masculin générique: l'éviter dans les textes du jeu (« Un goujon pour chaque canne », « à tour de rôle », « un pain par joueur »).

## Ajouter du contenu à La Petite Ligne (vérifié le 2026-10-31, semaine 2)

- Un objet dont le modèle n'a pas de substitut dans `src/rendu/substituts.ts` fait échouer `src/rendu/rendu.test.ts`, même si le GLB existe: le signaler au dev rendu à chaque nouveau modèle d'objet.
- Une nouvelle construction guidée ne s'affiche pas sans code de rendu dédié (`src/rendu/maison.ts`): pour du contenu « sans nouveau modèle », passer par dons (`given`), nuits (`nights_passed`) et scènes partagées.
- Le validateur lit le nombre de jours dans `reglages.clock.lastDay.day` et accepte `order.trains` et `order_complete` avec `day`.
- Le bois est fini (12 arbres, sans repousse, environ 7 abattus en semaine 1): ne pas remettre de planches dans une commande tardive.

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

## Données de jeu chargées par le code (La Petite Ligne, 2026-10-30)

- Conventions retenues: identifiants anglais en `snake_case`, clés en `camelCase` (comme `duo-game.json`), `tier` P0 ou P1 pour la priorité de production (ne pas l'appeler `priority`, déjà pris par la priorité numérique des dialogues). Schéma et vocabulaire des conditions et effets: `games/la-petite-ligne/donnees/README.md`; validateur: `games/la-petite-ligne/outils/valider_donnees.py`.
- Une valeur à un seul endroit: la commande vit dans `reglages.json` et les textes la citent par `{order}`; ne pas redire dans les réglages des conditions de quête.
- Piège: dans le contenu passé à l'outil d'écriture de fichiers, `"\u2014"` peut arriver comme un vrai tiret cadratin. Dans du code, écrire `chr(0x2014)`, puis relancer le contrôle typographique de CLAUDE.md.
- Après un effet qui vide un état (paiement de la commande), toute condition évaluée ensuite doit garder la valeur d'avant: le préciser dans le schéma.

## Anti-répétition sur 100 heures (script `docs/jeux/jeu-1/simulations/plan_100_heures.py`, 2026-10-31)

- Répliques du quotidien: le tirage « la moins récente pour ce joueur » divise par deux les redites récentes; une réserve par niveau de lien (8), par saison (10) et par temps (3), plus 40 % de souvenirs à variables, ramène les redites à moins de 28 jours à 0,7 %. Coût: environ 107 phrases par habitant, plus 20 par année vécue ensuite.
- Envies: une réserve fixe (même 24 par saison, même avec coup de pouce) est épuisée dès l'année 2; il faut un apport par arc (6 par saison) pour garder un tiers d'envies neuves.
- Volume d'écriture pour 100 h sans redite: environ 9 000 textes, six fois l'estimation naïve du cahier 0.1. Toujours chiffrer les réserves par habitant, pas un total global.
- Calendrier de référence de La Petite Ligne: 0,35 s par minute de jeu jusqu'au jour 23 (démo et J1), 0,8 s ensuite: 372 journées, 4,4 années, 99,9 h. Jour 16 = fête des semailles (dimanche), jour 22 = premier jour de l'été (samedi), jour 23 = inauguration.
- Piège mesuré par la revue du tour 1: le moteur de dialogues de la démo ne tire que parmi les répliques de plus haute priorité, d'où 55 % de redites; vérifier que la règle de tirage a changé avant d'en déduire un besoin d'écriture.
- Avant de nommer une quête, lister les titres de `quetes.json`: « Le quai en fête » et « Les gens du bourg » sont déjà pris par des quêtes de la démo.
- Constructions de la démo: format `elements` (`inputs`, `seconds`), deux joueurs vont deux fois plus vite; une bûche donne quatre planches à l'établi. Exprimer les chantiers dans ces unités, pas en « points de travail ».
