# Carnet de qa-testeur

Apprentissages durables et vérifiés. Ni avancement ni secret.

## Conventions de recette

- Critères de la plateforme: `CA-PF-NNN`, identifiants jamais réattribués; un nouveau critère prend le premier numéro libre et se range dans la section de sa fonction. Hypothèses `H-xx`, messages `M-xx` reliés aux écrans `E01` à `E19` de `docs/plateforme/ux/parcours.md`.
- Chaque critère: étant donné, quand, alors, puis une ligne « Vérification: ... Jalon: ... Hypothèse: ... ». Modes: U, E, EL, P2, CI, D, M (définis dans `docs/plateforme/criteres-acceptation.md`, section 1.2).
- Avant de rendre un document de critères, contrôler mécaniquement: numérotation continue, quatre puces par critère, table des hypothèses et catalogue des messages cohérents dans les deux sens, couverture des critères M par la check-list, colonnes des tableaux. Les chiffres de couverture se calculent, ils ne s'estiment pas (une estimation à la main était fausse).
- Le cahier, l'architecture et la spécification UX avancent en parallèle: relire `git log` avant de rendre, le cahier peut avoir changé de version en cours de mission.

## Environnement cloud (vérifié le 2026-10-30)

- Root avec CAP_NET_ADMIN: `ip netns`, ponts et paires veth fonctionnent; installer `iproute2` par apt (absent au départ). Diffusion UDP reçue d'un espace de noms à l'autre; `ip link set ... down` donne une vraie coupure.
- Le noyau n'a pas netem (`CONFIG_NET_SCH_NETEM` absent): latence et gigue par un mandataire en espace utilisateur (Toxiproxy, MIT, binaire téléchargeable sur les releases GitHub); pertes réelles par nftables: `numgen random mod 100 < 2 drop`.
- Passerelle piège pour prouver l'absence de sortie vers Internet: route par défaut de l'espace de noms vers une adresse du pont, compteur nftables sur le crochet `prerouting` (le crochet `forward` compte 0, car le routage jette avant).
- L'environnement définit `HTTPS_PROXY=http://127.0.0.1:<port>` et Chromium le suit: retirer les variables de mandataire dans les tests hors ligne, sinon les sorties passent par la boucle locale et échappent à la passerelle piège.
- `strace -f -e trace=connect` relève toutes les tentatives de connexion d'Electron (DNS vers 8.8.8.8 compris).
- Playwright joint Electron par la boucle locale (CDP): le pilote doit tourner dans le même espace de noms réseau que l'instance pilotée. Electron, Xvfb et Playwright tournent ensemble dans un espace de noms (`ip netns exec ... xvfb-run node test.js`).
- L'Xvfb de l'environnement ignore `setxkbmap fr` et `xkbcomp` (vérifié avec `xmodmap -pke`): impossible d'y obtenir une vraie disposition AZERTY. Pour les tests, injecter par CDP `Input.dispatchKeyEvent` avec `code: 'KeyQ', key: 'a'`; la vraie disposition se vérifie chez le client.
- `--force-device-scale-factor=1.5` émule Windows à 150 %: fenêtre de 1280x720 en pixels CSS, `devicePixelRatio` 1,5 (hauteur intérieure arrondie à 721).
- `app.setPath('userData', ...)` accepte un chemin avec espaces, accents, apostrophe et émoji sous Linux; `forcefullyCrashRenderer()` déclenche `render-process-gone` (raison `crashed`) sans fermer la fenêtre.
- axe-core et @axe-core/playwright sont sous MPL-2.0: admissibles comme outils de test non livrés, à signaler.

## Accessibilité

- CIEDE2000 maison: contrôle sur la paire 1 de Sharma, Wu et Dalal (2005), attendu 2,0425. Simulation du daltonisme de Machado, Oliveira et Fernandes (2009), sévérité 1,0, appliquée en RVB linéaire. La palette d'Okabe et Ito donne au pire 21,7 en vision normale et 10,9 après simulation: seuils de 20 et 10 atteignables.

## Jeux dans le faux hôte (vérifié le 2026-10-31, La Petite Ligne)

