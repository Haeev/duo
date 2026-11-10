# La Petite Ligne (refonte): document sonore, jalon 1

| Champ | Valeur |
|---|---|
| Statut | première livraison (lot L9): moteur, babil, sons de base, ambiances jour et nuit; pas de musique |
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

## Restes à livrer (jalons suivants)

Musiques par lieu, météo (pluie), repas spécial, cloche de Marthe et sonnerie du passage à niveau, deux coups du 5 h 12, jingle de prise nouvelle, sons de pêche, de cuisine et de déco.
