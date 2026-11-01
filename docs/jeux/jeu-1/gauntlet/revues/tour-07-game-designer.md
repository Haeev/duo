# Tour 7: revue adverse du game designer (plaisir, originalité)

| Champ | Valeur |
|---|---|
| Relecteur | game-designer (a écrit la conception du tour, `tour-07-conception.md`, n'a rien produit de la réalisation) |
| Date | 2026-11-01 |
| Version lue | branche `claude/stoic-lamport-lueey2` à `063d907`, puis `aab36a2` (instantané qui contient mes corrections de textes) |
| Épreuves | G6 (plaisir: « mieux qu'avant »), G7 (originalité) |
| Références | `revues/tour-06-game-designer.md` (trois priorités du tour 7), grille au tour 6 (moyenne 7,6), `plan-100-heures.md` (décisions D1 à D9) |
| Sources | `ETAT.md` (sections du tour 7); `donnees/moments.json`, `textes.json`, `quetes.json`; `src/simulation/moments.ts`, `src/interface/modele-moments.ts`, `modele-souvenirs.ts`, `carnet.ts`; tests du jeu; captures `captures/tour-07/` (`moment-*`, `souvenirs-*`, `faune-*`, `faune-ambiance`, `echelle-4-orientations`); vignettes du sprite rendues en PNG |

## Verdict

- **G6 plaisir: oui, mieux qu'avant**, avec une réserve à corriger avant de clore le tour: pendant la brume, la ligne sous l'horloge ment quand les deux joueurs sont sur la même rive (mesuré, réserve 1).
- **G7 originalité: oui.**
- **100 heures: toujours environ 2 heures jouables.** Le tour 7 a traité la priorité 3 du tour 6 (les moments, l'onglet Souvenirs) mais pas les priorités 1 et 2 (le monde qui continue après le jour 15, le robot longue vie). Les pièces posées servent le long terme (calendrier des saisons, météo de la veille, règles de tirage pour les années suivantes, mémoire bornée), mais une partie réelle s'arrête toujours au jour 15.

## G6: preuves du « mieux »

1. **Deux poses neuves qui obligent à se parler.** La chevrette demande de s'approcher pendant qu'elle broute et de se figer quand elle lève la tête (`moment-chevrette.png`, regard à 8,2 s); bouger la fait frapper du pied, aboyer et reculer, jamais fuir (M-17 testé). La brume demande un joueur sur chaque rive, face à face: il faut décider qui passe le gué, 27 m plus loin. Au tour 6, tous les moments demandaient « être là, immobiles »; ici, on se dit « Stop, elle regarde ! » et « Passe de l'autre côté ».
2. **Des spectacles justes et lisibles de près.** Le faon se lève de l'herbe, trotte, tète, puis repart avec elle (`moment-chevrette.png`, vignettes a à e). Le martin-pêcheur plonge, ressort avec l'ablette, la frappe sur le pieu, l'avale et file au ras de l'eau (`moment-martin-pecheur.png`); le pieu garde 0,45 m au-dessus du plancher. La brume couvre l'eau sans dépasser la taille des personnages et se lève en front de l'aval vers le gué, l'un voit l'autre en entier à 5,2 s (`moment-brume.png`).
3. **Le carnet se souvient du couple.** L'onglet Souvenirs raconte les mêmes moments du point de vue de qui lit (« Tu étais dans la confidence (Odette). » chez l'un, « Sacha était dans la confidence (Odette). » chez l'autre), sans compteur ni case vide (S-11 testé dans Chromium), lisible à 100 et 150 % chez les deux (`souvenirs-*.png`). La rumeur du bas de page diffère chez les deux joueurs: de quoi se dire « Toi aussi tu as entendu ça ? ». C'est le premier écran du jeu qu'on ouvre pour se rappeler, pas pour agir.
4. **Le tirage tient sur la durée, sans toucher à la démo.** Fenêtre propre, jours de fête, chance réduite quand la réserve de la saison est petite, coup de pouce aux moments jamais vus: joués et testés, sans effet sur les 15 jours de la démo (test dédié).
5. **Faune d'ambiance hors des moments.** Mésanges sur les buissons qui s'envolent quand on approche, papillons du pré par beau temps, rien sous la pluie (`faune-ambiance.png`): le pré vit même les jours sans moment. L'échelle est enfin lisible dans les quatre orientations (`echelle-4-orientations.png`, reste du tour 6).

## G6: réserves

1. **Brume: la ligne sous l'horloge ment (à corriger avant de clore le tour).** Test jetable avec les robots du jeu (`watchModel`, positions du test M-18): deux joueurs immobiles, face à face sur la rive nord, voient tous les deux « Sans bouger… » et un anneau à 0 qui ne se remplit jamais. Sur deux rives, si l'un tourne le dos à l'autre, aucune ligne chez l'un ni chez l'autre. Cause: `missingPose` (`src/interface/modele-moments.ts`) ne connaît ni `opposite` ni `facingPartner`, et la ligne « ensemble » ne regarde pas la condition de rives. Les textes `moment_opposite_same_bank` et `moment_face_partner` existent dans `textes.json` mais aucun code ne les lit. Sans confidence, un duo n'a aucun moyen de deviner la pose. Critère proposé M-26 (`tour-07-conception.md`, section 7.4). En attendant le correctif, j'ai ajouté la pose à la confidence de Firmin.
2. **Chevrette: les lignes « figer » ne sont pas branchées.** Pendant qu'elle broute, « Sans bouger… » et l'anneau vide; pendant un regard, l'anneau se remplit bien. `moment_freeze_graze` et `moment_freeze_look` ne sont lus nulle part. Jouable (l'aboiement et le texte d'effarouchement apprennent la règle au deuxième essai), mais le jeu « un, deux, trois, soleil » se lit mieux avec les deux lignes. Critère proposé M-27.
3. **Toujours aucune capture avec l'interface et la bête dans le même cadre** (M-16; c'était déjà la réserve 3 du tour 6). Une telle capture de la brume aurait montré le défaut de la réserve 1.
4. **Le martin-pêcheur reste minuscule au zoom de départ.** Sur `moment-martin-pecheur.png` (zoom 1, orientation 0), l'oiseau fait une dizaine de pixels; on le suit par le plongeon et le son. L'échelle x 1,5 (question 3 de la conception) attend toujours la décision du directeur artistique.
5. **Neuf moments sur douze.** Les étoiles, la valse et le salut du mécanicien ne sont pas produits (M-13 non tenu). Les étoiles et le salut ne servent qu'en été et les jours du train après la démo: sans monde après le jour 15, leur absence ne se voit pas encore.

Mineurs: vignette de la chevrette dont les deux pointes de la tête se lisent comme des bois à 40 px (directeur artistique); vignette de l'échelle sans échelle (texte de remplacement corrigé); sons `journal-new` et `journal-open` de l'onglet non branchés (`ui-tab` joue à la place).

## Textes relus et corrigés (données seulement)

Relus: rumeurs, textes de vignette, confidences, apogées, souvenirs et lignes d'observation des neuf moments; bloc `souvenirs`; lignes d'activité de l'autre (`partner.watching`). Tutoiement, rédaction neutre, et chaque texte confronté aux images clés, aux conditions de `moments.json` et aux captures. Le détail avant et après est dans `tour-07-conception.md`, section 7.2; l'essentiel:

| Clé | Correction | Pourquoi |
|---|---|---|
| les 8 rumeurs | commencent par « que » ou « qu' », en minuscule: « On dit au bourg… » puis « qu'un héron pêche au gué, certains après-midi. » | le titre disait déjà « On dit » (signalé par le dev); la rumeur en devient la suite, vérifié sur une capture de l'onglet refaite avec les nouveaux textes |
| `moment_roe_deer_rumor` | « à l'aube » au lieu de « avant le café » | le bourg n'a pas de café |
| `moment_kingfisher_rumor` | « les matins de soleil » | il ne vient que par soleil, le matin |
| `moment_tits_rumor` | « visitent le nichoir du grand chêne, certains matins » | elle ne sort qu'une fois le nichoir redressé: elle rappelait ce que le duo avait déjà fait |
| `moment_roe_deer_climax` | « regagnent le fourré » au lieu de « rentrent dans la haie » | à l'écran, la lisière est du pré se voit comme des arbres |
| `moment_roe_deer_startled` | « Elle a vu bouger: elle frappe du pied et recule. Attends qu'elle se remette à brouter. » | dit ce qui se voit et s'entend |
| `moment_freeze_graze` | « Elle broute: tu peux bouger. » | « approche » était faux pour qui est déjà à bonne distance |
| `moment_mist_hint` | ajoute « Mettez-vous de part et d'autre, face à face, et attendez que la brume se lève. » | la pose ne se trouvait pas (réserve 1) |
| `moment_mist_climax` | « La lumière se réchauffe. » au lieu de « dore d'un coup » | la teinte monte en 3 s |
| `moment_opposite_same_bank` | « passe sur l'autre par le gué, ou attends que {partner} y passe. » | « l'un de vous deux » est un masculin générique |
| `moment_roe_deer_vignette`, `moment_ladder_vignette` | décrivent ce que montrent les vignettes | le pré est ras; l'échelle n'est pas dessinée |

Aucun accord au genre d'un joueur trouvé. Proposé sans l'appliquer (phrase épinglée par `src/interface/tests/souvenirs.test.ts`, lignes 115 et 117): « Odette t'avait confié leurs noms; {partner} les a appelées. » et « {partner} t'a soufflé leurs noms; tu les as appelées. », pour que « les » ne renvoie pas aux noms puis aux poules dans la même phrase.

## G7: originalité

Oui. S'approcher d'une bête quand elle ne regarde pas est un jeu d'enfant universel (« un, deux, trois, soleil »); se poster de part et d'autre d'une rivière, un album de souvenirs: formes génériques. L'habillage et les règles sont propres au jeu: la chevrette du pré d'Odette qui revient allaiter son faon caché, le martin-pêcheur sur le pieu où l'on amarre la barque des crues, la brume que seul un jour de pluie fait naître et qu'on regarde se lever face à l'autre, un carnet qui raconte le même souvenir autrement selon qui le lit, une rumeur différente pour chacun. Pas de collection affichée, pas de musée, pas de compteur de bêtes: rien qui rapproche des jeux de référence du client.

## Notes proposées

| Pilier | Grille au tour 6 | Proposée | Justification |
|---|---|---|---|
| 1. Ressenti | 7,5 | **7,5** | Rien n'a changé dans la marche, la visée ou la caméra. Les poses nouvelles réutilisent les verbes existants (s'arrêter, se tourner), ce qui est bien: aucune touche nouvelle à apprendre. Pas de raison de bouger la note sans avoir joué au clavier. |
| 5. Interface | 7,5 | **7,5** | L'onglet Souvenirs vaut 8 à lui seul (clavier et souris, 150 %, lecteur d'écran, aucun débordement, rumeur bien placée). Mais la ligne d'observation, cœur des moments, ment pendant la brume et reste générique pour la chevrette (réserves 1 et 2), et M-16 n'est toujours pas prouvé. 8 quand M-26 et M-27 passent. |
| 6. Contenu et rythme | 7,5 | **7,5** | Neuf moments au lieu de six, souvenirs, règles de tirage pour plusieurs années, faune d'ambiance: sur le périmètre de la démo, je mettrais 8. Le pilier vise 100 heures et la partie finit toujours au jour 15; je garde 7,5 pour la même raison qu'aux tours 5 et 6. |
| 7. Coopération | 8 | **8** | La brume est le meilleur geste de communication du jeu à ce jour (qui passe le gué, se faire face), la chevrette fait parler à voix basse, la rumeur diffère chez les deux. Mais la brume n'est guidée que par la confidence (réserve 1), et S-08 n'est toujours pas observé chez le client. 8,5 après le correctif et une observation. |

