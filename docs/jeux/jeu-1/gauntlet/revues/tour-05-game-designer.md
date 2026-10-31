# Tour 5: revue adverse du game designer (plaisir, originalité)

| Champ | Valeur |
|---|---|
| Relecteur | game-designer (n'a pas produit le travail du tour 5) |
| Date | 2026-10-31 |
| Version lue | branche `claude/stoic-lamport-lueey2` à `bc723aa` |
| Épreuves | G6 (plaisir: « mieux qu'avant »), G7 (originalité) |
| Références | `revues/tour-04-contenu-coop.md`, grille au tour 4 (moyenne 7,1) |
| Sources | `donnees/quetes.json`, `habitants.json`, `envies.json`, `textes.json`, `reglages.json`; `src/rendu/personnages.ts`, `src/simulation/horloge.ts`, `robot.ts`; captures `captures/tour-05/` (dont `audit-apres/`, `budget/`) |

## Verdict

- **G6 plaisir: oui, mieux qu'avant**, avec trois réserves à traiter au tour 6 (aucune n'est une régression du plaisir).
- **G7 originalité: oui**, rien de reconnaissable d'Animal Crossing ni de Stardew Valley.

## G6: preuves du « mieux »

1. **Premier vrai aléa entre parties.** Quatre groupes de variantes d'après-midi (`afternoon_d6`, `d10`, `d11`, `d13`), deux variantes chacun, tirées par empreinte de la graine sans toucher au reste de la partie. Deux duos ne vivent plus la même semaine 2. Le tour 4 relevait « deux graines, même partie »: c'est corrigé sur quatre jours.
2. **Des buts qui ne sont plus des apports.** Les nouvelles variantes sont d'autres formes (R13 du plan): observer à deux (le héron du gué, `looked_at` à deux), attendre le bon moment (les oies, 17 h à 18 h 30), retrouver puis se coordonner (Basile perdu, tenir l'échelle à deux 8 s), défi chronométré (trois goujons avant 17 h). Mesure sur `quetes.json`: une partie joue 21 quêtes; la part d'apports va de 7 sur 21 (33 %) si toutes les variantes 0 sortent à 3 sur 21 (14 %) si toutes les variantes 1 sortent. Au tour 4: 11 ou 12 sur 21. Le seuil R13 (35 % au plus) est tenu pour toute graine.
3. **Le jour 6 est prouvé.** `tests/apres-midi.test.ts` et `tests/portages.test.ts` relancés ici: 9 tests passés en 4,8 s (pissenlits ramassés et rendus le jour 6, graine 42). La priorité 1 du tour 4 est soldée.
4. **L'énigme de la cloche devient jouable par un vrai duo.** Avec `secondsPerGameMinute` = 0,35, la fenêtre de 17 h à 17 h 45 dure environ 16 s réelles (contre quelques secondes pour une fenêtre ponctuelle). Le banc remonté sur le quai, à côté de la cloche, rend l'indice de Jeanne (« La cloche, c'est celle du quai. Le banc est juste à côté ») vrai à l'écran: la planche `coherence-09-banc-quai-1630-1715-1740.png` montre l'ombre qui avance et la marque au pied du banc à 17 h 15 et 17 h 40.
5. **La draisine suit ses rails.** On pousse dans l'axe de la voie, elle ne recule pas, s'arrête au bout (`reglages.carry.handcar.path`, 8 m). Le geste à deux le plus important de la semaine 2 est enfin crédible: on ne pousse plus un wagonnet dans l'herbe.
6. **Un monde plus aimable.** L'arrondi (`arrondi-en-jeu-avant-apres.png`, `arrondi-place-19h.png`), les bouts de chemin en demi-cercle, le gué de pierres plates (`planche-gue.png`: on comprend qu'on traverse là) et Jeanne vraiment assise sur son banc (`banc-avant-apres.png`) font un bourg où l'on a envie de flâner. Pour un jeu de vie paisible, c'est du plaisir direct.
7. **Des refus qui expliquent.** Le poêle dos au mur refuse avec une raison et un geste à faire (`placement_back_wall`: « Ça se pose dos à un mur, pour le tuyau: approche-toi d'un mur. »), et l'ancienne sauvegarde avec un poêle au milieu reste valable.

## G6: réserves (à corriger au tour 6, sans bloquer le tour 5)

1. **Les spectacles promis ne se voient pas.** Aucun héron, aucune oie, aucune échelle ni nichoir n'existe dans les modèles, le rendu ou le son (recherche dans `src/`, `assets/`, `sons.json`: seuls les textes `heron_seen` et `geese_seen`). On envoie le duo « regarder le héron sans bouger » vers un gué vide, et la récompense est une ligne de texte. Le même texte annonce « en criant » sans aucun cri. Une action sans retour est un défaut de design; ici c'est la récompense elle-même qui manque. Gravité moyenne: les quêtes se finissent, mais l'émotion visée (un moment contemplatif à deux) n'arrive pas.
2. **Les joueurs ne peuvent pas s'asseoir.** Le tour annonce « on s'assoit vraiment sur les bancs », mais seuls les habitants s'assoient, ainsi qu'un joueur absent ou qui mange (`personnages.ts`, `kind === 'sit' || 'eat'`; la seule source de `sit` côté joueur est l'absence, `horloge.ts`). Or deux envies (« S'asseoir un moment sur le banc du quai », « Se retrouver sur le banc du quai ») et la quête des oies (« S'asseoir à deux sur le banc ») le demandent: les joueurs restent debout 10 s à côté du banc où Jeanne, elle, est assise. Le contraste est plus visible maintenant que les habitants s'assoient.
3. **Les visages arrondis lisent moins bien les humeurs.** Sur `arrondi-planche-joueur.png`, rangée « après », les yeux suivent la courbure de la tête: « fatiguée » et « affamée » deviennent asymétriques et se distinguent mal de « neutre » à distance de jeu. Ces expressions sont un retour de jeu (faim, fatigue), pas seulement du décor. À confirmer par le directeur artistique à la taille réelle à l'écran.

## G7: originalité

Oui. Contrôlé point par point:

- **Univers et personnages**: un bourg ferroviaire français d'après-guerre, des habitants humains (Firmin, chef de halte bénévole; Odette, l'épicière; Basile, menuisier retraité; Jeanne, dix ans et demi), une ligne à rouvrir. Aucun animal anthropomorphe, aucun personnage de guide reconnaissable, aucune île ni ferme héritée.
- **Systèmes**: pas de jauge de cœurs ni d'amitié chiffrée (recherche dans les données: aucun), pas de saisons de 28 jours, pas de centre communautaire à paquets, pas de magasin tenu par un raton ni de dette de maison. Le catalogue arrive par le train du samedi et les gros colis se portent à deux du quai à la maison: c'est propre au jeu.
- **Nouveautés du tour**: héron, oies, échelle, défi de pêche et énigme de l'ombre de la cloche sont des formes génériques (observer, attendre, deviner) dans des habillages originaux.
- **Présentation**: le low poly arrondi rapproche du rendu « doux » des simulations de vie en général, mais les proportions (personnages humains, têtes cubiques adoucies), la palette (toits ardoise et tuile, bois, vert de locomotive) et le sujet ferroviaire restent distincts. Vigilance pour la suite: ne pas aller vers des têtes très grosses et rondes avec de grands yeux, qui rapprocheraient d'Animal Crossing.

## Notes proposées

| Pilier | Tour 4 (grille) | Proposée | Justification |
|---|---|---|---|
| 1. Ressenti | 7 | **7** | Rien de neuf sous les doigts au tour 5. Gain: la draisine qui suit la voie (on ne lutte plus contre elle). Perte de crédibilité: s'asseoir n'est pas une action possible alors que le jeu le demande. Je n'ai pas mesuré la latence ici. Pas de raison de bouger. |
| 5. Interface | 7 | **7** | Le refus `placement_back_wall` est clair et dit quoi faire; c'est une petite amélioration, mais il manque toujours un retour pendant les buts d'observation (rien n'indique qu'on « regarde » le gué, ni combien de temps il reste sur le banc). Il dit « approche-toi d'un mur » alors qu'il faut aussi tourner le meuble dos au mur. Aucun travail du tour sur 1366x768 et 150 %. |
| 6. Contenu et rythme | 7 | **7,5** | Aléa réel sur quatre jours, quatre formes nouvelles, jour 6 prouvé, R13 tenu pour toute graine. Sous 8: les variantes ne touchent que quatre jours sur quinze et deux options chacune (16 semaines possibles, le reste identique); les trois buts contemplatifs n'ont pas de spectacle; la structure des 100 heures (arcs, saisons, réserves R1 à R9) n'a pas avancé. |
| 7. Coopération | 7,5 | **7,5** | Trois buts de plus qui demandent les deux (héron, échelle, oies), mais tous de même nature: « se tenir ensemble à un endroit ». Aucun geste d'une nature nouvelle (rythme, guidage), et toujours une seule information propre à chacun (l'envie), priorité 2 du tour 4 non traitée. Plus de moments à deux, pas de coopération plus riche: note inchangée. |

