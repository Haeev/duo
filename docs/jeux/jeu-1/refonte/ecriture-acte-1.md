# Écriture jouable: prologue « Terminus » et acte 1 d'Aubrune « Logement fourni »

Auteur: game-designer, 2026-11-10. Source: cahier des charges 0.2, sections 1.5, 4.4, 4.9, 4.10, 6.1 à 6.4. Tout est en fiches de données (aucune ligne de moteur); contrôle: `tests/acte-1-aubrune.test.ts`.

## 1. Où sont les fiches

| Dossier | Contenu |
|---|---|
| `donnees/lieux/train-de-nuit/` | lieu et carte du wagon (compartiment, couloir, porte, chariot), le Contrôleur, 3 dialogues, 3 scènes, la suite `terminus` |
| `donnees/lieux/aubrune/` | lieu, carte (produite par `outils/plan-vers-lieu.ts` depuis `carte-aubrune/plan.json`, plus 10 objets provisoires), 10 habitants, 53 dialogues, 4 scènes, la suite `le-train-de-5h12` (acte 1) |
| `donnees/commun/objets/` | `oeuf`, `sandwich`, `billet-poinconne` |
| `donnees/commun/meubles/` | `banquette` (dormir dans le train; modèle provisoire: celui du banc) |

## 2. Le déroulé

Prologue (suite `terminus`, lieu `train-de-nuit`, départ prévu à 21 h 30):

| Étape | Ligne du carnet | Ce qui la franchit | Apprend |
|---|---|---|---|
| papiers | Montre tes papiers au Contrôleur, dans le couloir. | dialogue `controleur-papiers` jusqu'à `fin` (chacun le sien, `once: player`) | marcher, parler; **éditeur de personnage au nœud `photo`** |
| chariot | Le chariot passe au bout du couloir: demande un sandwich. | `controleur-chariot`, nœud `servi` | caméra (le couloir tourne), choix |
| manger | Mange ton sandwich avant qu'il refroidisse encore. | faim d'un joueur à 85 ou plus | manger, la jauge paraît puis s'efface |
| dormir | Retourne au compartiment et allonge-toi sur une banquette. | sommeil d'un joueur à 80 ou plus (banquette: réveil à 85) | dormir (saut de nuit à deux, réveil à 6 h) |
| descendre | Retrouve ta moitié devant la porte du wagon, et descendez. | les deux à la porte, ensemble | puis « Descendre » (intention `board` vers Aubrune) |

