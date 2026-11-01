# Tour 8: revue adverse du game designer (plaisir, originalité)

| Champ | Valeur |
|---|---|
| Relecteur | game-designer (a écrit la conception du tour, `tour-08-conception.md`, n'a rien produit de la réalisation) |
| Date | 2026-11-01 |
| Version lue | branche `claude/stoic-lamport-lueey2` à `5625f72`, puis `ac581a8` (mes corrections de textes en `45f2c1d`, correctif du dev en `565439e`) |
| Épreuves | G6 (plaisir: « mieux qu'avant »), G7 (originalité) |
| Références | `revues/tour-07-game-designer.md` (trois priorités du tour 8), grille (moyenne 7,6), `plan-100-heures.md` |
| Sources | `ETAT.md` (sections du tour 8); `rapports/longue-vie-tour-08.md`; captures `captures/tour-08/` (écrans d'étape, saison, carnet, courrier, caisse, HUD, brume, cueillettes); `tests/ete/`, `tests/suite-*.test.ts`; `donnees/*.json`, `src/interface/textes-interface.json`, `src/simulation/courrier.ts`, `src/simulation/moments.ts` |

## Verdict

- **G6 plaisir: oui, mieux qu'avant.** Pour la première fois, la partie ne s'arrête pas au jour 15: le duo peut rester, et la Halte change d'elle-même pendant quatre semaines de plus. C'était la priorité 1 depuis le tour 6; elle est livrée, mesurée et tenue sur les jours 16 à 43. Deux réserves fortes (l'argent ne sert plus à rien, aucun but écrit après le jour 15), aucune bloquante.
- **G7 originalité: oui.**
- **100 heures: environ 5,5 heures jouables** (43 journées d'environ 8 minutes), dont 3,7 heures neuves ce tour. Il en manque environ 94.

## G6: preuves du « mieux »

1. **On reste, et on le décide à deux.** L'écran d'étape du jour 15 (`interface-etape-15-*.png`) propose « Rester à la Halte » et « Finir la séance »; chaque carte dit le choix de l'autre, et rien ne se passe tant que les choix diffèrent (« Vos choix diffèrent : parlez-en, tu peux encore changer le tien. »). C'est une petite négociation de couple, sans perdant. Au jour 43, l'écran dit la vérité: « Rester » reviendra avec la mise à jour, rien n'est perdu (`interface-etape-43-*.png`). Testé par `suite-etapes.test.ts` et `src/interface/tests/etape.test.ts`.
2. **Le monde change sans qu'on le pousse.** Météo tirée par la graine, brume le matin d'après une pluie (« Soleil, brume au lever », `interface-brume-matin-p1-100.png`), carte de saison au petit-déjeuner du jour 22 (`interface-saison-ete-*.png`), palette, lumière et horaires d'été, souches qui deviennent rejets puis arbres, cueillette de saison chaque matin. Le robot longue vie compte au moins une première fois dans 96,4 à 100 % des journées 16 à 43, par joueur, et au moins 3 par semaine partout (O-01 tenu).
3. **La commande du samedi ne se répète plus.** Dix commandes tirées par partie, aucune identique à la précédente, 3 à 4 familles, aucune paire qui puise dans le même légume (I-04 tenu sur 7 parties). 86,1 % de commandes complètes pour un duo médian (O-04 tenu), et la lettre de la coopérative explique ce qui demande de l'avance. Elle donne un vrai sujet au petit-déjeuner: « toi la rivière, moi le potager ».
4. **La lisière vit.** O-05 tenu: 10 arbres abattables au moins au jour 42, jamais 0 en profil médian; la hache refuse une souche ou un rejet avec un coup mat et un texte, sans punir. Les cueillettes suivent les saisons (printemps: pissenlit et ail des ours; été: mûres et girolles; automne: noisettes; L-07).
5. **Les habitants ont de quoi dire.** 0 % de redites à moins de 28 jours sur les jours 16 à 43, même pour le profil assidu qui parle à tout le monde chaque jour (O-02 tenu); 1,2 % au plus jusqu'au jour 84 en profil médian.
6. **Rien de la démo n'a bougé.** Jours 1 à 15 identiques à une partie sans les systèmes nouveaux (I-07, 14 aubes); reprise à l'identique à chaque aube sur 84 jours (I-02).

## G6: réserves

1. **L'argent ne sert plus à rien après le jour 22 (forte).** Une commande générée paie 600 à 1 500 sous; les huit objets et meubles en vente (catalogue et comptoir) coûtent 500 sous en tout, une fois chacun; restent les graines, à 6 à 12 sous. La capture du jour 26 montre 1 844 sous sans rien à acheter. La commande devient une corvée sans récompense au bout de deux semaines. Le hors-périmètre du tour l'annonçait (section 12); c'est maintenant le premier manque qu'un duo remarquera.
2. **Aucun but écrit après le jour 15 (forte).** Pas de quête, pas de scène, pas d'annonce: le carnet n'a qu'une ligne, la commande. Les envies et les moments font la journée, pas la semaine. Les derniers jours de l'été sont les plus pauvres (prévu par la simulation, partie 8).
3. **La truite d'été coûte deux fois ce que la commande croit (défaut de ma conception).** Le coût d'une truite est calculé au poids de printemps (2 sur 11), alors que l'été la ramène à 1 sur 11. Deux truites demandent deux fois plus de lancers que la part prévue et payée. Correctif proposé: un coût par saison (`tour-08-conception.md`, 14.3).
4. **Les cueillettes se voient mal.** Sur `cueillette-roncier-mures.png`, les mûres font quelques pixels sur le roncier, même en gros plan; le tas de noisettes est posé à environ 1,5 m du noisetier, dans l'herbe nue, plutôt que sous la couronne (`cueillette-noisettes.png`). À juger par le directeur artistique; un objet qu'on ne voit pas n'est pas une invitation.
5. **Des lignes de commande lourdes à lire.** « 26 radis » (`interface-ete-caisse-p1-100.png`) suit le modèle (la moitié du potager pour une semaine), mais se lit comme une punition à côté de « 2 truites ». Piste: arrondir les quantités du potager au rendement d'une récolte et plafonner une ligne à 18 unités, quitte à ajouter une ligne.
6. **O-06 manqué: les mêmes bêtes reviennent trop tôt en été.** Écart médian de 16,5 jours pour 19 visés. L'été n'a que 6 moments, dont 3 à conditions étroites (brume, vers luisants, chevrette): le héron, le renard et le martin-pêcheur repassent plus souvent. Le printemps (11 jours, 9 écarts) n'est pas jugeable: ses écarts chevauchent la démo, avant la fenêtre longue du jour 24. Les étoiles de l'Aubrune et le salut du mécanicien, priorité 3 du tour 8, ne sont pas faits (toujours 9 moments).
7. **Le carnet et le courrier vieillissent mal.** Le titre de groupe du carnet disait « Deux semaines à la Halte » au jour 26 (corrigé). Dans la liste du courrier, la lettre de commande et le récapitulatif du même samedi s'affichent tous les deux « La coopérative de la ligne, Samedi 22 », sans titre pour les distinguer (`interface-ete-courrier-p1-100.png`, à transmettre au designer UX).

Hors de mon épreuve: l'état dépassait 48 000 octets au jour 84 dans les sept parties (I-06), et un duo au sac plein laissait au sol un tas par objet reçu, sans borne (point 5 du rapport). Le correctif du dev (`565439e`: état compacté, sol rangé chaque nuit dans le coffre, texte `ground_tidied`) est arrivé pendant ma revue; je ne l'ai pas revérifié au robot longue vie.

## Textes relus et corrigés (données seulement)

Relus en situation, face aux captures et aux conditions des données: écran d'étape (jours 15 et 43), cartes de saison, lettres de commande générées et récapitulatifs (salutations, conseils), 18 envies, 70 répliques et 9 bornes, astuces de cueillette et de repousse, messages de la hache. Chaque lieu cité existe sur la carte (tonnelle d'Odette, banc du quai, cour de la scierie). Le détail avant et après est dans `tour-08-conception.md`, section 14.1; l'essentiel:

| Clé | Correction | Pourquoi |
|---|---|---|
| `ui.questKinds.main` | « À la Halte » | titre de groupe du carnet, faux dès le jour 16 |
| `saturday_order`, objectif | « avant samedi 8 à 16 h » | les autres commandes donnent le jour |
| `forage_hint` | « approche-toi, puis {act} ou un clic pour le ramasser » | « Agir » n'est aucune touche; `{act}` affiche la touche réelle |
| `sapling_hint`, `stump_hint` | « Ce jeune arbre repousse… », « un jeune arbre poussera à la place » | le sapin ne rejette pas: Basile le replante |
| salutation « Merci pour le train de samedi ! » | « Le train de ce samedi est bien arrivé en ville. » | la lettre est datée du samedi même |
| « Les jours rallongent » (été) | « Les journées sont longues » | l'été du jeu commence au plus long des jours |
| `stages.summer_end.text` | « la suite de votre histoire » | « sa suite » renvoyait à l'automne |
| `title.ticket` | « Six semaines à la Halte d'Aubrune » | l'écran titre annonçait deux semaines |
| `endScreen` (interface de secours) | « Le train est reparti », vrai aux deux étapes | disait « Fin de la démo » au jour 43 |

Validateur des données: 0 erreur, 0 avertissement. Tests liés relancés (25 fichiers, 207 tests, tous passés). Aucun accord au genre d'un joueur trouvé dans les textes ajoutés.

## Écarts des devs

| Écart | Verdict |
|---|---|
| Lignes de commande tirées par `unitDraw` (le script tirait par `random.Random`) | validé: c'est ce que disait la conception (4.4); une commande devient épinglable dans un test. Les chiffres de la simulation restent valables en moyenne, pas graine par graine |
| Candidat écarté si son minimum ne tient plus | validé: c'est le garde-fou de faisabilité (4.5), appliqué avant le tirage |
| Trois premières lignes de trois familles différentes | validé: réalise « au moins 3 familles tant que c'est possible » sans retirage; mesuré, 0 problème |
| Deux noisetiers au lieu d'un | validé: une noisette tombe au pied d'un noisetier, il en faut un par coin de sous-bois. Le tas gagnerait à être plus près du pied (réserve 4) |
| T8-16 vérifié graine par graine | validé: plus exigeant que la moyenne, et un duo ne vit qu'une graine |
| O-06 (11 jours au printemps, 16,5 en été, pour 19) | accepté pour ce tour, à reprendre au tour 9: du contenu d'été (deux moments) plutôt qu'une chance plus basse, qui retirerait des moments; en réglage, `longFromDay` à 16 pour que la fenêtre longue couvre la fin du printemps |

## G7: originalité

Oui. Météo tirée, saisons, cueillette par coins, repousse des arbres et commande hebdomadaire sont des formes génériques de la simulation de vie. L'habillage et les règles sont propres au jeu: une coopérative de la ligne qui passe commande par lettre, payée au départ du train de chaque samedi, une commande composée selon ce que le duo sait déjà produire, qui grandit après une réussite et rapetisse sans le dire après deux échecs; Basile qui replante les sapins et les chênes qui rejettent de souche; la brume qu'on n'a qu'au lendemain d'une pluie; une étape où l'on décide à deux de rester. Pas de caisse d'expédition à vider chaque soir, pas de prix du jour, pas de musée: rien qui rapproche des jeux de référence du client.

## Notes proposées

| Pilier | Grille | Proposée | Justification |
|---|---|---|---|
| 1. Ressenti | 7,5 | **7,5** | Rien de neuf dans la marche ni la caméra. Les gestes nouveaux reprennent les verbes existants (ramasser, frapper), et le refus de la hache est bien rendu (tremblement, coup mat, texte). Mais une cueillette qu'on voit mal se ramasse mal (réserve 4). Non joué au clavier. |
| 5. Interface | 7,5 | **8** | Écran d'étape exemplaire: choix de l'autre affiché, consigne claire, focus par défaut, lisible à 100 et 150 % chez les deux; carte de saison, saison sous la date, « brume au lever ». M-26 et M-27 sont branchés (réserves 1 et 2 du tour 7 levées). Reste: la liste du courrier indistincte et un titre de carnet faux, corrigé ici. |
| 6. Contenu et rythme | 7,5 | **7,5** | Le progrès est réel et mesuré (43 journées au lieu de 15, journées neuves à 96 % et plus, redites à 0 %). Mais au sens du repère 8 (« aucun manque remarqué »), un duo remarquera l'argent inutile et l'absence de but après le jour 15. 8 quand ces deux manques sont comblés et mesurés par le robot. |
| 7. Coopération | 8 | **8** | La commande se partage par ressources et en donne le sujet de conversation, l'étape se décide à deux, l'envie à deux revient tous les trois jours, la brume est enfin guidée. Mais aucun geste nouveau qui demande les deux après le jour 15, et S-08 n'est toujours pas observé chez le client. |

Moyenne des huit piliers: 7,7 au lieu de 7,6 si les autres notes ne bougent pas (le seul changement est l'interface, 7,5 à 8).

## À quelle distance des 100 heures

| Repère | Aujourd'hui | Objectif |
|---|---|---|
| Durée jouable | environ 5,5 h: 43 journées d'environ 8 min (2 h pour la démo, 3,7 h de plus ce tour) | 99,9 h (372 journées) |
| Dont vraiment neuves | les jours 16 à 43 tiennent R1 et R2; leur intérêt baisse après le jour 30, quand l'argent n'a plus d'usage | 95 % de journées neuves sur toute la durée |
| Au-delà du jour 43 | rien: journées neuves à 52 % au plus bas sur les jours 16 à 84, envies neuves à 17 % en automne et 0 % en hiver, 1 moment différent en hiver | contenu d'automne et d'hiver, puis années suivantes |
| Systèmes du J1 (plan, section 5) | saisons, météo, commande générée, repousse et robot faits; petites annonces, fête, Lucie, inauguration non faits | 8 sur 8 |
| Moments | 9 (8 d'ambiance); 6 possibles en été | au moins 12, puis 2 neufs par saison et par année |

En bref: ce tour a fait ce qu'aucun tour précédent n'avait fait, il a ajouté des heures réelles (de 2 à 5,5). Le rythme utile est maintenant connu: chaque saison de contenu complète (répliques, envies, cueillettes, deux moments) ajoute environ 2,8 heures à 0,35 s par minute, ou 5,5 heures si le client choisit 0,8 s après le jour 23 (D1). À ce compte, il faut une dizaine de saisons de contenu, plus J1 et ses fêtes, pour approcher les 100 heures.

## Les trois priorités du tour 9

### 1. Des buts et un usage de l'argent après le jour 15 (piliers 6 et 7; sans décision du client)

- Petites annonces au tableau du quai (système n° 4 du plan, L4): une ou deux par semaine, tirées par `unitDraw`, qui demandent un coup de main à un habitant (livrer, réparer, cueillir), payées en sous ou en objets; une sur deux se fait mieux à deux.
- Catalogue renouvelé chaque semaine: deux ou trois objets de décoration ou de confort nouveaux par semaine, de saison, pour que la commande ait une récompense visible dans la maison.
- Correctif de la truite d'été (coût par saison) et lecture des quantités du potager (réserve 5).
- Mesure ajoutée au robot: au moins un but nouveau par semaine dans le carnet; part de la bourse dépensée par semaine.

### 2. L'automne entier, jusqu'au jour 63 (pilier 6; sans décision du client)

- `clock.lastDay` porté au samedi 64 à 16 h, une étape `autumn_end`; 8 répliques d'automne par habitant, 10 envies d'automne, cueillettes et horaires d'automne.
- Les étoiles de l'Aubrune et le salut du mécanicien (été, jours du train), plus deux moments d'automne: O-06 et O-07 tenus jusqu'au jour 63.
- État borné (correctif `565439e`, I-06), `groundItems` compris: le robot longue vie le prouve de nouveau sur 84 jours.

### 3. Voir et lire ce qui pousse (piliers 1, 3 et 5)

- Mûres et noisettes lisibles au zoom de départ, posées au pied de leur buisson (directeur artistique, artiste 3D), capture au zoom 1 dans les quatre orientations.
- Liste du courrier qui montre le titre de chaque lettre; carnet qui ne garde que les dernières commandes faites.
- Une séance chez le client entre les jours 15 et 22, pour observer S-08 et T8-30 (« la Halte change toute seule »), avant d'écrire J1.

## Non vérifié

- Je n'ai pas joué au clavier ni lancé deux instances: le ressenti de la cueillette, du refus de la hache et de l'écran d'étape à deux n'est jugé que sur les données, le code, les tests et les captures.
- Le son (cueillettes, carte de saison, brume) n'est pas écouté: aucune sortie audio ici.
- Je n'ai pas relancé le robot longue vie (36 minutes): ses chiffres viennent du rapport du QA à `97f9dd5`.
- L'estimation de 8 minutes par journée vient des repères du plan et des tours précédents, pas d'une mesure sur ce code.