Moyenne des huit piliers inchangée à 7,6 si les autres relecteurs ne changent pas leurs notes.

## À quelle distance des 100 heures

| Repère | Aujourd'hui | Objectif (plan des 100 heures) |
|---|---|---|
| Durée jouable | environ 2 h (15 journées de 8 min); `lastDay` vaut toujours 15 | 99,9 h (372 journées) |
| Après le jour 15 | écran de fin; les robots ne vont au jour 42 qu'en prolongeant les réglages dans un test | J1 (jours 15 à 23), puis l'été |
| Systèmes du J1 (plan, section 5, n° 1 à 8) | 0 sur 8 finis. N° 1 (saisons et météo) en partie: calendrier des saisons pour les souvenirs, conditions `season_is` et `weather_was`, mais ni saison du monde ni météo tirée. N° 2 en partie depuis le tour 3 | 8 |
| Moments rares | 9 (hors échelle, moment de quête: 8 d'ambiance); possibles au printemps 8, en été 6, en automne 4, en hiver 2 (le héron et le renard) | au moins 12, puis 2 neufs par saison et par année (simulation du tour 7) |
| Mesure de la répétition | aucune au-delà de 42 jours; pas de rapport R1 à R16 | robot longue vie sur 84 jours puis 5 années |

Je n'ai pas compté les moments par saison dans le jeu: ces nombres viennent des conditions de `moments.json` lues à la main (chevrette, vers luisants: fin de printemps et été; oies et mésanges: printemps; martin-pêcheur et brume: printemps à automne; héron et renard: toute l'année).