## Les trois améliorations à plus fort effet pour le tour 6

### 1. Les « moments rares » visibles, et en réserve (piliers 2, 6 et 7)

Donner corps au héron, aux oies et à l'échelle, puis en faire un système réutilisable: une réserve de moments contemplatifs tirés selon le lieu, l'heure, la météo et la saison, jamais deux fois le même en 7 jours. C'est la matière la moins chère pour 100 heures sans répétition (R1, R8, R9 du plan) et elle fait se retrouver le couple sans contrainte.

- Héron posé sur une pierre du gué de 14 h à 19 h quand la variante sort (attente, tête qui pivote), envol avec son à la réussite; V d'oies qui traverse le ciel au-dessus du quai avec leurs cris; échelle contre un arbre de la lisière, Basile qui monte, nichoir redressé.
- Critères de réussite: chaque moment a un modèle animé visible au moins 3 s sur les deux écrans, au même instant (écart sous 0,5 s, test de bout en bout à deux instances) et un son; une séquence capturée par moment; le texte final ne promet rien qui ne se voit ni ne s'entend (relecture texte contre rendu); réserve d'au moins 6 moments à la fin du tour, robot sur 8 graines: aucun moment répété dans une fenêtre de 7 jours.

### 2. Une information que seul l'un voit (pilier 7, R16)

