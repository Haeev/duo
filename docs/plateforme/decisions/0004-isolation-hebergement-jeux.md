# ADR 0004: Isolation et hébergement des jeux

| Champ | Valeur |
|---|---|
| Statut | acceptée (manager, 2026-10-30) |
| Date | 2026-10-30 |
| Rédacteur | architecte-technique |
| À relire par | dev-plateforme |
| Fonctions du cahier | F05, F06, F10; section 6 (« chaque jeu tourne dans un processus isolé ») |
| Liens | ADR 0003 (processus), 0005 (contrat et pont), 0009 (parties interrompues), 0013 (tests) |

## Contexte

F05 exige qu'un jeu qui plante ou se fige ramène les deux joueurs au salon en 5 secondes au plus (10 s s'il se fige), sans fermer Duo ni perdre la dernière sauvegarde. La plateforme doit aussi afficher ses propres écrans par-dessus le jeu (pause, connexion perdue, erreur, résultats), garder Échap pour la pause dans tous les jeux, relâcher les touches à la perte du focus sans mettre en pause, et libérer toutes les ressources d'un jeu à sa sortie (CA-PF-043, CA-PF-104).

Faits vérifiés le 2026-10-30 avec Electron 45.2.0 sous `xvfb-run` (essai jetable): vue jeu, vue plateforme et iframe d'un autre schéma dans trois processus distincts; plantage forcé signalé par `render-process-gone` (raison `crashed`), la vue plateforme restant vivante; boucle infinie détectée en 2 s par battement de cœur sur le `MessagePort`, alors que l'événement natif `unresponsive` ne s'est pas déclenché en 45 s; vue plateforme transparente superposée à la vue jeu (sous Linux); fermeture de la vue jeu qui rend 25 à 35 Mo. Documentation d'Electron 45.2.0: `before-input-event` est émis avant les événements clavier de la page et `preventDefault()` les supprime; `powerSaveBlocker` mode `prevent-display-sleep` garde l'écran et le système éveillés.

## Options

| Option | Plantage ou blocage du jeu | Libération des ressources | Écrans de la plateforme par-dessus | Complexité |
|---|---|---|---|---|
| A. Import dynamique dans la page du lanceur | aucune isolation: une boucle infinie ou une fuite fige le lanceur | dépend de la discipline de chaque jeu | triviaux (DOM) | la plus faible |
| B. iframe d'un autre schéma dans la page du lanceur | processus séparé grâce à l'isolation des sites, sans garantie contractuelle; plantage visible seulement par battement de cœur | à la fermeture de l'iframe | triviaux | faible |
| C. `WebContentsView` dédiée dans la même fenêtre | processus séparé garanti; plantage signalé par `render-process-gone`; blocage tué par `forcefullyCrashRenderer()` | complète: le processus du jeu disparaît | vue plateforme transparente au-dessus | moyenne |
| D. Fenêtre dédiée au jeu | comme C | comme C | délicats: deux fenêtres, plein écran et Spaces de macOS, focus | forte |

Superposition des écrans de la plateforme, deux options:

| Option | Pour | Contre |
|---|---|---|
| Vue plateforme transparente au-dessus de la vue jeu, masquée quand rien ne s'affiche | le jeu reste vivant derrière (il continue de dessiner pendant la pause, la reprise est immédiate) | transparence et focus entre vues vérifiés sous Linux seulement |
| Image figée du jeu (`capturePage`) en fond de la vue plateforme, vue jeu masquée | indépendant de la transparence | capture coûteuse sur le PC de référence, image figée même quand le jeu doit continuer (fin de partie animée) |

## Décision

1. **Option C**: une `WebContentsView` par partie, créée au chargement et détruite à la fin (`webContents.close()`), dans une session Chromium dédiée aux jeux et **non persistante** (partition sans préfixe `persist:`): un jeu ne garde rien d'une partie à l'autre en dehors des sauvegardes du SDK.
2. **Superposition**: vue plateforme transparente au-dessus, masquée par `setVisible(false)` quand aucun écran ne s'affiche, pour que le jeu reçoive clavier et souris. Quand un écran apparaît, la vue plateforme prend le focus; la vue jeu perd le focus et le SDK relâche toutes les touches. Panneaux opaques à 92 %, sans flou (identité « Étoile double »: le flou d'arrière-plan ne verrait pas le jeu de toute façon). Repli si la transparence ou le focus posent problème sous macOS ou Windows: image figée.
3. **Échap et raccourcis réservés**: le principal écoute `before-input-event` sur la vue jeu; Échap n'atteint jamais le jeu (`preventDefault`) et déclenche la pause; F11 (Windows) aussi. Le manifeste ne peut pas attribuer Échap (ADR 0005).
4. **Perte du focus de la fenêtre et fenêtre réduite** (F05, H-12): aucune pause; le SDK relâche les touches à l'événement `blur`. La vue jeu a `backgroundThrottling: false`, et la boucle de simulation du SDK chez l'hôte est cadencée par des minuteurs, pas par `requestAnimationFrame` (ADR 0005), pour garder 60 pas par seconde fenêtre réduite.
5. **Veille** (CA-PF-130): `powerSaveBlocker.start('prevent-display-sleep')` du départ de la partie à la sortie de la vue jeu, pause comprise; levé au retour au salon.
6. **Délais et détection**:

| Événement | Détection | Effet |
|---|---|---|
| Chargement trop long | 30 s sans message `ready` | échec du chargement: les deux machines reviennent au salon (CA-PF-034) |
| Plantage du processus du jeu | `render-process-gone` | immédiat |
| Erreur non rattrapée ou promesse rejetée non gérée dans le jeu | gestionnaires `error` et `unhandledrejection` posés par le SDK, qui envoie `fatal` | immédiat: dans une version publiée, toute erreur non rattrapée est fatale, car l'état de la simulation n'est plus sûr |
| Jeu figé | battement de cœur du SDK chaque seconde; 8 s sans battement pendant la partie, 30 s pendant le chargement (amendement du 2026-10-31) | `forcefullyCrashRenderer()`, puis comme un plantage |
| Sauvegarde de sortie | message `stop` avec demande de sauvegarde | 2 s laissées au jeu pour écrire, puis destruction de la vue |

   Budget de F05: un plantage ramène au salon en moins de 2 s (détection immédiate, avis à l'autre machine, affichage); un blocage en moins de 7 s (5 s de détection, puis le même chemin), sous les 10 s exigées.
7. **Plantage chez l'un, retour des deux**: la machine où le jeu a planté prévient l'autre par la liaison (ADR 0007); les deux détruisent leur vue jeu et reviennent au salon avec M-14; la partie est inscrite « interrompue » par l'hôte (ADR 0009). La dernière sauvegarde n'est jamais touchée par un plantage: seule une écriture complète et vérifiée la remplace (ADR 0009). Deux plantages de suite du même jeu: la fenêtre insiste sur le rapport pour le studio (UX 3.3, ADR 0015).
8. **Fermeture de Duo pendant une partie** (H-13): l'événement `close` de la fenêtre est intercepté; la partie se met en pause et M-15 demande confirmation. « Quitter Duo » demande la sauvegarde de sortie, prévient l'autre machine (qui revient au salon sans attendre de reconnexion), puis ferme. Un arrêt brutal (processus tué, panne) reste une coupure ordinaire pour l'autre machine (ADR 0007).
9. **Libération des ressources**: la destruction de la vue libère contextes WebGL et audio, écouteurs et minuteurs du jeu. Aucune ressource d'un jeu ne vit dans la vue plateforme. Le SDK fournit quand même `dispose()` pour les tests et le faux hôte.

## Conséquences

- Chaque partie démarre dans un processus neuf: une fuite de mémoire d'un jeu ne survit pas à la partie.
- Le chargement d'un jeu coûte la création d'un processus de rendu (de l'ordre de 100 ms), compris dans le budget de 5 s du chargement.
- Le contrat des jeux impose de ne rien stocker hors du SDK: `localStorage` et IndexedDB sont vidés à chaque partie.
- Un jeu qui calcule longtemps sur son fil principal (plus de 8 s) est déclaré figé: c'est voulu, les compilations de shaders et le décodage des assets se font pendant le chargement, de façon asynchrone (budgets de `architecture.md`, section 14).

### À vérifier

- Superposition transparente et passage du focus entre les vues sous macOS et Windows, sur les runners de la CI, captures examinées (lot L2).
- Rythme de la simulation de l'hôte fenêtre réduite: App Nap sous macOS, occultation sous Windows (CA-PF-041, chez le client).
- Absence de faux positif du battement de cœur sur le PC de référence pendant un chargement lourd (banc de mesure, lot L8).

## Amendement du 2026-10-31

Seuils du chien de garde relâchés: 8 s sans battement en partie (au lieu de 5 s, le plus large que permet F05: retour au salon en 10 s au plus), 30 s au chargement (au lieu de 10 s), 90 s pour recevoir `ready` (au lieu de 30 s). Raison: pendant la préparation de la démo de La Petite Ligne, le premier affichage a bloqué le fil principal plus de 5 s en rendu logiciel, et le PC de référence (graphique intégré, compilateur de shaders de Direct3D) peut connaître des blocages du même ordre. Fermer une partie saine coûte bien plus cher au duo qu'attendre quelques secondes de plus devant un jeu réellement figé; pour aller au-delà de 8 s en partie, il faudrait modifier F05 avec l'accord du client. Les seuils seront resserrés après le banc de mesure du lot L8 sur les vraies machines.
