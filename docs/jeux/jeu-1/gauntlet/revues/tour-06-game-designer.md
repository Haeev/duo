# Tour 6: revue adverse du game designer (plaisir, originalité)

| Champ | Valeur |
|---|---|
| Relecteur | game-designer (a écrit la conception du tour, `tour-06-conception.md`, mais n'a rien produit de la réalisation) |
| Date | 2026-10-31 |
| Version lue | branche `claude/stoic-lamport-lueey2` à `9669b93`, plus les retouches en cours dans l'arbre de travail |
| Épreuves | G6 (plaisir: « mieux qu'avant »), G7 (originalité) |
| Références | `revues/tour-05-game-designer.md` (trois priorités du tour 6), grille au tour 5 (moyenne 7,3), `plan-100-heures.md` |
| Sources | `ETAT.md` (sections du tour 6); `donnees/moments.json`, `textes.json`, `quetes.json`, `habitants.json`, `cartes/halte.json`; `src/simulation/moments.ts`, `src/interface/notifications.ts`, `textes-interface.json`; tests `tests/moments.test.ts`, `tests/secrets.test.ts`, `src/interface/tests/*`; captures `captures/tour-06/` (`moment-*`, `faune-*`, `interface-*`) |

## Verdict

- **G6 plaisir: oui, mieux qu'avant.** Les trois priorités que j'avais fixées au tour 5 sont livrées et jouables: les spectacles se voient et s'entendent, un des deux joueurs sait ce que l'autre ignore, on s'assoit vraiment. Quatre réserves, dont une à corriger avant de clore le tour (le texte de l'apogée arrive au début, pas à la fin).
- **G7 originalité: oui.**
- **100 heures: on en est loin.** La démo fait environ 2 heures (15 journées d'environ 8 minutes), soit 2 % de l'objectif, et aucun des huit systèmes de renouvellement du jalon J1 n'existe encore. Détail plus bas.

## G6: preuves du « mieux »

1. **Les spectacles existent.** Six moments P0 sont joués à l'écran avec leurs bêtes animées, leurs sons datés et une vraie raison d'être là: le héron pêche au bord aval du gué, puis s'envole et se pose sur la grève d'en face (`moment-heron.png`, 7,4 s); les neuf oies se dressent, courent sur l'eau et passent en V au-dessus de la place et du puits (`moment-geese.png`, 16,8 s); le renard mulote, regarde, jappe et repart par la voie (`moment-fox.png`); les vers luisants s'allument en front depuis le centre du pré; la mésange porte sa mousse au nichoir. Au tour 5, on envoyait le duo regarder un gué vide; aujourd'hui, la récompense se voit.
2. **Le système renouvelle.** Tirage du matin par empreinte (sans toucher au générateur de la partie, test M-11), au plus un moment par jour, jamais le même à moins de 7 jours (M-07 sur 2 000 graines dans `tests/moments.test.ts`), 4,8 moments par démo en moyenne. Deux duos ne voient plus les mêmes choses les mêmes jours: c'est le premier aléa qui touche environ 40 % des journées, contre quatre jours sur quinze au tour 5.
3. **On sait enfin qu'on regarde.** La pastille sous l'horloge dit ce qui manque à soi (« Approche-toi encore un peu. », « Ne bouge plus. »), puis à l'autre, et l'anneau se remplit chez les deux (`interface-moment-*.png`). C'était le manque relevé au tour 5. Le changement doit tenir 450 ms avant d'être affiché: pas de clignotement au bord du rayon.
4. **Un secret, et la parole comme seul lien (R16).** « Les noms des poules » (semaine 1) et « Le mot de Lucie » (semaine 2): l'informé a une fiche « Rien que pour toi » (`interface-carnet-poules-informe-100.png`), l'autre voit un cadre en pointillés « Une fiche que tu ne vois pas » et le choix des noms (`interface-appel-poule-autre-100.png`). S-02 est prouvé dans Chromium (texte du DOM et libellés accessibles de l'autre). Une erreur ne coûte rien et fait rire (la poule penche la tête: « Cot ? »). Les confidences du matin donnent à l'autre joueur sa propre information, en alternance.
5. **Un geste à deux qui dépend de l'autre.** Tenir l'échelle: si l'un lâche, Basile se fige et crie « Tenez bon, là en bas ! », puis reprend au même instant. Ce n'est plus seulement « être au même endroit »: chacun tient sa part, et si l'un lâche, tout s'arrête pour les deux.
6. **S'asseoir par choix.** Espace près d'un banc assoit au pas même, avec le son `bench-sit`; les envies de banc et les oies l'exigent. La réserve 2 du tour 5 est levée.
7. **Les textes disent vrai.** Relecture texte contre chorégraphie (M-06): `heron_seen`, `geese_seen`, `moment_fox_climax`, `moment_glowworms_climax` et `moment_tits_climax` ne décrivent que ce qui bouge ou s'entend. Seul `moment_ladder_climax` promettait une mésange qui « s'y pose » (elle se pose sur le toit du nichoir 0,4 s): texte corrigé à cette revue.

## G6: réserves

1. **Le texte de l'apogée arrive au début de l'apogée (à corriger avant de clore le tour).** `startClimax` (`src/simulation/moments.ts`, ligne 258) envoie `texts.climax` en notification au tick même du déclenchement. Le joueur lit « Le héron se redresse, vous regarde, pousse un cri rauque et s'envole... » pendant que le héron est encore immobile, et ses yeux quittent la bête pour le coin de l'écran pendant les 6 s de la notification, soit l'essentiel des 7,4 s du spectacle. Le texte raconte la suite avant qu'elle arrive: c'est l'inverse du moment contemplatif voulu. Correctif simple (code, pas texte): envoyer la notification à la fin de la chorégraphie (`elapsed >= climax.seconds`) ou à l'entrée en `after`; garder la récompense au début (la règle « une sortie pendant l'apogée la compte comme vue » ne change pas). Critère: test qui vérifie que la notification d'apogée part au tick `startTick + climax.seconds x 30`, pas avant.
2. **L'échelle se lit mal à distance de jeu.** Sur `moment-ladder.png` (zoom 1, orientation par défaut), les deux joueurs et Basile forment un seul paquet contre la remise; le joueur à `ladder_hold_east` est entre la caméra et l'échelle et cache le haut du corps de Basile pendant la montée (`faune-echelle-sequence.png`, de 0,9 à 8 s). La mésange, qui est le « merci » de la scène, ne reste que 0,4 s sur le toit, au moment où Basile recule. Propositions: mésange posée 1,2 s (apogée de 9 s, rien d'autre ne bouge) et silhouette ou léger fondu d'un personnage qui masque l'acteur principal d'un moment (rendu), plutôt que de déplacer les places, qui sont juste là où l'on tient vraiment une échelle.
3. **Aucune capture ne montre l'interface et la bête ensemble.** Les captures `interface-moment-*` sont posées sans le moment à l'écran (`interface-moment-ensemble-100.png`: « Sans bouger... » au gué, mais pas de héron dans le cadre, et la carte de Sacha dit « En chemin » alors que Sacha est immobile à côté). Le cœur de l'expérience, l'anneau qui se remplit pendant qu'on voit la bête, n'est donc prouvé que par morceaux. À capturer en vrai jeu (`rendu.html?moment=heron&phase=attente` avec l'interface montée) au tour 7. L'activité « En chemin » d'un joueur immobile qui regarde un moment est un petit mensonge du HUD: proposer « Regarde le héron » (ou « Observe ») quand `watching` est vrai.
4. **Le secret se devine sans se parler.** Trois noms dans un ordre fixe: au pire 3 erreurs pour les poules, 2 pour Lucie (S-05 le prouve avec des robots « sourds »). C'était voulu (jamais punitif), et un couple dans la même pièce se parlera; mais l'information n'est qu'un raccourci, pas une nécessité. À surveiller chez le client (S-08: « Qui a dit les noms des poules à qui ? »). Si le couple devine au lieu de parler, piste douce: une poule mal nommée s'éloigne de 3 m en caquetant (deviner coûte quelques secondes, jamais de l'argent).

Mineur, signalé sans bloquer: le titre du test `après 8,6 s on peut lâcher` (`tests/moments.test.ts`, ligne 403) date d'avant l'apogée de 8,2 s (`pauseBefore` vaut 7,4 s); le test `src/interface/tests/moments.test.ts` et le scénario de démonstration utilisaient encore `ladder_hold_south` (le test échouait à ma première exécution), corrigés dans l'arbre de travail pendant la revue, pas par moi.

## Textes relus et corrigés (données seulement)

Tutoiement, rédaction neutre, aucun accord au genre d'un joueur, ton du jeu: tous les textes des moments et des secrets de `textes.json`, `quetes.json`, `habitants.json` et `textes-interface.json` (sections `moments` et `secrets`).

| Clé | Avant | Après | Pourquoi |
|---|---|---|---|
| `heron_watch.completionText` | Le héron vous a vus. 20 sous de Jeanne, pour le spectacle. | Vous avez vu le héron s'envoler. 20 sous de Jeanne, pour le spectacle. | « vus » accordait au masculin les deux joueurs |
| `geese_not_yet` | ... vers quatre heures et demie. | ... à partir de 16 h 30. | l'horloge affiche « 16 h 30 »: même façon de dire l'heure que le HUD et l'objectif |
| `moment_ladder_climax` | ... Une mésange bleue s'y pose aussitôt. | ... Une mésange bleue se pose aussitôt sur le toit du nichoir. | elle se pose sur le toit, elle n'entre pas: dire vrai |
| `odette_hen_names_tell` | Approche, que je te présente tes poules. | Approche, que je te présente vos poules. | les poules sont au duo (« elles sont à vous »), pas à l'informé seul |
| `jeanne_lucie_reminder` | ... Firmin est sur le quai. ... | ... Firmin passe ses journées sur le quai, près de la cloche. ... | Firmin rentre chez lui à 18 h, la quête court jusqu'à 20 h; « près de la cloche » est son point réel (`quay_bell`) |

Relus et gardés: `hen_call_question` (« Comment s'appelle la poule rousse ? »), `hen_call_leave` (« Laisser »), `jeanne_lucie_reminder` au tutoiement (réservé à l'informé, donc juste), « {partner} est là, pas encore en place. », les bulles « Cot ? », « Cot… cot ? », « Cooot ? », les confidences, les souvenirs (« un mercredi soir »: jours en minuscules, juste), les coups de coude et les renvois d'Odette, de Jeanne et de Firmin. « La meilleure équipe du monde » s'accorde à « équipe », pas aux joueurs.

Proposés sans les appliquer, parce qu'un test vérifie la phrase exacte (à changer avec le test, une ligne chacun):

- `moments.partnerNotSettled`: « {partner} est là, mais pas encore en place. » (la phrase actuelle se lit d'un coup comme une faute; `src/interface/tests/moments.test.ts`, ligne 97).
- `hen_names.secret.card.title`: « La confidence d'Odette » au lieu de « Les poules d'Odette » (depuis la quête `hens`, ce ne sont plus ses poules; `tests/secrets.test.ts`, ligne 175).
- `moments.pose.facing` et `stillFacing` disent « vers lui »: juste tant que seul le héron demande de se tourner; un futur moment au nom féminin (la chevrette) devra passer par un texte propre au moment.

## G7: originalité

Oui. Observer une bête, deviner un nom, tenir une échelle, transmettre un message sont des formes génériques. Les habillages sont propres au jeu: le héron du gué de l'Aubrune, les oies qui passent au-dessus du panneau « Aubrune », le nichoir de Basile sur le seul vieux chêne qu'on ne coupe pas, les poules d'Odette qui « apprennent une voix à la fois », la réponse de Firmin que Jeanne veut entendre « de l'autre, sinon tu vas rougir ». L'information asymétrique entre deux joueurs dans la même pièce existe ailleurs (jeux de désamorçage à manuel), mais ici elle est douce, sans chrono ni échec, et portée par des personnages: aucune combinaison de règles reconnaissable. Pas de jauge d'amitié chiffrée, pas de collection d'insectes à vendre, pas de musée: rien qui rapproche des références du client.

## Notes proposées

| Pilier | Grille au tour 5 | Proposée | Justification |
|---|---|---|---|
| 1. Ressenti | 7 | **7,5** | Deux verbes nouveaux avec réponse immédiate: s'asseoir (au pas même, glissement de 0,22 s, son de planche, lever par toute direction, aucune touche morte près d'un banc) et tenir l'échelle (placement en 0,2 s face au montant, `ladder_grip`, lâcher par toute direction). Le trou de crédibilité du tour 5 (« le jeu demande de s'asseoir, on ne peut pas ») est comblé. Pas 8: je n'ai pas joué au clavier ni mesuré la latence, et rien n'a été repris sur la marche, la visée ou la caméra depuis le tour 2. |
| 5. Interface | 7 | **7,5** | Le manque que j'avais relevé (rien n'indique qu'on regarde) est comblé par une ligne qui dit d'abord ce qui manque à soi, puis à l'autre, et un anneau commun; fiches secrètes claires des deux côtés; appel des poules lisible à 100 et 150 % (captures à 1366x768); matin d'une confidence qui tient sans défiler à 150 %. Pas 8: la notification d'apogée détourne le regard au pire moment (réserve 1), « En chemin » pour un joueur immobile, et aucune capture de l'interface avec la bête à l'écran. |
| 6. Contenu et rythme | 7,5 | **7,5** | Sur le périmètre de la démo, je mettrais 8: six moments tirés, deux quêtes secrètes à variantes (6 permutations de poules, 3 réponses de Firmin), un aléa sur environ 40 % des journées. Mais le pilier vise 100 heures: la démo s'arrête toujours au jour 15, la météo et les commandes restent des listes écrites, et rien de la structure longue (saisons, commande générée, annonces, robot longue vie) n'a avancé. Je garde 7,5 pour ne pas gonfler, avec la même raison qu'au tour 5. |
| 7. Coopération | 7,5 | **8** | R16 enfin tenu: une quête secrète par semaine, plus une confidence du matin à chaque moment d'ambiance, chez chacun à tour de rôle. Un geste à deux d'une nature nouvelle (l'un dépend de l'autre en continu: l'échelle). L'apogée n'attend que les deux et pousse à s'appeler (« Montre-le à {partner} ! »). Réserves: le secret se devine sans parler (réserve 4), le guidage (carnet perdu, P1) n'est pas fait. Note à confirmer par l'observation chez le client (S-08); à ramener à 7,5 si le couple devine au lieu de se parler. |

## À quelle distance des 100 heures

| Repère | Aujourd'hui | Objectif (plan des 100 heures) |
|---|---|---|
| Durée jouable | environ 2 h (15 journées de 8 min) | 99,9 h (372 journées) |
| Après le jour 15 | écran de fin, rien ne continue | J1 (jours 15 à 23), puis l'été à 0,8 s par minute de jeu |
| Systèmes de renouvellement du J1 (section 5, n° 1 à 8) | 0 sur 8 faits; n° 2 (répliques vivantes) en partie (tirage « la moins récente », sans réserves conditionnées ni gabarits de souvenir) | 8 |
| Moments rares | 6 (P0), réserve unique pour toute l'année | au moins 12 par saison (annexe A: sinon le même revient tous les 10 jours en médiane) |
| Mesure de la répétition sur la durée | aucune: les robots jouent 15 jours | robot longue vie sur 5 années simulées (R1 à R16) |

Ce qui manque le plus, dans l'ordre: **un monde qui continue après le jour 15** (saisons, météo tirée, commande générée, repousse des arbres): sans lui, chaque heure de plus coûte du contenu écrit jour par jour, intenable sur 372 journées; puis **l'instrument de mesure** (robot longue vie), sans lequel « non répétitif » reste une promesse; puis **des buts du jour qui se renouvellent** (petites annonces, répliques qui parlent de ce que le duo a fait). Six tours de gauntlet ont poli la démo de 5,8 à 7,3 de moyenne; le tour 6 est le premier à ajouter un système qui renouvelle (les moments), mais à l'échelle des 100 heures on n'a pas encore quitté le jour 15. À l'échelle d'effort du plan (S = 1 tour, M = 2 à 3), le J1 pèse 5 systèmes M et 3 S: plusieurs tours en parallèle, pas un.

## Les trois priorités du tour 7

### 1. Le monde continue après le jour 15 (piliers 6 et 7; systèmes n° 1, 3 et 8 du plan)

Les jours 1 à 15 restent identiques pour tous (la démo est un récit), puis la partie continue: saison courante et météo tirée par la graine du monde (FE-09), commande du samedi générée (EC-05 à EC-09) au train du jour 22, arbres qui repoussent (souches, jeunes arbres). L'écran de fin du jour 15 devient une scène de passage, pas un mur.

- Les robots jouent jusqu'au jour 42 sur 8 graines, sans blocage ni erreur, sauvegarde et reprise à chaque aube.
- Météo tirée: aucune séquence de 7 jours identique entre deux graines sur 1 000 graines; au plus 3 jours de pluie d'affilée; la météo d'un jour imposé (fête) reste celle qui est écrite.
- Commande générée: jamais le même lot deux samedis de suite; réussie par les robots médians à plus de 80 % (simulation jointe).
- Non-régression: avec la même graine, les jours 1 à 15 sont identiques à aujourd'hui (même test que M-11: même générateur, mêmes envies, mêmes variantes).
- Le bois ne s'épuise plus: au jour 42, au moins 6 arbres abattables sur la carte pour toute graine.

### 2. Le robot longue vie, premier jet (pilier 6; système n° 18 du plan)

Sans mesure, on ne prouve rien sur « 100 heures sans répétition ». Un robot qui joue une année simulée (84 jours) et écrit un rapport.

- Durée: 84 jours simulés en moins de 10 minutes sur la machine de CI, 4 graines.
- Rapport automatique: R1 (part des journées avec au moins une « première fois », cible 95 %), R2 (redites sur 28 jours par habitant, cible sous 2 %), R6 (envies jamais revues avant 7 jours, part d'envies jamais vécues), moments (écart médian entre deux passages du même moment), part du temps passé en soins quotidiens (R12, cible 30 % au plus).
- Les seuils non tenus sont listés, pas masqués: le premier rapport sert de point de départ chiffré pour les tours suivants, joint à la revue.

### 3. Les moments, finis et doublés (piliers 2, 5 et 7; R8 et R9)

La matière renouvelable la moins chère du jeu, déjà outillée: la finir et la doubler.

- Texte d'apogée envoyé à la fin de la chorégraphie (test: tick d'envoi égal à `startTick + climax.seconds x 30`); activité du partenaire « Observe » quand il regarde un moment.
- Échelle lisible: mésange posée au moins 1,2 s; dans les 4 orientations, Basile visible (non masqué à plus de 30 %, mesuré par un rendu des masques de personnages) sur au moins 80 % des images de l'apogée.
- Réserve portée à 12: chevrette et martin-pêcheur (P1, déjà conçus), plus 4 moments liés à la saison qui suit la démo (proposition: hirondelles sous la marquise du quai, brume du matin sur l'Aubrune, crapauds au gué un soir de pluie, chouette sur le toit de la remise), chacun avec sa raison d'être écrite. Script `moments_rares.py` relancé: écart médian entre deux passages d'un même moment d'au moins 19 jours sur une saison de 21 jours.
- Onglet « Souvenirs » du carnet (P1): chaque moment vu à deux, avec son jour; capture à 100 et 150 %.
- Une capture en vrai jeu par moment montrant l'anneau sous l'horloge et la bête dans le même cadre.

## Non vérifié

- Je n'ai pas joué au clavier ni lancé deux instances: le ressenti de l'assise et de l'échelle, l'écart entre les deux écrans (M-03) et le son ne sont jugés que sur les données, le code, les tests et les captures.
- Le son des moments n'est pas écouté (aucune sortie audio ici).
- S-08 (le couple se parle) ne peut se vérifier que chez le client.
- Les tests de simulation complets (`tests/moments.test.ts`, `tests/secrets.test.ts`) ont été relancés une fois; les tests d'endurance sur 8 graines ne l'ont pas été.
