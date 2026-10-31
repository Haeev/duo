# Gauntlet, tour 1: pilier 8, robustesse et performance

| Champ | Valeur |
|---|---|
| Relecteur | architecte-technique (concepteur de l'architecture de la plateforme, pas du code du jeu) |
| Date | 2026-10-31, de 08 h 57 à 09 h 45 UTC |
| Version relue | arbre de travail à `85026e7`, sans aucune modification du code ni des données |
| Méthode | revue de code ciblée (`src/reseau/`, `src/sauvegarde/`, `src/session.ts`, `src/main.ts`, `src/simulation/pas.ts`, `src/rendu/moteur.ts`, `src/rendu/reglages.ts`), suite Vitest, typecheck et lint du jeu; mesures dans Node (robots sur les quinze jours, graine 42, règle d'envoi de `hote.ts` reproduite) et dans Chromium (page `rendu.html` servie par Vite sur le port 5305, fenêtre de 1366x768); lecture de la recette (sections 9 et 10, endurance à deux navigateurs). Scripts de mesure hors du dépôt (`/tmp/lpl-archi/`) |

## 1. Note: 6,5 sur 10

La démo de deux semaines est solide dans tout ce qui se vérifie ici: simulation pure et rapide, 247 tests verts, robots qui finissent les quinze jours, endurance de 37 minutes à deux navigateurs sans erreur, sans écart de bourse ni de jour entre les deux écrans et sans fuite visible, budgets de rendu tenus dans la page de démonstration. Un joueur qui joue la démo sur une machine assez puissante ne remarquerait probablement aucun manque.

La note reste sous 8 pour trois raisons vérifiables, pas pour ce qui reste à mesurer chez le client:

1. **Aucun recours si le PC ne tient pas le rythme**: le mode léger existe mais ne s'atteint que par un paramètre d'adresse, inaccessible dans Duo; la résolution dynamique ne descend qu'à 0,75 et ne réagit qu'en dessous de 50 images par seconde. Un jeu commercial a un réglage de qualité et un repli automatique.
2. **Des pannes dures au lieu de pannes douces**: un état qui dépasse 64 Kio fait planter la partie des deux côtés (exception dans le pas), et une sauvegarde abîmée en profondeur est acceptée puis fait planter le premier pas, à chaque relance.
3. **Une architecture de données taillée pour la démo**: l'état complet part à l'invité jusqu'à cinq fois par seconde et contient des textes et de l'interface; il atteint déjà 41 % du plafond au jour 15 et grossit avec le contenu. Pour 100 heures, c'est le premier mur.

Repères: 5 = fonctionne mais fragile; 8 = un joueur ne remarque aucun manque. On est au-dessus de « fragile » (endurance et tests le prouvent), en dessous de « aucun manque » tant que les trois points ci-dessus restent ouverts.

## 2. Mesures

### 2.1 Simulation, réseau, sauvegardes (Node, robots, quinze jours, graine 42)

| Poste | Budget (architecture, 14.2) | Mesuré | Verdict |
|---|---|---|---|
| Pas de simulation (temps processeur) | 2 ms au plus par pas | médiane 0,029 ms, 99e centile 0,64 ms, 99,9e 3,3 ms, maximum 25,7 ms (jour 1, compilation à la volée); 14 pas sur 125 609 au-delà de 8 ms | tenu, large marge |
| Pas de simulation (temps mural) | | jusqu'à 230 ms, à des pas différents d'une passe à l'autre, sans ramasse-miettes pendant ces pas (4 passages du ramasse-miettes en tout, 8 ms au plus): machine partagée (charge moyenne 25), pas le code | non significatif ici |
| Message rapide (positions) | 2 Ko au plus, 20 à 30 par seconde | 0,9 Ko au plus, 30 par seconde (27 Kio/s) | tenu |
| Message d'état complet | 64 Kio au plus par message (SDK, `net.ts`) | 26,8 Kio au plus; 6 467 envois en 70 min de jeu, 1,5 par seconde en moyenne | tenu, marge de 2,4 |
| Débit total vers l'invité | 100 Ko/s au plus | 33 Kio/s d'état en moyenne plus 27 Kio/s de positions; pire seconde: 133 Kio d'état seul | **dépassé** par pointes (jours 1 à 3, 8 à 10: 44 à 60 Kio/s en moyenne sur la journée) |
| Sauvegarde à la fin des deux semaines | 1 Mio (`duo-game.json`, `saves.maxBytes`) | 27 560 octets (5 725 compressés); 16,0 Kio au jour 1, 23,0 au jour 8, 26,1 au jour 14 | tenu |
| Copie et sérialisation de l'état | | `structuredClone` 0,48 ms, `JSON.stringify` 0,21 ms, `JSON.parse` 0,15 ms | tenu |
| Chargement du contenu et de la carte (fil principal) | 5 s pour toute la partie | contenu 2 à 9 ms, carte 3 à 7 ms, reprise d'une sauvegarde 0,1 à 0,8 ms | tenu |

Composition de la sauvegarde du jour 15 (champs les plus lourds): `characters` 7,6 Kio (dont `notifications` 1,8 Kio par personnage), `counters` 3,0 Kio, `countersAtDawn` 3,0 Kio (copie des compteurs), `letters` 2,5 Kio (textes complets des 9 lettres), `quests` 1,9 Kio, `dialoguesDone` 1,5 Kio (72 entrées).

### 2.2 Rendu (Chromium, rendu logiciel, page `rendu.html`, 1366x768)

RENDU_TABLE

Le rendu logiciel ne dit rien des images par seconde ni du temps GPU: seuls les appels, triangles, programmes, géométries et textures sont des mesures valables ici. L'état affiché est l'état d'exemple de la page, pas une partie réelle.

### 2.3 Qualité du code

| Contrôle | Résultat |
|---|---|
| `pnpm --filter @duo/la-petite-ligne test` | 36 fichiers, **247 tests réussis**, 239 s (machine chargée) |
| `pnpm --filter @duo/la-petite-ligne typecheck` | code de sortie 0 |
| `pnpm --filter @duo/la-petite-ligne lint` | code de sortie 0 |
| `any`, `console.log`, `debugger`, `TODO`, `eslint-disable` dans `src/` hors tests | aucun |
| Recette, endurance à deux navigateurs (section 10) | 37 min, aucune erreur de page ni de console, aucun arrêt, bourse identique aux 127 relevés, tas JavaScript de 43 à 76 Mo sans tendance, état transmis 22 Kio au plus |

## 3. Ce qui est déjà au niveau

- **Simulation séparée du rendu**, pure, à pas fixe de 30 Hz, testable dans Node: un pas coûte 0,03 ms en médiane, soit une marge d'un facteur 60 sur le budget, même avec un i3 deux fois plus lent.
- **Robots et endurance**: les robots jouent les quinze jours sur dix graines, avec et sans l'énigme, avec sauvegarde et reprise à chaque aube en inversant hôte et invité (`tests/endurance.test.ts`); la même démo tourne à deux navigateurs sans erreur ni écart (recette, 10.2). Peu de jeux commerciaux ont un tel filet.
- **Entrées de l'invité validées strictement** (`src/reseau/schemas.ts`: `strictObject`, bornes, `picklist`): l'hôte ne fait confiance à rien de ce qui vient de l'autre machine.
- **Sauvegardes liées à l'identifiant stable des joueurs** (`bindPlayers`), format versionné (`DATA_SCHEMA` 2), migration du format 1 testée sur deux cas, refus d'une sauvegarde plus récente, sauvegarde de sortie à l'arrêt (`connect.ts`, `saveFromProvider('exit')`), copies de secours gardées par la plateforme (ADR 0009).
- **Budgets de rendu tenus dans la page de démonstration**, shaders compilés pendant le chargement (`compileAsync`, `moteur.ts` ligne 370), libération vérifiée par l'essai d'endurance du rendu.
- **Code propre**: TypeScript strict sans échappatoire, lint et typecheck verts, aucun reste de débogage, commentaires qui expliquent le pourquoi.
- **LPL-R01 corrigé** (chien de garde): aucun arrêt en dix séances depuis.

## 4. Les cinq risques les plus graves pour le client

Classés par probabilité multipliée par gravité, du point de vue des deux joueurs.

### Risque 1: le PC ne tient pas le rythme, et personne ne peut baisser la qualité

- **Constat**: le PC de référence (UHD 620, 1366x768 ou 1920x1080 à 150 %) est la machine la plus faible et n'a jamais fait tourner le jeu. Si les images dépassent le budget, le seul levier automatique est la résolution dynamique, qui ne descend qu'à 0,75 et seulement quand la moyenne dépasse 20 ms (moins de 50 images par seconde): entre 50 et 58, rien ne bouge, et sous 0,75 non plus. Le mode léger (ombres coupées, antialiasing coupé, 640x360, végétation au quart) existe, mais ne s'active que par `?rendu=leger` dans l'adresse, qu'aucun joueur ne peut taper dans Duo (`main.ts`, `renderQuality()`: « l'application Duo: pas de mode léger »). Le SDK n'a pas de réglage de qualité graphique (`packages/sdk/src/api.ts`).
- **Preuve**: `src/rendu/reglages.ts` lignes 187 à 195 (`steps: [1, 0.9, 0.8, 0.75]`, `slowFrameMs: 20`); `src/main.ts` lignes 50 à 59; 11 programmes sur 12 dans la page de démonstration (marge d'un seul matériau).
- **Correction proposée**: (a) dans `src/rendu/moteur.ts`, après le dernier palier, si la moyenne reste au-dessus de 20 ms pendant 8 s, passer au mode léger à chaud pour ce qui se change sans recréer le contexte (ombres, rapport de pixels, effets et végétation), et l'inscrire dans le journal (`duo.log.info`); descendre aussi quand la moyenne dépasse 17,2 ms (58 images par seconde); (b) retenir ce choix d'une séance à l'autre (préférence locale du jeu); (c) plus tard, un réglage « Qualité graphique: automatique, belle, légère » de la plateforme, transmis par le SDK à tous les jeux (ADR à écrire, avec dev-plateforme).
- **Effort**: (a) et (b) 150 minutes (dev rendu 3D) plus 30 minutes de test; (c) 240 minutes (ADR, SDK, réglages de Duo).
- **Gain attendu**: +1 (c'est ce qui rend une note de 8 défendable avant même la mesure chez le client).

### Risque 2: au-delà de 64 Kio d'état, la partie plante chez les deux

- **Constat**: l'hôte envoie l'état complet à l'invité (`hote.ts`, `sendWorld`) dès qu'il change, au plus cinq fois par seconde. Le SDK lève une `RangeError` au-delà de 64 Kio (`packages/sdk/src/net.ts` ligne 120); l'exception sort du pas (aucun `try` dans la boucle du SDK), remonte en erreur de page, donc en `fatal`: la partie s'arrête sur les deux machines, et à chaque reprise de la même sauvegarde. L'état pèse déjà 26,8 Kio au jour 15 (41 % du plafond) et contient ce qui n'a rien à y faire: notifications de l'interface (1,8 Kio par personnage), textes complets des lettres, copie intégrale des compteurs (`countersAtDawn`). Le débit dépasse aussi le budget par pointes (133 Kio en une seconde).
- **Preuve**: mesure du §2.1 (règle d'envoi de `hote.ts` reproduite sur les quinze jours); `tests/endurance.test.ts` vérifie bien 64 Kio, mais sans marge ni alerte avant le mur. Au rythme de la semaine 2 (environ 0,2 Kio de plus par jour), le plafond tomberait vers le jour 200, soit 25 à 30 heures de jeu; plus tôt si chaque semaine ajoute des lettres, quêtes et dialogues comme la semaine 2 (+10 Kio en sept jours).
- **Correction proposée**: (a) `src/reseau/hote.ts`: n'envoyer que les champs de premier niveau qui ont changé (comparaison de leur JSON tous les six pas, 0,2 ms) et les fusionner chez l'invité (`invite.ts`); l'état complet seulement au début et après une reconnexion; (b) sortir les notifications de l'état (canal d'événements), remplacer le texte des lettres par leur identifiant et leurs variables, et `countersAtDawn` par les seuls écarts du jour, avec une migration vers le format 3 testée; (c) relever dans `endurance.test.ts` une alerte à 32 Kio (moitié du plafond) pour voir venir le mur.
- **Effort**: (c) 15 minutes; (a) 120 minutes (dev réseau); (b) 150 minutes (dev gameplay, migration comprise).
- **Gain attendu**: +0,5 (et la condition pour dépasser la démo, voir §5).

### Risque 3: une sauvegarde abîmée fait planter chaque relance, ou disparaît sans un mot

- **Constat**: `checkWorld` (`src/sauvegarde/sauvegarde.ts` lignes 73 à 102) ne contrôle que la présence de quelques champs de premier niveau. Une sauvegarde dont un champ imbriqué manque (oubli dans une migration future, par exemple) est acceptée, puis le premier pas lève une `TypeError`: plantage chez les deux, à chaque relance. À l'inverse, une sauvegarde refusée fait démarrer **une nouvelle partie sans rien dire** au joueur (`src/session.ts` lignes 133 à 139, « sauvegarde illisible: nouvelle partie »), que la sauvegarde automatique écrasera cinq minutes plus tard; les copies de secours de la plateforme existent, mais rien n'invite le duo à s'en servir. Enfin, les tests de migration fabriquent l'ancien format en retirant des champs à un état actuel (`asVersion1`, `tests/sauvegarde.test.ts`): aucune vraie sauvegarde d'une version publiée n'est gardée comme référence.
- **Preuve**: essai dans Node sur la sauvegarde du jour 15, privée de `characters[0].bag` et de `counters`, avec une case de potager vide: `restoreWorld` l'accepte, puis `step` lève « TypeError: Cannot read properties of undefined (reading '1') ».
- **Correction proposée**: (a) dans `restoreWorld`, jouer un pas sur une copie (`structuredClone`) et transformer toute exception en `SaveError` (garde-fou bon marché, en attendant un schéma); (b) dans `session.ts`, sur `SaveError`, ne pas démarrer de nouvelle partie: afficher « Ta sauvegarde n'a pas pu être relue » avec le choix de reprendre la copie précédente ou de recommencer, et ne rien écrire avant ce choix; (c) un schéma Valibot de `WorldState`, partagé par la sauvegarde et le réseau (risque 5); (d) garder dans `tests/sauvegardes/` une vraie sauvegarde de chaque version publiée (0.1.0 au jour 4, au jour 8 et au jour 15), rechargée et jouée jusqu'au lendemain à chaque `pnpm test`.
- **Effort**: (a) 30 minutes; (d) 45 minutes; (b) 90 minutes (avec dev-plateforme si la reprise d'une copie passe par Duo); (c) 240 minutes.
- **Gain attendu**: +0,5.

### Risque 4: le son prend presque le double de la mémoire prévue

- **Constat**: le budget de la plateforme fixe l'audio décodé à 64 Mo au plus par jeu (architecture, 14.2). Le jeu décode 23 Mo de sons permanents et garde un cache jusqu'à 128 Mo (`src/audio/reglages.ts` ligne 139, `capBytes: 128 * MIB`); le banc du dev audio a mesuré 112 Mo. Sur un PC de 4 Go avec une UHD 620, qui prend sa mémoire vidéo dans la même mémoire, l'écart compte: pression mémoire, système qui pagine, saccades.
- **Preuve**: `src/audio/reglages.ts` ligne 139; `ETAT.md`, section Audio (« mémoire au plus 112 Mo »); architecture 14.2 (« audio décodé 64 Mo au plus »). Mémoire totale de Duo en partie (1 Go au plus, tous processus) jamais mesurée avec La Petite Ligne.
- **Correction proposée**: ramener `capBytes` à 40 Mo (64 moins les 23 permanents, arrondi) et vérifier au banc qu'aucune musique ne se recharge pendant une transition; sinon, décoder les musiques en flux (`MediaElementAudioSourceNode`) plutôt qu'en tampons entiers. Mesurer `app.getAppMetrics()` pendant une séance Duo à deux instances (test existant `apps/duo/tests/e2e/la-petite-ligne.spec.ts`).
- **Effort**: 30 minutes (réglage et banc), 60 minutes pour la mesure dans Duo.
- **Gain attendu**: +0,25.

### Risque 5: ce que l'hôte envoie n'est presque pas contrôlé

- **Constat**: la règle de l'architecture (« tout message reçu validé par schéma », ADR 0003, CA-PF-021) n'est tenue que dans un sens. L'état complet reçu par l'invité ne passe que `looksLikeWorld` (huit champs, `schemas.ts` lignes 120 à 134), les événements seulement « a un champ `type` » (lignes 143 à 145). Les deux applications ont la même version (poignée de main, ADR 0006), donc le risque vient surtout d'un futur écart de format entre deux versions du jeu ou d'un bug de l'hôte: l'invité planterait dans le rendu, l'interface ou le son, loin de la cause. Le commentaire du canal rapide annonce 15 messages par seconde (`schemas.ts` ligne 16) quand l'hôte en envoie 30 (`hote.ts` ligne 123).
- **Preuve**: lecture de `src/reseau/schemas.ts` et `hote.ts`; aucun test de message abîmé côté invité dans `tests/reseau.test.ts`.
- **Correction proposée**: valider l'état avec le schéma Valibot de `WorldState` du risque 3 (un seul schéma pour le disque et le réseau, 0,2 ms par message à cinq messages par seconde au plus), les événements avec une `variant` sur `type`; un test qui envoie à l'invité un état et un événement abîmés et vérifie qu'il les écarte sans planter et l'inscrit au journal.
- **Effort**: 60 minutes une fois le schéma du risque 3 écrit (90 minutes pour la `variant` des événements seule).
- **Gain attendu**: +0,25.

### Hors des cinq, à garder en vue

- Perte du contexte WebGL (veille de Windows, pilote Intel qui se relance): Three.js 0.187 empêche la perte définitive et restaure le contexte (`WebGLRenderer.js`, `onContextLost`, `onContextRestore`), mais le jeu ne l'a jamais essayé ni ne l'inscrit au journal. Essai de 15 minutes dans la page de démonstration avec `renderer.forceContextLoss()` puis `forceContextRestore()`.
- Changement de taille de la carte d'ombre à 16 h 30 et 18 h (`detailMapSize` 2048 puis 1024): réallocation d'une texture de profondeur, donc un à-coup possible ce jour-là sur le PC. À observer chez le client.
- Les robots suivent toujours le même chemin, quelle que soit la graine (recette, section 6): ils ne cherchent pas les cas limites. Un test qui envoie des intentions valides tirées au hasard pendant des milliers de pas, en vérifiant les invariants (aucune exception, bourse positive, objets conservés), trouverait d'autres pannes (60 minutes).

### Gain cumulé

Les cinq corrections portent la note vers 9 sur ce qui se vérifie ici (6,5 + 1 + 0,5 + 0,5 + 0,25 + 0,25), à confirmer par la mesure sur le PC. Ordre conseillé: risque 3 (a) et (d), risque 2 (c), risque 4 (moins de deux heures à eux quatre), puis risque 1 (a) et (b), puis risque 2 (a) et (b).

## 5. Vers 100 heures

L'architecture actuelle porte bien une démo de deux semaines. Pour un jeu de 100 heures (de l'ordre de 750 jours de jeu au rythme de la démo, deux heures par quinzaine), voici ce qui doit changer **avant** d'ajouter beaucoup de contenu, du plus urgent au moins urgent.

1. **Séparer trois sortes de données** dans `src/etat/types.ts`: la progression (sauvegardée et répliquée: potager, meubles, quêtes, bourse), la vue (répliquée, jamais sauvegardée: positions, visée, aperçus de pose) et l'éphémère (ni l'un ni l'autre: notifications, « Déjà pris », astuces affichées), qui passe par le canal d'événements. Aujourd'hui tout est dans `WorldState`, donc tout est sauvegardé et renvoyé.
2. **Répliquer par différences**, pas par état complet: envoi des seules sections modifiées, avec une révision par section (risque 2). À mettre dans le SDK sous forme d'une aide `replicateState` commune aux jeux à hôte qui fait autorité, plutôt que dans le seul jeu 1, puisque les prochains jeux en auront besoin (ADR 0007 à compléter avec dev-reseau). Objectif: aucun message au-delà de 8 Kio en régime courant, quelle que soit la taille du monde.
3. **Le contenu par référence, jamais par copie**: une lettre, une quête, un objet se désignent par leur identifiant et leurs variables; le texte vit dans `donnees/`. Bénéfice double: état plus petit, et une correction de texte s'applique aussi aux parties en cours.
4. **Une croissance bornée**: compteurs agrégés par famille (et non une clé par combinaison verbe, objet, qualité, habitant), écarts du jour au lieu d'une copie complète, historiques plafonnés; ce qui doit rester pour toujours (commandes passées, souvenirs du duo) va dans l'historique de la plateforme ou dans une section d'archives compressée. Budget à inscrire dans le cahier: sauvegarde de 256 Kio au plus après 100 heures, état répliqué de 32 Kio au plus.
5. **Des sauvegardes à toute épreuve**: un seul schéma Valibot de l'état pour le disque et le réseau; des migrations chaînées et numérotées (`migrations/0002.ts`, `0003.ts`...), chacune avec une vraie sauvegarde de référence de la version précédente dans `tests/sauvegardes/`; à chaque `pnpm test`, toutes les références se rechargent et se jouent un jour; jamais de nouvelle partie silencieuse.
6. **Un contenu chargé par morceaux**: aujourd'hui tout le contenu et la carte (812 Ko de JSON pour `donnees/cartes`) sont dans le paquet JavaScript principal (1,1 Mo) et validés au lancement sur le fil principal (10 à 15 ms en tout, sans gêne). À cinquante fois plus de contenu, cela ferait des dizaines de mégaoctets et une demi-seconde de validation à chaque lancement. Découper par région et par saison, charger à la demande (`duo.assets.url` puis `fetch`), valider tout le contenu à la construction (`pnpm verifier`) et ne garder au lancement qu'un contrôle léger.
7. **Des assets en flux**: 6,5 Mo de modèles et 12 Mo de son aujourd'hui, pour un paquet conseillé de 50 Mo (100 au plus). Au-delà de quelques régions, il faut charger et libérer les modèles par zone (le rendu sait déjà tout libérer), garder le cache audio sous 64 Mo, et prévoir des paquets de contenu installables sans réinstaller le jeu (ADR 0010 à prolonger).
8. **Une simulation qui reste à 0,03 ms**: plusieurs systèmes parcourent tout à chaque pas, à 30 Hz: `nearHints` (`pas.ts`) parcourt toutes les astuces pour chaque personnage, et `updateQuests` (`quetes.ts` lignes 102 et 103) cherche, pour chaque quête du contenu, si elle est déjà commencée, soit un coût qui croît comme le carré du nombre de quêtes. Avec des centaines de quêtes et d'astuces, passer à des déclencheurs par événement ou à 2 à 5 contrôles par seconde, et indexer l'espace (cases occupées, objets proches).
9. **Un budget de shaders presque plein**: 11 programmes sur 12. Une saison nouvelle (neige, feuilles, glace) doit passer par des variantes du matériau commun `lpl_palette`, ou par un relèvement du plafond décidé par ADR après mesure sur le PC.
10. **Des tests qui cherchent les pannes**: robots variés (choix tirés au hasard selon la graine), intentions aléatoires valides avec invariants, et un essai d'endurance long (huit heures de simulation accélérée dans Node, quelques minutes de calcul) qui surveille la taille de l'état et de la sauvegarde jour après jour.

## 6. Non vérifié, et pourquoi

- Images par seconde, temps GPU, temps d'une image sur le fil principal (budget 8 ms), tâches longues du chargement: rendu logiciel et machine partagée (charge moyenne de 25 pendant la relecture); seuls appels, triangles et programmes se mesurent ici.
- Mémoire totale de Duo en partie (1 Go au plus) et audio décodé dans le jeu réel: pas de séance Duo lancée (d'autres relecteurs travaillent en parallèle; la recette a déjà mesuré le tas JavaScript).
- Reprise après une vraie coupure du réseau pendant une partie: non rejouée; lecture du code: la plateforme met les deux en pause et l'hôte renvoie l'état complet au moins toutes les 3 s (`WORLD_KEEPALIVE_TICKS`), ce qui suffit à recaler l'invité.
- Écart de position entre les deux écrans: non mesurable sans crochet (recette, 10.3, point 4).

## 7. À tester chez le client

- Sur le PC, en 1366x768 puis à 150 %: images par seconde sur la place du bourg à 17 h 15 (carte d'ombre de 2048), sous la pluie, et dans la maisonnette meublée; le PC hébergeant puis rejoignant.
- Temps de chargement d'une partie sur le PC (budget 5 s) et aucune alerte « Le jeu ne répond plus ».
- Mémoire de Duo dans le Gestionnaire des tâches de Windows pendant 30 minutes de jeu.
- Mise en veille du PC pendant une partie, puis réveil: le jeu reprend-il son image?