En bref: le tour 7 a enrichi la démo et préparé le long terme, mais il ne nous a pas rapprochés des 100 heures jouables. Il faut deux tours consacrés au monde après le jour 15 et au robot pour que chaque tour suivant ajoute des heures réelles.

## Ce qui peut avancer sans les décisions D1 à D9

| Chantier | Dépend de | Pourquoi il peut avancer, ou attendre |
|---|---|---|
| Saisons du monde et météo tirée (L1) | rien | la règle est la même quelles que soient les réponses; les jours de fête gardent leur météo écrite |
| Commande du samedi générée (L3) | rien | même règle dans toutes les options |
| Repousse des arbres (système n° 8) | rien | lève le mur du bois fini, nécessaire dans toutes les options |
| Robot longue vie et rapport (n° 18) | rien | instrument de mesure, utile quelle que soit la suite |
| Petites annonces (n° 4) | rien pour le système; D5 pour le volume de textes | 30 gabarits suffisent pour J1 dans les deux options de D5 |
| Brume et chevrette (réserves 1 et 2), étoiles de l'Aubrune | rien | les étoiles ne servent qu'en été, utile dès que le monde y arrive |
| Prolonger la partie de la démo au-delà du jour 15 | D4 (la sauvegarde continue, ou nouvelle partie) | construire la suite derrière un bouton « Continuer » de l'écran de fin: cela convient aux deux réponses; la migration reste à faire si D4 est « oui » (recommandé) |
| Jours 22 et 23 (inauguration) | D6 (garde-fou) | le garde-fou est un réglage: le coder dans les deux sens, la valeur se choisit à la réponse |
| Salut du mécanicien | question 2 de la conception (train qui ralentit) | jouable avec le départ ordinaire de 6 s; le ralenti s'ajoute si le client dit oui |
| Valse d'Odette, bal de la fête des semailles | D7 (tendresse) et question 1 de la conception | attendre: c'est le premier geste tendre entre les personnages, au client de le décider |
| Rythme de la journée à 0,8 s | D1 | ne vaut qu'à partir du jour 24 (J2): rien à faire avant |
| Ordre de l'année 1, maison, après le Terminus, rythme des livraisons | D2, D3, D8, D9 | J2 et au-delà: aucun travail du tour 8 n'en dépend |

