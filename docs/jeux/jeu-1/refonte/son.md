# La Petite Ligne (refonte): document sonore, jalon 1

| Champ | Valeur |
|---|---|
| Statut | lot L9 (moteur, babil, sons de base, ambiances jour et nuit) et lot musique d'Aubrune (10 morceaux, 7 jingles, régie par table); reste à livrer: sons de pêche, de cuisine et de déco, cloche de Marthe, passage à niveau, deux coups du 5 h 12 |
| Rédaction | sound-designer, 2026-11-10 |
| Fichiers | sons: `games/la-petite-ligne-2/assets/commun/son/`; sources: `games/la-petite-ligne-2/assets-src/son/`; tables et moteur: `games/la-petite-ligne-2/src/audio/` (README) |

## Principes

- Un son à chaque geste, en moins d'un dixième de seconde (références de ressenti, section 3): les sons de geste durent de 0,07 à 0,4 s et partent à l'événement.
- Couleur: bois, tissu, papier, eau, clochettes en sol majeur (tout ce qui tinte reste dans l'accord de sol). Aucun son inquiétant à Aubrune.
- Les actions de l'autre joueur s'entendent, placées et 3 dB plus bas; les retours privés (refus, argent, besoins, sac plein) ne s'entendent que chez leur joueur.
- Niveaux de fichier: effets et notes de babil à -16 LUFS momentanés (les sons percussifs courts sont limités par la crête, à -1,2 dBFS au plus), boucles à -16 LUFS intégrés. Le niveau de jeu se règle en dB dans `donnees/sons.json`. Mesures: `assets-src/son/mesures.csv`.

## Événements

| Événement | Son | Niveau (dB) | Priorité | Variations | Qui l'entend |
|---|---|---|---|---|---|
| pas sur l'herbe, la terre, le pavé (un par foulée de 0,85 m) | `pas-herbe`, `pas-terre`, `pas-pave` | -14, -13, -9 | 3 | 3 variantes, hauteur 5 à 6 %, niveau 1,5 dB | les deux, l'autre placé |
| cible visée qui change | `cible` | -10 | 3 | hauteur 2 % | soi |
| geste réussi (général) | `reussite` | -8 | 2 | niveau 0,5 dB | les deux |
| geste réussi, ramasser | `ramasser` | -8 | 2 | hauteur 5 % | les deux |
| refus | `refus` | -8 | 2 | hauteur 3 % | soi |
| s'asseoir | `asseoir` | -9 | 3 | hauteur 5 % | les deux |
| poser (signal de l'interface `poser`) | `poser` | -9 | 2 | hauteur 5 % | soi |
| ouvrir un rangement | `rangement-ouvre` | -8 | 2 | hauteur 4 % | les deux |
| fermer un rangement (signal `rangement-ferme`) | `rangement-ferme` | -8 | 2 | hauteur 4 % | soi |
| sac plein, outil émoussé | `sac-plein`, `refus` | -8 | 2 | | soi |
| gain ou dépense d'argent | `monnaie` | -11 | 2 | niveau 0,5 dB | soi |
| ouvrir, fermer le carnet (signaux) | `carnet-ouvre`, `carnet-ferme` | -9 | 2 | hauteur 3 % | soi |
| page de dialogue | `page` | -10 | 3 | hauteur 6 % | soi |
| choix (signal `choix`) | `choix` | -6 | 3 | aucune | soi |
| palier de besoin bas ou bloqué, bonus, repas à deux | `palier-bas`, `palier-bonus` | -11 | 2 | aucune (tintements accordés) | soi |
| eau de la pompe (geste de lavage) | `eau-pompe` | -10 | 3 | hauteur 3 % | les deux |
| réveil du matin (les deux ont dormi) | `reveil` | -10 | 1 | aucune | les deux |
| montée à bord | `embarquement` | -9 | 1 | aucune | les deux |
| train qui arrive | `train-arrive` | -8 | 1 | aucune | les deux |
| trajet (phase de voyage) | `ambiances/trajet` (boucle 8 s) | -16 | | | les deux |

## Babil

Une note par lettre annoncée par l'interface (toutes les trois lettres, réglage de l'interface), sur un timbre d'instrument: voyelle plus longue, consonne plus brève, `?` monte, `.` retombe, `!` appuie. Même caractère, même degré de la gamme: la voix se reconnaît d'une phrase à l'autre.

| Voix (champ `voice` de la fiche) | Timbre | Tonique | Caractère |
|---|---|---|---|
| `medium` | clarinette | mi 4 | neutre, pentatonique majeure |
| `low` | basson | ré 3 | posé, gamme mineure |
| `grumpy` | basson | si 2 | lent, demi-ton grinçant |
| `high` | flûte | do 5 | vif |
| `shy` | flûte | mi 5 | court et retenu |
| `bright` | boîte à musique | sol 5 | clair |
| `soft` | ocarina | la 4 | rond, lent |
| `bouncy` | marimba | sol 4 | sautillant, large étendue |

## Ambiances

`jour` (vent, feuillage, oiseaux, 32 s) et `nuit` (vent grave, grillons, 32 s) en boucle, fondues à puissance constante selon l'heure (aube 5 h 30 à 7 h 30, soir 19 h à 21 h, fondu de 3 s); `trajet` (rails, 8 s) remplace les deux pendant le voyage. Niveaux de couche: -22 dB (jour, nuit), -16 dB (trajet).

## Musique (lot musique, 2026-11-10)

Réponse 72 du client: « un air différent selon l'heure et la météo, et selon les lieux ». Direction: maquette de train miniature, douceur (bible artistique 1), petite formation acoustique (accordéon, guitare nylon, clarinette, piano, contrebasse, glockenspiel, brosses), jamais d'accord tendu: Aubrune ne fait pas peur, même au 5 h 12. On garde l'esprit de l'ancien jeu (acoustique, sol majeur, boucles propres, repos de la musique), pas ses morceaux: le fil est un **motif du quai** nouveau, ré, sol, si, la, sol (une quarte, une tierce, un pas qui redescend, un repos). Tout le détail technique est dans `src/audio/musique/README.md`.

### Le système

- **Une table de données** (`src/audio/musique/donnees/musique.json`): des règles « contexte vers morceau » (lieu, zone, tranche horaire, météo, saison, phase de voyage, scène en cours, événement du calendrier; première règle qui convient), des **couches** qui s'appliquent ensemble (pluie ou brume: passe-bas à 4,2 kHz, air 3 dB plus bas, ensemble 1,5 dB plus bas; orage: passe-bas à 3 kHz; nuit: air 6 dB plus bas, passe-bas à 5,5 kHz; hiver: un peu plus doux), des rythmes de silence, des jingles. Ajouter un morceau ou une règle = des lignes de données.
- **Fondus**: enchaîné de 6 s entre deux morceaux (les deux tiges changent ensemble), 4 s vers un silence ou depuis un silence; niveaux de tige et passe-bas se déplacent en 2 à 4 s (pas de saut quand la pluie tombe).
- **Silences voulus**: après 150 à 240 s de musique (90 à 150 s la nuit et au 5 h 12), 50 à 100 s de calme (90 à 170 s la nuit) où seule l'ambiance reste. Pas de silence pendant le voyage ni les scènes.
- **Thème d'arrivée**: un lieu qu'on atteint (ou la partie qui commence) joue son thème court de 5,8 s, la musique attend 5 s.
- **Jingles**: la musique recule de 5 à 10 dB pendant le jingle et revient doucement. L'autre joueur entend les jingles « les deux » 3 dB plus bas; le repas partagé ne s'entend que chez son joueur.
- **Réglage du joueur**: volume de la musique séparé (`setSettings({ music })`, défaut 0,8, clé `la-petite-ligne-2.musique`) et coupure; la musique sort sur le bus `music` du SDK, sous les effets (niveau de jeu -6 dB).

### Morceaux (60 à 90 s, boucle sans couture, deux tiges `fond` et `air`)

| Morceau | Quand | Mesure, tempo | Durée | Tonalité (centre) | Instruments |
|---|---|---|---|---|---|
| `bourg-aube` | 5 h à 8 h | 4/4, 60 | 64 s | sol | piano en arpèges, glockenspiel, contrebasse à l'archet, clarinette dans la seconde moitié |
| `bourg-matin` | 8 h à 12 h 30 | 4/4, 96 | 80 s | sol | guitare, contrebasse, accordéon puis clarinette au motif, piano et glockenspiel à la reprise |
| `bourg-apres-midi` | 12 h 30 à 18 h | 6/8, 90 | 64 s | sol | clarinette puis accordéon, guitare, contrebasse, piano, glockenspiel |
| `bourg-soir` | 18 h à 21 h | 4/4, 80 | 72 s | mi (mode relatif: le motif décalé d'un degré) | accordéon lent, guitare, contrebasse, clarinette en tierce, éclats de glockenspiel |
| `bourg-nuit` | 21 h à 5 h | 4/4, 60 | 64 s | sol | piano seul (le début de chaque phrase du motif), contrebasse à l'archet, un éclat de verre de loin en loin |
| `bourg-pluie` | pluie, orage, neige, de jour | 4/4, 80 | 72 s | sol | piano doux, gouttes de glockenspiel, contrebasse à l'archet, clarinette lointaine |
| `riviere` | zone `riviere` d'Aubrune | 6/8, 72 | 70 s | ré mixolydien (mélodie une quarte plus bas) | guitare qui coule, piano en ruisseau aigu, clarinette, glockenspiel |
| `train` | embarquement, voyage, visiteur du samedi | 4/4, 120 | 64 s | sol | brosses en balancement, contrebasse qui marche, guitare, accordéon puis clarinette |
| `mystere` | 4 h 45 à 5 h 30, scène `sonnerie` | 4/4, 60 | 60 s | mi mineur | quelques notes de piano séparées de silences, contrebasse à l'archet, éclats de verre |
| `fete` | événement de fête | 3/4, 108 | 80 s | sol | valse: contrebasse, guitare, accordéon, clarinette, piano, glockenspiel |

**Tonalités compatibles.** Les dix morceaux et les sept jingles n'emploient que les sept notes de sol majeur (sol, la, si, do, ré, mi, fa dièse), vérifié sur les fichiers MIDI par `verifier_ecriture.py`. Les centres sont des degrés de la même gamme (sol, mi, ré): n'importe quel fondu enchaîné se fait sur des notes communes, sans frottement, et les jingles, écrits sur sol, s'accordent à tous. Les tempos diffèrent (60 à 120): sur 6 s de fondu, ce sont deux mouvements qui se croisent, jamais une dissonance. Les ambiances et les motifs d'habitants (sol majeur) restent justes aussi.

### Jingles (2 à 4 s, plus le thème d'arrivée de 5,8 s)

| Jingle | Événement | Son | Durée |
|---|---|---|---|
| `prise-nouvelle` | `collection_found` avec `first` (les deux, l'autre plus bas) | arpège de glockenspiel qui monte (ré, sol, si, ré) sur un accord de guitare et d'accordéon | 2,7 s |
| `etape-quete` | `quest_step_done` (les deux) | la quarte du motif, clarinette et verre | 2,0 s |
| `quete-terminee` | `quest_done` (les deux) | le motif complet posé sur sol | 4,2 s |
| `reveil` | `day_started` quand les deux ont dormi | arpège de guitare qui monte, clarinette, éclat de verre | 4,0 s |
| `repas-partage` | `meal_shared` (soi seulement) | trois notes d'accordéon en valse, basse qui rebondit | 3,8 s |
| `collection-complete` | `collection_completed` (les deux) | cascade pentatonique de glockenspiel, accord de sol qui s'ouvre | 3,6 s |
| `arrivee-aubrune` | arrivée dans le lieu (`arrivals`) | le début du motif du quai, accordéon et guitare | 5,8 s |

### Niveaux et poids (mesurés, `assets-src/son/musique/mesures.csv`)

- Chaque morceau, tiges additionnées, mesuré par `ebur128` de ffmpeg sur les fichiers décodés: -16,0 à -16,5 LUFS intégrés (cible -16, tolérance 0,7), crêtes vraies de -1,6 à -5,1 dBTP (plafond -1); le rendu corrige son écart avec la mesure de ffmpeg (trois passes). Chaque tige est 1 à 7 dB sous le morceau (mesure ci-dessus) pour que leur somme retombe à -16.
- Poids: 6,4 Mo pour les 17 fichiers de jeu (cible 12 Mo), Opus mono 36 kbit/s. Mémoire: décodés à 24 kHz, un morceau de 70 s pèse 13 Mo (deux tiges); un morceau résident en plus de celui qui joue: 27 Mo en régime, 40 Mo au pire pendant un fondu (à confirmer contre le plafond de 64 Mo de l'architecture avec le reste du son).
- Niveau de jeu: musique -6 dB (donc environ -22 LUFS au niveau 1), ambiance -22 dB, jingles -3 à -4 dB (musique reculée de 5 à 10 dB).
