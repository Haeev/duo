# Retours de la séance du 4 novembre 2026

Version jouée: Duo 0.3.0 sur le Mac (invité), La Petite Ligne 0.13.0. Première séance notée avec le carnet de séance (Ctrl+N): 21 notes de 20 h 37 à 21 h 17, jours 12 à 15. Les notes brutes (texte, état, images) restent hors du dépôt; les captures utiles sont réduites ici.

## Constats du client

- R01. (test du carnet, sans objet)
- R02. Église: les bougies flottent dans le vide au-dessus de leur support (`r02-bougies.webp`).
- R03. On entend à peine la cloche de l'église: elle devrait s'entendre dans tout le bourg.
- R04. Proposition: suivre une seule quête à la fois, avec un repère au bord de l'écran qui indique la direction, et un indicateur discret sur l'objectif quand il est à l'écran (option).
- R05. Un grand rectangle au bord blanc devant le personnage, devant la terrasse du café: on ne comprend pas ce que c'est (`r05-rectangle-cafe.webp`). Contour de cible d'un geste du décor, sans objet visible.
- R06. Le chemin de terre le long de la rivière fait un drôle de tracé par rapport à la berge (`r06-chemin-berge.webp`).
- R07. Quête du colis à porter à deux jusqu'au fournil: le colis est là, la quête ne se valide pas.
- R08. Les réverbères ne s'allument que quand un joueur s'approche: le soir, ils doivent tous être allumés.
- R09. Recette du radis: le nom de la recette apparaît et disparaît alors que la souris n'est pas dessus.
- R10. Dans tous les menus, survoler un élément doit afficher un mot ou une mini-phrase (4 mots au plus) qui dit ce que c'est.
- R11. Carte postale (présentoir de l'épicerie): le personnage s'assoit dans le vide (`r11-carte-postale.webp`).
- R12. Onglet Voisins, vue « Le bourg »: on ne comprend pas ce plan (`r12-carte-bourg.webp`). Un rectangle vert presque vide, des pictos sans rues, sans rivière, sans légende.
- R13. Le portrait de Firmin clignote dans l'onglet Voisins.
- R14. Un carré d'eau au milieu de rien, dans l'herbe près de la rivière (`r14-carre-eau.webp`).
- R15. Le lavoir semble s'ouvrir côté rivière: personne ne pourrait y accéder (`r15-lavoir.webp`).
- R16. Quête de Basile: impossible de trouver la draisine, toute la voie parcourue.
- R17. Au passage à niveau, une case interactive sans objet: le personnage s'assoit dans le vide (`r17-passage-niveau.webp`).
- R18. L'orgue de l'église: l'animation se joue mal et aucune musique ne sort.
- R19. L'autre joueur n'entend pas la cloche (son joué chez un seul des deux).
- R20. Basse-cour encore trop confuse: on ne comprend pas la différence entre le foin et le sac de grain, ni comment nourrir les poules.
- R21. Sur le quai, une case interactive: animation bizarre, puis rien (`r21-case-quai.webp`).

## Lecture du manager

- Gestes des joueurs dans le décor (R05, R11, R17, R21): des zones de geste posées sans objet visible, signalées par un contour blanc, avec une animation qui ne correspond à rien (s'asseoir sans siège). Règle: chaque geste s'attache à un objet visible, au bon clip, avec un libellé au survol; une zone sans objet est retirée.
- Son partagé (R03, R18, R19): cloche trop faible et jouée d'un seul côté, orgue muet.
- Quêtes bloquées (R07, R16): à reproduire par une simulation courte de chaque quête.
- Carte (R06, R14, R15) et rendu (R02, R08).
- Interface (R09, R10, R12, R13, R20) et suivi de quête (R04, proposition).

## Suites prévues

Petite vague de corrections le 5 novembre, publiée avant 21 h.
