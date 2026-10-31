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
