# Gauntlet, tour 2: revue adverse (G6) des piliers 5 (interface) et 4 (son, retours)

| Champ | Valeur |
|---|---|
| Relecteur | ux-ui-designer (auteur des maquettes, pas du code de l'interface ni du son) |
| Date | 2026-10-31, de 10 h 25 à 10 h 40 UTC |
| Version relue | arbre de travail courant, sans aucune modification du code, des données ni des maquettes |
| Méthode | même cadrage qu'au tour 1 (`revues/tour-01-interface-son.md`): page de démonstration de l'interface servie par Vite sur le port 5303, scripts Playwright du tour 1 relancés: 15 scénarios à 1366x768 et 150 % (`rendu=0`), 8 scénarios à 100 %, aménagement à 100, 125, 150 % et à 1280x720 en échelle 1,5; contrôle nouveau d'intersection entre la barre d'aménagement et les régions du HUD; parcours au clavier avec lecture du journal `lplInterface.log.sounds`; `npx vitest run src/interface src/audio` |
| Limites | toujours aucune écoute; captures à 150 % sans scène 3D |

## Verdict

**Mieux qu'avant, pour les deux piliers.** Les quatre corrections demandées (I1, I3, S1, S2) et les variantes des sons fréquents se vérifient au même cadrage, sans régression au clavier, au focus ni à 100 %. Restent ouverts, sans changement depuis le tour 1: les transitions (I2), les frictions au clavier (I4), les astuces (I5), le motif unique des habitants, la variété musicale et la mesure du mixage d'ensemble.

| Pilier | Tour 1 | Tour 2 | Raison |
|---|---|---|---|
| 5. Interface et lisibilité | 6,5 | **7** | plus aucune collision ni débordement à 125 et 150 %; le plaisir des transitions, critère du pilier, n'a pas bougé |
| 4. Son et musique (retours) | 7 sur dossier | **7,5 sur dossier** | l'interface répond enfin à chaque geste et un refus ne sonne plus comme une bonne nouvelle; répétition sur une heure et mixage d'ensemble encore à traiter |

## Pilier 5: preuves

| Défaut du tour 1 | Constat au tour 2 | Preuve |
|---|---|---|
| I1 aménagement | corrigé: portrait, endurance, boutons de caméra et du carnet masqués tant qu'un meuble est en main, comme la maquette; plus d'astuce en double. Intersection mesurée entre la barre et les éléments visibles du HUD: 0 à 100, 125 et 150 % et à 1280x720 en échelle 1,5 | `captures/tour-02/ux-01-amenagement-1366x768-taille150.png` (avant: `captures/tour-01/ux-02`, `ux-03`) |
| I3 panneaux à 150 % | corrigé: « Fermer » reste dans le comptoir, onglets sous le titre, 5 articles visibles (2 avant); caisse 4 lignes sur 4 (2 avant); objectif masqué pendant une proposition; nuit et fin lues depuis le haut, « Continuer » entier à l'écran (seule la note « Ensuite… » de la fin demande de défiler, comme annoncé) | `ux-02-comptoir`, `ux-03-caisse`, `ux-04-fin` (avant: `tour-01/ux-04` à `ux-07`) |
| I2 transitions | inchangé: toujours 5 `@keyframes` dans `composants.css`, aucun dans `interface.css`; portrait des habitants toujours figé (`dialogue.ts`, ligne 141, expression `good`) | lecture du code |
| I4 clavier | inchangé: à la création, 8 arrêts de Tab avant « C'est parti ! »; au comptoir, Tab va et vient entre « Acheter 1 » et « Acheter 4 » du premier article; un bouton vert par ligne | script `clavier2.cjs`, `ux-02` |
| I5 astuces | inchangé: `hint_till` et `hint_toolbar` toujours à la souris seule | `donnees/astuces.json` |

Régressions cherchées, aucune trouvée:

- **Clavier et focus**: Tab ouvre le carnet sur la quête en cours, E change d'onglet, flèches dans le sac, Retour arrière ferme et rend la main au jeu; proposition sans vol de focus, Entrée l'amène sur « D'accord »; dialogue, caisse, comptoir, titre: anneau de focus présent à chaque étape.
- **100 %**: HUD, aménagement, comptoir, caisse, dialogue, carnet sans débordement ni défilement horizontal (les textes signalés hors fenêtre sont dans des corps de panneau qui défilent).
- **Tests**: 21 fichiers, 154 tests verts dans `src/interface` et `src/audio`.

Petites remarques nouvelles, sans incidence sur la note: à 150 %, dans la caisse, la jauge de la ligne non livrée est plus courte et décalée vers la gauche (« Reprendre » passe à côté du bouton); au comptoir, les deux boutons d'achat sont empilés à 100 % et côte à côte à 150 %.

## Pilier 4: preuves

| Défaut du tour 1 | Constat au tour 2 | Preuve |
|---|---|---|
| S1 menus muets | corrigé: famille « papier et bois » de 7 sons à 2 ou 3 variantes, branchée par `InterfaceOptions.sound`. Journal relevé: changement d'onglet `ui-tab`, flèches et Tab `ui-focus`, achat `ui-confirm`, fermeture `ui-panel-close`, réplique suivante `ui-next`, « Au revoir » par Retour arrière `ui-back`, « Commencer la semaine » `ui-confirm`; flèche tenue 1,5 s: un seul `ui-focus`, pas de rafale | `clavier2.cjs`, `sons.json` (84 sons) |
| S2 refus | corrigé: Entrée sur « Rien à déposer » joue `ui-refusal`; les notifications de refus passent par `isRefusal` et jouent `ui-refusal` au lieu de `notify` (`declencheurs.ts`, ligne 453), 600 ms au moins entre deux. Signature décrite dans `son.md`: grave, sans mélodie, distincte du carillon et de l'erreur de Duo | journal, `declencheurs.ts`, `tests/refus.test.ts` |
| Variantes des sons fréquents | corrigé: `order-stamp` 3, `water-fill` 2, `chest-open` 2, `chest-close` 2 | `sons.json` |
| Motif unique par habitant (S3 du tour 1) | inchangé: `talk-*` à 1 fichier, répliques sans « voix » | `sons.json` |
| Variété musicale (S4) | inchangé: deux thèmes de jour, même musique sous la pluie | `plan.musicByMoment` |
| Mixage d'ensemble (S5) | inchangé: seuls les fichiers sont mesurés | `mesures.csv` |

Non vérifié en direct: le refus d'une pose de meuble (couvert par les tests selon `ETAT.md`, pas rejoué ici); le son à la création: chaque Tab joue `ui-focus`, ce qui fait 8 tics avant « C'est parti ! » (I4 rend ce point plus audible).

## Priorités pour le tour 3

| # | Défaut | Correction | Membre | Effort | Gain attendu |
|---|---|---|---|---|---|
| 1 | I2: transitions et micro-animations | les six gestes du tour 1 (passage entre écrans, ouverture et fermeture des panneaux, réplique révélée, expression par réplique, ligne d'objectif tamponnée, objet qui vole vers sa case), spécifiés par ux-ui-designer avec directeur-artistique avant le code | ux-ui-designer, directeur-artistique, dev de l'interface | 45 + 240 min | pilier 5: +1 |
| 2 | Motif unique des habitants et répliques muettes | trois versions par habitant (motif complet à la première conversation du jour, deux signatures courtes ensuite), deux ou trois notes de l'instrument de l'habitant à chaque « Suite » à la place du `ui-next` générique | sound-designer, dev audio | 120 + 20 min | pilier 4: +0,5 |
| 3 | I4: un arrêt de Tab par groupe | création: un arrêt par groupe de choix et les flèches dedans; comptoir: Tab de ligne en ligne puis « Fermer », vert seulement sur la ligne qui a le focus. Corrige aussi les 8 tics de focus de la création | dev de l'interface | 45 min | pilier 5: +0,3 |

Ensuite: mesure du mixage d'ensemble dans le banc (S5, 60 min), variété musicale (S4), réécriture des deux astuces (I5).

## À tester chez le client

- Les nouveaux sons d'interface à la centième écoute, surtout `ui-focus` (le plus fréquent) et `ui-confirm`, et qu'ils restent sous la musique.
- Le refus `ui-refusal`: compris comme « pas possible » sans paraître punitif.
- Les points du tour 1 restent valables: musique de jour sur une heure, niveau entre le salon de Duo et le jeu, motifs des habitants.

## Captures

Dans `docs/jeux/jeu-1/gauntlet/captures/tour-02/`, au même cadrage que les captures du tour 1 qui portent le même sujet:

| Fichier | Ce qu'elle montre | Avant |
|---|---|---|
| `ux-01-amenagement-1366x768-taille150.png` | barre d'aménagement seule en bas, rien de recouvert | `tour-01/ux-02` |
| `ux-02-comptoir-1366x768-taille150.png` | « Fermer » dans le panneau, onglets sous le titre, 5 articles; restent les boutons verts sur chaque ligne (I4) | `tour-01/ux-04` |
| `ux-03-caisse-1366x768-taille150.png` | les 4 lignes de la commande visibles | `tour-01/ux-06` |
| `ux-04-fin-1366x768-taille150.png` | carte lue depuis le haut, « Continuer » entier | `tour-01/ux-07` |