Acte 1 (suite `le-train-de-5h12`, chapitre `logement-fourni`, ouverte à l'arrivée):

| Étape | Après | Ce qui la franchit | Effets |
|---|---|---|---|
| quai | | scène `firmin-en-pantoufles` vue | |
| lettre | quai | `firmin-lettre` jusqu'à `fin` (Firmin empoche la lettre) | |
| maison | lettre | un joueur à 6 m de la maison (`hd`) | scène `la-maison-en-ruine` |
| pension | maison | `odette-pension` jusqu'à `fin` (« Vous sentez le wagon. ») | |
| pompe | pension | hygiène d'un joueur à 59 ou plus (la pompe plafonne à 60) | |
| souper | pompe | `odette-souper`: deux soupes, une pour ta moitié | |
| nuit-pension | souper | sommeil d'un joueur à 95 ou plus | |
| outils | nuit-pension | `basile-outils`: hache et bêche prêtées (chacun les siennes) | |
| debroussailler | outils | 2 mûres dans un sac (les ronces devant la maison en donnent 2 ou 3) | |
| besaces | outils | `solange-besaces`: une besace chacun | |
| abattre | besaces | remettre 6 bûches à Basile (deux chênes de la lisière, 3 ou 4 chacun) | 8 planches |
| toit | abattre, debroussailler | **ensemble**, remettre les 8 planches à Basile, qui attend à la maison | scène asymétrique `le-toit` |
| graines | debroussailler | `odette-graines`: 6 graines de radis | |
| potager | graines | un joueur au potager (`jd`) | |
| poules | potager | `odette-poules`: Pimprenelle et Capucine, 6 œufs | |
| vente-odette | poules | vendre 3 œufs à Odette (0,60 € pièce) | Odette lâche le nom d'Achille |
| vente-achille | vente-odette | vendre 3 œufs à Achille (1 € pièce) | |
| premiere-nuit | toit, besaces, vente-achille | scène `la-sonnerie-de-5h12` vue (déclencheur à 312, une fois) | |
| reponse | premiere-nuit | `firmin-matin` jusqu'à `fin`; Jeanne a noté l'heure (`jeanne-heure`) | fait `aubrune.acte1.fini` |

Chaque étape écrit `aubrune.acte1.<étape>` (« ouvert » à l'ouverture, « fait » au passage): les dialogues d'histoire et les souvenirs des habitants s'y accrochent. Pourquoi les besaces avant les chênes: sans besace, la barre de 5 cases (billet, outils, soupe) ne loge pas six bûches.

## 3. Les habitants

Pour chacun des dix: une fiche (caractère, voix du lot son, apparence composée du catalogue, vie simple: chez soi la nuit, à son poste le jour, goûts pour les cadeaux), puis quatre sortes de dialogues:

- `<habitant>-quotidien` (priorité 0): un bonjour parmi 6, en tournante (le fait `aubrune.tour.<habitant>` avance à chaque conversation: jamais deux fois le même d'affilée, le même au plus une conversation sur six), puis une réplique selon l'heure (matin, après-midi, soir, nuit).
- `<habitant>-hygiene` (priorité 90): sous 21 d'hygiène, l'habitant ne dit que sa remarque. Les étapes de dialogue attendent donc un passage à la pompe.
- `<habitant>-souvenir-<sujet>` (priorité 30, une fois par joueur): deux souvenirs de ce que les joueurs ont fait (toit, ventes, ronces, besace, poules, lettre, sonnerie).
- Dialogues d'histoire (priorité 60) tant que l'étape est ouverte.

Voix (`src/audio/donnees/voix.json`): Firmin `low` (basson), Odette et Solange `bouncy`, Basile `grumpy`, Achille `soft`, Mado et Marthe `medium`, Ambroise `shy`, Honorine `bright` (boîte à musique), Jeanne `high` (flûte, au plus près du pipeau), le Contrôleur `shy`.

## 4. Attaches pour les autres lots

- **Éditeur de personnage** (interface): l'ouvrir chez un joueur quand son dialogue `controleur-papiers` affiche le nœud `photo`; le fermer fait avancer (`talk_next`).
- **Départ du jeu** (`reglages.json`, lot L0): `start.place` = `train-de-nuit`, `start.minute` = 1290. Laissé tel quel pour ne pas casser les tests des lieux d'essai; le test de l'acte 1 le fait par retouche.
- **Babil**: les voix ci-dessus existent toutes dans `voix.json`.

## 5. Ce que le moteur ne permet pas encore (le texte l'attend)

1. **Condition de météo** (`weather_is`) et **jour de la semaine** dans les dialogues: les répliques de pluie et de brume sont écrites (section 7) mais pas branchées.
2. **Tirage « la moins récente »** des répliques: la tournante par fait le remplace; elle avance à chaque conversation, pas à chaque jour.
3. **Changer de lieu par un effet** (`travel_to`, sans quai ni horaire): le prologue finit par une vraie descente du train; donc le trajet coûte 2 h (arrivée vers 8 h, au lieu du réveil à l'aube sur le banc) et Aubrune doit desservir `train-de-nuit` en retour (lien obligatoire dans les deux sens). Il faut un lien à sens unique ou un lieu « fermé ».
4. **Réveil à l'heure d'une scène**: dormir saute jusqu'à 6 h; la sonnerie se joue alors à 6 h (retard permis de 60 min), pas « en sursaut » à 5 h 12.
5. **Conditions sur les gestes**: « case bêchée ou semée » (le potager passe par la présence au potager), « a mangé », « a dormi cette nuit » (passent par les jauges, fragiles si l'on joue très vite ou très lentement).
6. **Mini-jeu du marteau**: le toit est une scène asymétrique sans geste.
7. **Poules et poulailler**: les poules sont un fait (`aubrune.poules.nombre`) et Odette donne les 6 premiers œufs; pas de ponte quotidienne.
8. **Vente par le commerce**: les ventes d'œufs passent par des options de dialogue (prix écrits dans l'option), pas par l'écran de boutique avec mémoire des prix.
9. **Intérieurs**: la pension et la maison n'ont pas encore d'intérieur; leurs lits sont posés provisoirement dehors (section 6).
10. **Accord de « vous »** selon les deux joueurs dans les scènes (`[[duo:f|m]]`): non utilisé, aucune réplique n'en a eu besoin.

## 6. Provisoire, à reprendre

Objets ajoutés à la carte d'Aubrune (`objects`), à reprendre par le level design; un nouveau passage de `plan-vers-lieu.ts` les efface (les remettre ou les verser dans le plan):

| Objet | Où | Pourquoi provisoire |
|---|---|---|
| banc du quai | (136; 104,5) | le banc du réveil |
| pompe de la place | (141,5; 117,5) | |
| deux chênes | lisière (129,5 et 133,5; 91,5) | |
| deux ronciers | devant la maison | |
| terre cultivable | potager (116; 124) | |
| deux lits simples | à côté de l'épicerie | **à rentrer dans la chambre de la pension** |
| un lit double | contre la maison | **à rentrer dans la première pièce** |

## 7. Répliques de météo, écrites en attente de la condition

| Habitant | Pluie | Brume |
|---|---|---|
| Firmin | La pluie ne retarde pas les trains. Surtout ceux qui ne viennent pas. | Brume. On ne voit pas la voie. Je la surveille quand même. |
| Odette | Il pleut ! Tout le monde rentre, et tout le monde passe chez moi. | La brume, ça étouffe les bruits. Pas les nouvelles. |
| Basile | Pluie. Bois mouillé. Patience. | Brume. Rien vu. Rien dit. |
| Achille | La pluie fait lever la pâte. Ou c'est moi qui le crois. | La brume, c'est de la farine qui flotte. Je m'y sens chez moi. |
| Solange | La pluie défrise tout le monde. Mes affaires reprennent. | Brume: le décor parfait pour une entrée mystérieuse. |
| Mado | Pluie sur l'enclume: ça siffle ! J'adore. | La brume entre dans la forge et ressort en vapeur. |
| Ambroise | L'humidité fait retarder les pendules. Et moi, ça me met en avance. | Brume. Les horloges s'entendent de plus loin. |
| Honorine | Il pleut ? En 1932, il a plu des grenouilles. Si, si. | Dans la brume, j'ai rencontré mon premier fiancé. Ou un poteau. |
| Marthe | Pluie. La cloche sonne plus grave. Ce n'est pas ma faute. | Brume. Je sonne quand même. Les gens savent l'heure, pas le chemin. |
| Jeanne | Je parie que je saute dans dix flaques sans me mouiller. J'en suis à deux. | La brume, c'est le meilleur temps pour les cachettes. |

## 8. Contrôles

`tests/acte-1-aubrune.test.ts` (moins de 2 s): pages de 150 caractères au plus et sans tiret long (plus de 250 textes), 6 bonjours distincts par habitant avec hygiène et souvenirs, bonjour jamais répété d'une conversation à l'autre sur 12 conversations (Honorine, Marthe, Mado), remarque d'hygiène quand on est sale, et le prologue puis l'acte 1 joués de bout en bout par la simulation (papiers, sandwich, nuit, descente, voyage, 19 étapes, sonnerie à 312, souvenirs dits une fois). Le validateur (suites sans blocage, accords) passe au chargement.

## 9. Questions pour le client (par le manager)

1. Le Contrôleur fait aussi le chariot (« article 12: polyvalence »). Recommandation: oui, un seul personnage dans le train rend le prologue plus lisible et le revoir à 5 h 12, à l'acte 3, plus fort.
2. Les poules ont des noms (Pimprenelle et Capucine). Recommandation: les garder, Honorine s'en sert pour une rancune vieille de 1987.
