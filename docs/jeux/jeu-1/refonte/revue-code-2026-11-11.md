# Revue de code: La Petite Ligne (refonte) 0.21.0, lots de la nuit du 2026-11-10 au 2026-11-11

Revue ciblée par l'architecte technique, en lecture seule, sur `claude/stoic-lamport-lueey2` (22 fusions depuis `7c1ef03`). Ne figure ici que ce qui a été lu dans le code; les risques non mesurés le disent.

Contrôles lancés: `pnpm exec tsc --noEmit` (jeu entier, aucune erreur), `pnpm exec eslint` sur les dix fichiers revus en priorité (aucune remarque). Suite de tests et rendus non relancés (consigne de sobriété).

Bilan: **0 bloquant, 3 majeurs, 10 mineurs.**

## 1. Fusions à conflits

`git show --cc` sur les 22 fusions: seules `a0da4dc` (récoltes branchées) et `a20e979` (intérieurs encrés) portent des résolutions à la main dans les quatre fichiers. Zones recousues relues:

- `src/rendu/moteur.ts` 704 à 767 (emprises des meubles et végétation passées à `TiledPlace`) et 831 à 855 (récoltables, présence des meubles, lampes): ordre des arguments conforme à la signature de `TiledPlace` (`grand-lieu.ts` 207 à 222); l'ancien appel direct à `placeLights` a bien été remplacé par `refreshLights`, sans double appel ni code mort.
- `src/rendu/lieu/grand-lieu.ts` 207 à 224: champs `ink` et `delivered` affectés en tête du constructeur, avant `buildRoom` (seul lecteur, appelé à la première pièce visitée); ordre d'initialisation correct.
- `src/rendu/lieu/lieu.ts` 316 à 349: `showWhere` gère les lots instanciés, `cutDoors` les portes; ressources des lots rendues par `dropBatches` (tampons d'instances; géométrie et matériau restent à la source, conformément au contrat de `ModelSource`).
- `src/rendu/lieu/description.ts` 17 à 21: imports fusionnés, tous employés.

Aucun défaut de fusion trouvé. Les remarques sur le moteur viennent plus bas (mineurs 3, 9).

## 2. Constats majeurs

### MA1. La touche d'action rebondit après la fermeture d'un dialogue (cause probable de l'échec de P19)

- Fichiers: `src/entrees/commandes.ts` 110 à 115; `src/interface/dialogue.ts` 142 à 148; `src/main.ts` 129 à 136.
- Constat: `act` est lu par le SDK (`wasPressed`) à chaque pas, et envoyé dès que `captured()` est faux. Le bandeau se ferme d'un coup quand l'état reçu n'a plus de conversation (`sync(null)`), sans garde à la fermeture (il n'y en a qu'à l'ouverture, `openGuardMs`). Un Espace qui arrive juste après cette fermeture n'est plus avalé par le dialogue: il part comme `act` et vise l'habitant toujours devant le joueur.
- Risque pour les joueurs: en tapant Espace pour finir une conversation (geste naturel quand la dernière réplique tarde chez l'invité, qui attend l'hôte), la conversation se rouvre: quotidien du Contrôleur, ou au comptoir tenu la boutique. Plus fréquent chez l'invité, dont la fermeture arrive avec le délai du réseau.
- Correctif proposé: dans `createControls`, retenir l'instant où `captured()` repasse à faux et ignorer `act` pendant `UI_TUNING.openGuardMs` (même réglage, symétrique de l'ouverture). Test court: un appui `act` au pas qui suit la fermeture ne produit aucun `talk_started`.

### MA2. Aucune vérification de compatibilité entre les deux jeux; la plateforme ne compare que la chaîne de version

- Fichiers: `apps/duo/src/main/platform.ts` 619 à 632 (`versionGap`: égalité de `manifest.version`, aucune empreinte du paquet); `src/reseau/canaux.ts` 75 (schémas `strictObject`); `packages/sdk/src/net.ts` 67 à 70 (message refusé par le schéma: simple avertissement, message jeté).
- Constat: l'ADR 0006 exige « version du jeu et empreinte du paquet identiques »; seule la version est comparée. Aucun message du jeu ne porte de version de protocole ou d'empreinte du contenu. Les schémas étant stricts, la moindre différence (nouvelle intention comme `shop_talk`, nouvelle pose `lie`, nouveau champ) fait refuser tous les messages du canal concerné, en silence.
- Risque pour les joueurs: deux constructions différentes sous le même numéro (publication du soir refaite sans changer de version, version de test, paquet copié pendant une mise à jour) donnent un invité figé ou sourd à ses commandes, sans aucun message. Avec une vingtaine de lots par nuit, l'oubli d'un changement de numéro est plausible.
- Correctif proposé: le jeu calcule une empreinte de ses données et de son code (constante injectée au build par Vite) et l'hôte la met dans la tranche `common`; l'invité la compare au premier état reçu et affiche « versions différentes, mettez Duo à jour » au lieu de jouer. Côté plateforme (brief séparé, dev-plateforme): comparer aussi l'empreinte du paquet comme le prévoit l'ADR 0006.