## Les trois priorités du tour 8

### 1. Le monde continue après le jour 15, pour de vrai (piliers 6 et 7; systèmes n° 1, 3 et 8; sans décision du client)

Reprise de la priorité 1 du tour 6, non traitée au tour 7. L'écran de fin du jour 15 propose « Continuer »; ensuite, saison courante et météo tirée par la graine du monde, commande du samedi générée au jour 15 à 16 h, souches et jeunes arbres qui repoussent.

- Les robots jouent jusqu'au jour 42 avec les réglages livrés (pas prolongés dans le test), sur 8 graines, sans blocage, sauvegarde et reprise à chaque aube.
- Non-régression: avec la même graine, les jours 1 à 15 restent identiques (même test que M-11).
- Météo tirée: au plus 3 jours de pluie d'affilée; jours de fête au soleil imposé; la brume suit la météo tirée (`weather_was`).
- Commande générée: jamais le même lot deux samedis de suite; faisable en 6 jours avec ce que possède le duo; réussie par les robots médians à plus de 80 %.
- Au jour 42, au moins 6 arbres abattables pour toute graine.

### 2. Le robot longue vie et son rapport (pilier 6; système n° 18; sans décision du client)

Reprise de la priorité 2 du tour 6. Sans lui, « 100 heures sans répétition » reste une promesse.

- 84 jours simulés en moins de 10 minutes, 4 graines.
- Rapport écrit à chaque exécution: R1 (journées avec une « première fois », cible 95 %), R2 (redites par habitant sur 28 jours, cible sous 2 %), R6 (envies), écart médian entre deux passages d'un même moment (cible 19 jours au printemps et en été, M-22), jours de fête sans moment (M-21), taille de `world.memories` (S-14), part du temps en soins quotidiens (R12).
- Les seuils non tenus sont listés, pas masqués; le premier rapport sert de référence chiffrée aux tours suivants.

### 3. Les moments: honnêtes, puis prêts pour l'été (piliers 5 et 7)

- Ligne d'observation de la brume et de la chevrette branchée sur leurs textes (M-26, M-27), si le correctif n'a pas été fait pour clore le tour 7.
- Une capture en vrai jeu par moment du tour 7, chez l'hôte et chez l'invité, avec l'anneau et la bête dans le même cadre (M-16).
- Échelle du martin-pêcheur tranchée par le directeur artistique sur cette capture.
- Les étoiles de l'Aubrune (fiche 1.4.10) et le salut du mécanicien avec le départ ordinaire (fiche 1.4.12), pour que l'été qui arrive par la priorité 1 ait ses moments; la valse attend D7.

## Non vérifié

- Je n'ai pas joué au clavier ni lancé deux instances: le ressenti du « figer », du passage du gué pendant la brume et l'écart entre les deux écrans ne sont jugés que sur les données, le code, les tests et les captures.
- Le son des trois moments n'est pas écouté (aucune sortie audio ici).
- Le nombre de moments par saison est lu dans les conditions, pas mesuré par le robot.
- S-16 et S-08 (le couple en parle, se parle) ne se vérifient que chez le client.