- Sonde sans crochet: en mode `servir`, la page de l'invité reçoit par WebSocket des trames `{"t":"net","channel":N,"data":"<json>"}`; canal 1 = état complet faisant autorité (`data.world`), 2 = positions rapides, 3 = événements. `page.on('websocket')` + `framereceived` suffit (`games/la-petite-ligne/tests/e2e/sonde.ts`).
- Rendu logiciel et machine partagée: une image par seconde environ. `locator.click()` expire en attendant les navigations: cliquer par `locator.evaluate((n) => n.click())`. Les boutons radio stylés (input masqué) bloquent `check()` sans délai: cliquer le texte du libellé, et toujours fixer `actionTimeout`.
- Le chien de garde (Duo et faux hôte) coupe la partie après 5 s sans battement une fois le jeu prêt (10 s au chargement): mesurer les tâches longues par un `addInitScript` de contexte (il s'applique aussi à l'iframe du jeu) avec `PerformanceObserver` `longtask`.
- Explorations jetables hors du dépôt: dossier de travail avec un lien `node_modules` vers celui du jeu et une config Playwright à part. Un `console.log` dans un fichier du dépôt fait échouer `pnpm verifier` et la CI de tout le monde.
- Ne jamais `pkill` Chromium par motif: d'autres membres en font tourner sur la même machine; arrêter ses propres tâches de fond (TaskStop).
- Bug connu sans correctif: test `it.fails` avec la référence du bug, la CI reste verte et le test échoue dès la correction (à passer en `it`).
- Robots de La Petite Ligne: la graine ne change pas leur parcours (8 graines, durées et résultats identiques); la variété vient des options du robot.
- Pilote clavier en rendu logiciel: ne pas supposer l'orientation de la caméra, la réestimer d'après le déplacement observé; lire la position une fois le personnage arrêté (les instantanés de l'hôte ont 1 à 2 s de retard); un appui de 200 ms peut faire plusieurs mètres ou rien du tout selon la durée des images. Jouer les étapes fragiles (pause) avant les longues marches: l'horloge tourne pendant la marche, et minuit ramène tout le monde à la maison.
- Robots de La Petite Ligne dans le navigateur: construire avec `NODE_ENV=development vite build` (`import.meta.env.DEV` vrai, le module du robot est embarqué), et rediriger le cadre `/jeu/` du faux hôte vers `/jeu/?robot=1&rendu=leger` par `context.route` (302): le faux hôte n'ajoute aucun paramètre à l'adresse du jeu. En rendu léger, la démo entière se joue en 37 min à deux navigateurs, simulation au temps réel.
- Vitest 5 (config de /tmp/qa5/g2) n'affiche pas les `console.info` des tests qui passent: écrire les rapports d'exploration dans un fichier (`appendFileSync`) plutôt que dans la console.
- Valider un test à verser sans toucher au dépôt: copie du jeu par `tar` (pas de rsync ici) dans /tmp, liens vers `node_modules` et `assets`, puis `tsc`, `eslint` et `vitest` dans la copie (seuls les imports relatifs vers `packages/` cassent, c'est attendu).
- Bancs de La Petite Ligne: les places se vérifient avec `BenchSeating` (comme le rendu) et non avec la seule position des habitants; un habitant « assis » garde sa vraie position à un mètre du banc.

## Moments rares et reprises dans le faux hôte (vérifié le 2026-11-01, tour 6)

- `page.on('websocket')` ne voit que les WebSocket ouvertes après l'abonnement: s'abonner avant `goto` (la sonde de `sonde.ts` le fait dans `startDuo`; un écouteur ajouté après `startDuo` ne reçoit rien).
- Démarrer une partie à deux au jour voulu: sauvegarde générée en Node (robot jusqu'à l'aube voulue, `snapshotOf`), écrite dans `<donnees>/sauvegardes/emplacement-1.json` (champs de `StoredSaveSchema`, `data` = `JSON.stringify(world)`), profils fixés par `addInitScript` dans `localStorage['duo-sdk-dev:profil']` (`{id:'membre-a',name,color:'orb'}`), puis « Héberger et continuer ». Le serveur réécrit la sauvegarde à l'aube: en garder une copie.
- Début d'apogée lisible dans le DOM: `.lpl-clock[data-watch="climax"]` (sans délai de stabilisation); un `MutationObserver` posé par `addInitScript` de contexte s'applique aussi au cadre du jeu.
- `tests/aides.ts` ne s'importe pas dans Playwright (`import.meta.glob` de Vite): charger le contenu par `loadContent(CONTENT_FILES)`; pas de `"type":"module"` dans le dossier de la spec (les imports JSON exigeraient un attribut).
- Le serveur Vite de la page de rendu recharge la page quand l'arbre de travail change (autres membres): une capture peut tomber sur « Chargement du rendu... »; vérifier la taille du PNG et refaire.
- Le dépôt bouge pendant la mission (commits et arbre de travail des autres): noter le commit de chaque mesure et relancer G1 sur le dernier avant de conclure.

## Moments du tour 7 et souvenirs (vérifié le 2026-11-01)

- Les bêtes des moments ne sont repoussées des joueurs (`pushOut`) qu'en attente et après, autour de leur point de repos (`roam`, `shy.stepTo`): les trajets d'arrivée, d'effarouchement et d'apogée ne sont pas protégés. Contrôle: placer un joueur sur le trajet (cases libres de l'anneau) et mesurer la distance à la pose dessinée (`freezeState`, `startlePose`, `sampleTrack`, `actorPose`), pas seulement à `actorPose`.
- Après une apogée réussie, un moment d'ambiance passe encore en `left` à `present.to`: tout ce qui est parti pendant l'apogée (`after.actors.*.at: null`) rejoue son départ. Toujours regarder la phase `left` après une apogée, pas seulement sans apogée.
- La rumeur (`rumorMoment`) se vérifie au long cours avec `content.settings.clock.lastDay.day` relevé (400): dans la démo, l'horizon est borné au jour 15 et masque les saisons.
- Sauvegarde de test en milieu de journée: partir d'un état de robot, déplacer les joueurs par `placeCharacter`, avancer `clock.minutes` pour laisser au moins 30 s réelles avant l'instant à capturer (le chargement à deux en prend 10 à 20).
- Dans le faux hôte, la touche envoyée par `frame.locator('body').press` n'atteint pas toujours l'invité; dans Duo (Electron), `page.keyboard.press` sur la vue du jeu marche chez les deux.
- Les places et les habitants ne se repoussent pas entre eux (règle du jeu depuis le tour 6): un contact joueur-Basile près de l'échelle n'est pas un bug du tour.

## Robot longue vie et Duo à deux instances (vérifié le 2026-11-01, tour 8)

- Une commande lancée en tâche de fond sans `timeout` est tuée au bout de 30 minutes: toujours fixer `timeout` (jusqu'à 7 200 000 ms) pour les suites de robots.
- Machine partagée (charge 25 sur 4 cœurs): le temps réel d'une partie de robot ne veut rien dire; relever `process.cpuUsage()` dans la partie (une partie par fichier, un processus par fichier avec le pool `forks`). Repère: 2,2 s de processeur par journée de jeu, 3,9 s au rythme de 0,8 s par minute.
- Rapport agrégé de plusieurs fichiers de test Vitest: chaque test écrit son relevé JSON, puis `globalSetup` (fonctions `setup` et `teardown`) assemble le rapport à la fin.
- Lever la limite du jour 43 sans toucher au code: `structuredClone(contentAndMap().content)`, puis `settings.clock.lastDay`; `restoreWorld(sim.content, ...)` garde ce contenu aux reprises. Au jour `lastDay` sans étape, l'horloge s'arrête (`stoppedBy: 'ended'`) mais la phase reste `day`.
- Sauvegarde de La Petite Ligne posée dans Duo: `sauvegardes-locales/la-petite-ligne/1/<sha256>.json` (octets UTF-8 de `JSON.stringify(world)`) et `head.json` (schema 1, revision, sha256, label, progress, dataSchema, gameVersion, size, writtenAt, previous). L'invitée n'appuie pas sur « Prête »: le décompte part dès l'hôte (son bouton est masqué par le voile du décompte).
- L'interface du jeu écrit l'apostrophe typographique (’): les attentes de texte des tests de bout en bout doivent l'employer.
- Contrôle I-08 (variables non remplies): les astuces gardent les jetons de touches et de `contentVars` (`{bigPurchase}`...), les répliques `{partner}`, `{henColorN}`, `{secret}`, remplis par l'interface; lettres, titres de quête et écrans arrivent déjà remplis.
- Robot glouton: sac plein, il rachète un matelas chaque fois que le précédent tombe au sol (il ne compte que sac et coffre): ne pas lire sa taille d'état comme celle d'un vrai duo.

## Deux Tabliers dans le faux hôte (vérifié le 2026-11-08, recette de nuit)

- `pnpm --filter <jeu> typecheck lint test build` passe `lint test build` en arguments à `tsc` (TS5112): lancer les scripts un par un.
- `deux-vues.html` reprend l'emplacement 1 de `localStorage['duo-sdk-dev:deux-tabliers:sauvegarde:1']` (champs de `StoredSaveSchema`, `data` = `JSON.stringify(world)`, membres `membre-hote` et `membre-invite`): poser la sauvegarde par `addInitScript` dans le seul cadre du haut (`window === window.top`). Les cadres du jeu sont ceux dont l'adresse contient `/jeu/`.
- Sauvegardes de robot faites avec `fallbackPrepSeconds`: la préparation d'office laisse les tickets sur le rail; au-delà de 64 Kio de domaine `service`, la partie s'arrête au chargement. Filtrer `service.tickets` sur les groupes présents avant de charger, sauf pour prouver le défaut.
- Caisse par le vrai poste: Agir maintenu 2,5 s plus 0,4 s par article au-delà du premier (neuf articles: 5,7 s); un robot qui relâche avant laisse le groupe à la caisse et la journée ne finit pas.
- Sans verrouillage du pointeur, les `pointermove` synthétiques ne tournent pas la caméra: il faut d'abord un vrai clic sur la toile.
- Deux navigateurs à deux vues WebGL logicielles en parallèle peuvent réveiller le chien de garde (« Le jeu ne répond plus »): une partie à la fois.
- Le faux hôte ne reprend pas une partie en cours après la déconnexion de l'invité: arrêt chez l'hôte, relance depuis la sauvegarde.

## Recette v0.2 de Deux Tabliers (vérifié le 2026-11-08)

- Vraie sauvegarde d'une version passée: `git archive <commit> games/<jeu> | tar -x -C <tmp>`, lien `node_modules` vers celui du jeu, robot en Vitest dans la copie; les sauvegardes produites se versent dans `tests/donnees/`.
- Journée accélérée (`secondsPerGameMinute` 0,05): `serviceSec` ne dépasse pas une soixantaine de secondes; un seuil « après 60 s de service » n'est jamais atteint.
- Deux Tabliers: le stock peut différer de la somme des lots pendant un pas (tickets rendus après `reconcileLots`); contrôler un écart qui dure deux pas. La caisse peut être négative en journée, le report « à régler » (EC-06) ne se fait qu'au soir.
- Faux hôte: une vue qui garde le verrouillage du pointeur reçoit aussi les clics faits sur l'autre vue (et donc les touches); `document.exitPointerLock()` dans les deux cadres avant de cliquer une vue. Filtrer les cadres du jeu par `url().startsWith('http://localhost:<port du jeu>')`: l'adresse de `deux-vues.html` contient aussi celle du jeu (`?jeu=`).
- Écran du matin et bilan du soir de Deux Tabliers: modaux, Tab n'y ouvre pas le téléphone; une action marketing ne se lance qu'après « Commencer la journée » d'un seul joueur.
- Sonde WebGL par `addInitScript` de contexte (programmes vivants, appels et triangles par image via `requestAnimationFrame`): s'applique aux cadres du jeu. En 1600x640, deux vues logicielles réveillent le chien de garde; 1280x520 passe.
- Avant de publier un jeu: comparer `version` de `duo-game.json` aux étiquettes `jeu-<id>-v*` de `git ls-remote --tags origin`.