Report du tour 4, toujours le levier le plus fort pour faire parler le couple. Proposition la moins chère pour la démo: le carnet de Jeanne (variante 0 du jour 13) n'apparaît que chez un joueur sous forme d'indice (« sous les planches, côté amont »), l'objet n'est ramassable que par l'autre; ou le regard du métier (les cases qui ont soif visibles du seul jardinier).

- Critères de réussite: au moins une quête par semaine de la démo dont l'information n'est affichée qu'à un joueur et dont l'action est faite par l'autre; test unitaire qui vérifie que l'état d'interface du second joueur ne contient pas l'information; robots qui finissent la quête sur toutes les graines; observation chez le client: le couple en parle à voix haute (question au compte rendu de session).

### 3. S'asseoir à deux, vraiment (piliers 1 et 7)

Ajouter l'action « s'asseoir » sur les bancs (et les chaises, le bord du ponton): la touche d'action près d'un banc fait asseoir, toute direction fait se lever. Deux joueurs assis côte à côte ouvrent un petit moment partagé: musique qui s'adoucit, caméra qui recule légèrement, et c'est la condition des envies de banc et de la quête des oies (au lieu de « rester 10 s à côté »).

- Critères de réussite: l'animation d'assise démarre en moins de 100 ms après l'appui, avec un son de bois; aucune touche morte près d'un banc (test: action à moins de 1,2 m d'un banc donne `sit`, mouvement donne `idle`); `bench_moment`, `bench_together` et `wild_geese` exigent l'état assis (tests de quête mis à jour, robots qui s'assoient et finissent sur toutes les graines); capture des deux joueurs assis sur le banc du quai à 17 h, regardée de près (rien qui traverse le dossier ni l'accoudoir).

## Non vérifié

- Je n'ai pas lancé `rendu.html` ni joué: revue faite sur les données, le code, deux fichiers de tests relancés et les captures. Le ressenti au clavier n'est pas mesuré.
- L'aspect des marques d'objectif (anneau au pied du banc) pendant les buts d'observation: vu sur une capture seulement, pas à l'usage.
- La lisibilité des visages à la taille réelle à l'écran (réserve 3), à confirmer par le directeur artistique.
- Le tirage des variantes sur un grand nombre de graines (je m'appuie sur le test d'endurance décrit dans `ETAT.md`, non relancé ici).