### MA3. Parcours P19: deux attentes qui n'attendent rien, et une fin d'échange jugée sur un seul relevé

- Fichiers: `tests/e2e/prologue.spec.ts` 238 et 282 (`playUntil('dialogues fermés', () => true, 1)`); 209 à 214 (fin de `talkTo`); `tests/aides-e2e/prologue.ts` 463 à 470 (`playUi`).
- Constat: `playUntil` teste la condition avant de lire quoi que ce soit; avec `() => true`, ces deux lignes rendent la main tout de suite et ne ferment aucun dialogue. La fin de `talkTo` se juge sur un seul relevé (hôte sans conversation, bandeau de l'invité fermé). Or `playUi` appuie de nouveau sur Espace 350 ms après le premier appui si le bandeau est encore là (délai de l'invité sous SwiftShader): ce second appui tombe souvent juste après la fermeture et rouvre une conversation par MA1. Le Contrôleur a alors `controleur-chariot` (priorité 50, condition vraie dès l'ouverture de l'étape « chariot ») à proposer: l'invité part vers le chariot avec ce dialogue ouvert, ce qui correspond au relevé d'échec.
- Risque: parcours rouge une fois sur trois, qui masque les vrais défauts et pousse à le contourner.
- Correctif proposé: remplacer les deux attentes par une vraie attente « aucune conversation chez l'hôte ni bandeau chez les deux, stable sur 1,5 s » (deux relevés espacés); dans `playUi`, ne pas réappuyer sur la même réplique tant que l'appui précédent a moins de 1,5 s. MA1 corrigé, le parcours redevient aussi le test de ce rebond.

## 3. Constats mineurs

### mi1. La migration 1 vers 2 dépend d'un réglage vivant

- `src/sauvegarde/format.ts` 12 et 38: la clé vient de `lookRevealedKey`, donc de `RULES.look.revealedPrefix`. Si ce préfixe change un jour, la migration écrira l'ancienne partie sous la nouvelle clé sans qu'une nouvelle migration soit écrite pour les parties déjà migrées, et les tests de référence ne le verront pas.
- Risque: personnages d'une partie reprise remis en silhouette après une évolution des réglages.
- Correctif: écrire la clé en littéral dans la migration (`joueurs.apparence.j0`, `.j1`), avec un commentaire « figée: une migration ne suit pas les réglages ».

### mi2. Rendu `?rendu=aplats`: les pièces d'un grand lieu n'ont ni sol ni murs

- `src/rendu/lieu/grand-lieu.ts` 523 à 525 (`buildRoom` rend `null` sans encre); `src/rendu/moteur.ts` 875 (la table, seul sol de repli, est cachée dans toute pièce, quel que soit le style).
- Risque: l'interrupteur de transition ne sert plus de recours dans Aubrune: meubles posés sur le fond uni. Pas atteignable par un joueur (adresse seulement).
- Correctif: en aplats, garder `table.visible` dans les pièces (condition `room === null || this.ink === null`), ou retirer l'interrupteur de l'ADR 0023 si la transition est finie.

### mi3. Un récoltable ou un meuble conditionné qui change refait tous les volumes dynamiques, deux fois pour certains

