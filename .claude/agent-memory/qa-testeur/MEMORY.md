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