- `src/rendu/moteur.ts` 838 à 855: la moindre récolte, dans tout le lieu et par l'un ou l'autre joueur, relance `highlight.release()`, `setStates` (qui reconstruit les volumes dynamiques dont l'état change), puis `setDynamic` (qui les jette et reconstruit tout, lots du potager compris), puis `refreshLights`.
- Risque: la cible visée par le joueur local perd son liseré quand l'autre récolte ailleurs; à-coup d'une image sur le PC de référence quand le sol porte beaucoup d'objets (non mesuré).
- Correctif: n'appeler `setDynamic` et `release` que si `dynamicSignature` a changé; sinon `setStates` seul (il ne refait que ce qui change).

### mi4. Allocations à chaque image

- `src/interface/index.ts` 637 et `src/simulation/quetes/lecture.ts` 129 à 164: `glanceTarget` (et donc `doorChain`, qui crée une `Map`, une file et des objets) est recalculé à chaque image pour le repère du HUD.
- `src/rendu/lieu/grand-lieu.ts` 964 et 978: `updateCrowns` crée un `Set` et une chaîne par houppier proche, à chaque image (code d'avant la nuit).
- `src/rendu/encre/index.ts` 381 et 396: un tableau `lampColor` et une fermeture `lampLit` par image.
- Risque: ramasse-miettes plus fréquent, à-coups sur l'i3 (non mesuré).
- Correctif: lire le repère quelques fois par seconde comme `createDecisionBanner` (`UI_TUNING.reminderReadMs`); clés numériques (`tile * 1024 + index`) et `Set` réutilisé; tableau `lampColor` réécrit en place.

### mi5. Les habitants traversent les portes que l'histoire tient fermées

- `src/simulation/lieux/traversee.ts` 68 à 112: `doorChain` prend toutes les portes de la carte, sans `opens` ni verrou; `src/simulation/habitants/chemins.ts` 348 ne lui passe pas `closed`.
- Risque: un habitant entre par une trappe ou une porte que les joueurs voient fermée (`MAP_STATES.closed`) et se pose de l'autre côté. Déterministe, donc identique sur les deux machines, mais incohérent à l'écran. Aucune donnée actuelle ne le déclenche à coup sûr (non vérifié).
- Correctif: passer à `doorChain` un filtre des portes franchissables (portes à `opens` vraies, sauf pour le commerçant de la pièce), lu comme `closedLockSet`.

### mi6. Comptoir tenu: le verbe prédit chez l'invité peut différer de ce que fait l'hôte

- `src/simulation/commerces/brique.ts` 38 à 42 et 53: `counterKeeper` mesure la distance du commerçant au comptoir; chez l'invité, la position du commerçant est interpolée.
- Risque: près du seuil `keeperReach` (1,5 m), la bulle dit « Parler » et la boutique s'ouvre (ou l'inverse) pendant que le commerçant rejoint son poste.
- Correctif: juger « derrière le comptoir » sur l'état de vie transmis (`life.activity` non nulle: arrivé à son poste) plutôt que sur la seule position, ou ajouter un écart d'hystérésis.

### mi7. Le champ du sol d'un grand lieu est calculé trois fois au chargement

- `src/rendu/moteur.ts` 708, `src/rendu/lieu/grand-lieu.ts` 228, `src/rendu/lieu/description.ts` 277 (au premier objet au sol, via `tallFootprints`).
- Risque: image longue à l'entrée dans Aubrune sur l'i3 (non mesuré).
- Correctif: un `groundField` mis en cache par `MapDef` (`WeakMap`), comme `tallFootprints` et `sillsOf`.

### mi8. Cas particuliers par nom de nature de sol dans le moteur

- `src/rendu/lieu/terrain-rendu.ts` 283 à 290 (`herbe`, `hors-jeu`, `pre`) et `src/rendu/lieu/grand-lieu.ts` 487 (`hors-jeu`), d'avant la nuit.
- Risque: une nouvelle nature boisée ne reçoit ni arbres ni teinte de bois sans toucher au code (règle des gabarits).
- Correctif: champs `treeDensity` et `farShade` dans `GROUND_LOOKS` (`reglages-tuiles.ts`), lus par le moteur.

### mi9. Petites fragilités du moteur

- `src/rendu/moteur.ts` 490 et 491: pendant le trajet, la racine du grand lieu d'arrivée reste visible (seuls le lieu et la table sont cachés). Sans symptôme aujourd'hui (le sol lointain n'a pas de groupes avant la première mise à jour), mais un repère proche de l'origine apparaîtrait dans le diorama.
- 802 à 808 et 697 à 698: un lieu absent des données relance `loadPlace` à chaque image.
- 707: un modèle de clôture instancié pour tester sa présence, jamais rendu (`geometryOf` suffit).
- 1151 à 1154: en encre, `ink.volume` est libéré quatre fois (sans effet, mais trompeur).
- Correctif: cacher `this.tiled.root` dans `drawTrip` et le remontrer dans `endTrip`; retenir l'identifiant déjà tenté; tester `geometryOf`; ne libérer les trois matériaux qu'en aplats.

### mi10. Un test de façades se saute en silence sans numpy

- `tests/batiments.test.ts` 127 et 128: `it.skipIf(!hasNumpy)`; aucun fichier de `.github/workflows/` n'installe numpy (recherche `numpy`, `setup-python`: rien). Présent ici, donc le test tourne dans l'environnement cloud.
- Risque: en CI, si numpy manque à l'image, la règle « ouvertures centrées, étages alignés » n'est plus vérifiée et personne ne le voit (non vérifié sur un runner).
- Correctif: installer numpy dans la CI des jeux, ou faire échouer le test avec un message clair quand la variable `CI` est posée et que numpy manque.

## 4. Points vérifiés sans remarque

- Déterminisme: présence des meubles (`lieux/presents.ts`), décisions à deux (`quetes/decisions.ts`), faits « entendu » et reprise des dialogues `once` (`dialogues/conversation.ts`), révélation de l'apparence (`regles/apparence.ts`, `noyau/pas.ts`): tout se déduit de la progression transmise, aucun hasard ni horloge locale.
- Validation: `shop_talk` est dans `SHOP_INTENTS` (schéma strict), tous les canaux passent par un schéma Valibot du SDK; clés de faits conformes à `FactKeySchema` (quatre segments au plus).
- Sauvegardes: `DATA_SCHEMA` 2, migration 1 vers 2 et référence `tests/donnees/sauvegarde-v2.json` présentes; une partie 0.21 relue par une 0.20 est refusée poliment (`newer`).
- Ressources: géométries des pièces, cartes du sol et des limites, lots instanciés et copies de houppiers passent par un `ResourceTracker` ou sont libérés au déchargement de la tuile.
- Règles: aucun `any`, aucune assertion non nulle, aucun `console.log`, `debugger` ni TODO ajoutés dans `src/` pendant la nuit; une seule exception ESLint ajoutée, justifiée.
- Tests modifiés: les assertions retirées (`dialogues.test.ts`, `defauts.spec.ts` D2, `editeur.test.ts`) suivent un changement de règle voulu (comptoir tenu, photo du prologue) et sont remplacées par des assertions équivalentes ou plus fortes; aucun test assoupli trouvé, un seul saut conditionnel ajouté (mi10).

## 5. Corrections à confier (ordre de priorité)

1. **MA1, rebond de l'action** (`entrees/commandes.ts`): garde de `openGuardMs` après la fermeture de tout écran qui capture le clavier, test court. Sonnet.
2. **MA3, P19** (`tests/e2e/prologue.spec.ts`, `tests/aides-e2e/prologue.ts`): attente stable de fin d'échange, plus de second appui sur la même réplique; relancer P19 trois fois de suite. Sonnet, après 1.
3. **MA2, empreinte de compatibilité dans le jeu** (`reseau/`, `vite.config.ts`): empreinte du build dans la tranche `common`, message clair chez l'invité. Opus.
4. **MA2 côté plateforme** (`apps/duo/src/main/platform.ts`): comparer l'empreinte du paquet comme le prévoit l'ADR 0006. Opus, dev-plateforme.
5. **mi1, migration figée** (`sauvegarde/format.ts`): clés littérales. Sonnet.
6. **mi3, reconstruction des volumes** (`rendu/moteur.ts`): `setDynamic` et `release` seulement si l'état du lieu change. Sonnet.
7. **mi4, allocations par image** (`interface/index.ts`, `grand-lieu.ts`, `encre/index.ts`). Sonnet.
8. **mi5, portes fermées et habitants** (`lieux/traversee.ts`, `habitants/chemins.ts`), avec un test d'une porte à `opens` fausse. Opus.
9. **mi7 et mi9, chargement et trajet** (`rendu/moteur.ts`, `terrain-rendu.ts`): cache du champ du sol, racine du grand lieu cachée pendant le trajet. Sonnet.
10. **mi2, mi8 et mi10, aplats, natures de sol, numpy en CI**: décision d'abord (garder ou retirer `?rendu=aplats`), puis réglages `treeDensity` et `farShade`, et numpy dans la CI. Sonnet.

À mesurer sur le PC de référence ou au banc (`tests/rendu-encre/mesure.spec.ts`) avant de trancher la gravité: mi3, mi4 et mi7.
