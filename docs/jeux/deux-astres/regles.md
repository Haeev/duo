# Deux Astres: règles de base

| Champ | Valeur |
|---|---|
| Identifiant | `deux-astres` (titre de travail) |
| Statut | référence pour la production, fixée par le manager le 2026-10-30 |
| Version | 1.0 |

> Ce document est la source unique des règles. La simulation du jeu (TypeScript), le solveur du level designer et les niveaux doivent s'y conformer à l'identique. Toute modification passe par le manager, qui prévient tous les membres concernés. Le cahier des charges (`cahier-des-charges.md`) l'habille: histoire, textes, progression, ressenti, interface.

## 1. Intention

Deux petites étoiles sont tombées sur les îles flottantes du ciel nocturne. Pour remonter, elles doivent rallumer le phare de chaque île en résolvant des énigmes ensemble. Puzzle coopératif à deux, en 3D low poly vue de dessus en biais (isométrique), sans violence, sans chrono, sans perte: on réfléchit, on se parle, on essaie, on annule.

- Joueur 1: l'astre **aqua** (cercle plein). Joueur 2: l'astre **mauve** (croissant). Couleurs de l'identité « Étoile double ».
- Chaque joueur dirige son astre sur sa machine; les deux voient le même plateau.

## 2. Plateau

- Grille rectangulaire de `largeur` x `hauteur` cases. Coordonnées `(x, y)`: x croît vers l'est, y croît vers le sud, origine en haut à gauche dans les données.
- Directions: nord `(0, -1)`, sud `(0, 1)`, ouest `(-1, 0)`, est `(1, 0)`.

### 2.1 Terrain (couche fixe)

| Caractère | Nom | Règle |
|---|---|---|
| `#` | rocher | infranchissable pour tout |
| `.` | sol | franchissable |
| ` ` (espace) | vide | infranchissable pour les astres; un bloc (caisse ou pierre) poussé dans un vide y tombe et le comble: la case devient du sol et le bloc disparaît |
| `a` | voile aqua | seul l'astre aqua le traverse; bloque l'astre mauve et les blocs |
| `m` | voile mauve | seul l'astre mauve le traverse; bloque l'astre aqua et les blocs |

### 2.2 Entités (couche mobile ou marqueurs)

| Type | Règle |
|---|---|
| `star` (joueur 1 ou 2) | occupe une case; deux astres ne partagent jamais une case; un astre ne pousse jamais l'autre astre |
| `goal` (joueur 1 ou 2) | marqueur posé sur du sol, sans effet de blocage; compte quand l'astre de sa couleur s'y trouve |
| `crate` (caisse) | bloc poussable par un seul astre |
| `heavy` (pierre lourde) | bloc poussable seulement par une poussée à deux (section 3.3) |
| `plate` (dalle, `id`) | marqueur posé sur du sol; pressée tant qu'un astre ou un bloc s'y trouve |
| `door` (porte, `link`) | sur du sol; ouverte tant que toutes les dalles de même `id` que son `link` sont pressées; fermée, elle bloque tout |

Une case « libre pour un bloc » est une case de sol (ou de vide, qui sera comblé) sans rocher, sans voile, sans autre bloc, sans astre et sans porte fermée. Les marqueurs `goal` et `plate` n'empêchent rien.

## 3. Coups

Le jeu se décompose en **coups**. Un coup est le déplacement d'un astre d'une case, avec éventuellement la poussée d'un bloc. Une poussée à deux est un coup qui déplace les deux astres.

### 3.1 Déplacement simple

Un astre demande une direction. La case visée doit être: dans le plateau, ni rocher, ni vide, ni voile de l'autre couleur, ni porte fermée, ni occupée par l'autre astre. Si elle contient un bloc, c'est une poussée.

### 3.2 Poussée d'une caisse

L'astre avance vers une case qui contient une caisse. La caisse avance d'une case dans la même direction si la case suivante est libre pour un bloc (section 2.2). Si la case suivante est un vide, la caisse le comble. Sinon, rien ne bouge (le coup échoue, sans compter). On ne pousse jamais deux blocs alignés.

### 3.3 Poussée à deux d'une pierre lourde

La pierre avance d'une case si, dans le même coup: l'astre A est juste derrière la pierre, l'astre B est juste derrière A, les deux demandent la même direction, et la case suivante de la pierre est libre pour un bloc (ou un vide, comblé). Alors la pierre, A et B avancent tous les trois d'une case. Seul, un astre ne déplace pas une pierre (le coup échoue, sans compter, avec un retour « trop lourd »).

### 3.4 Portes

- Après chaque coup, chaque porte s'ouvre si toutes ses dalles sont pressées, et se ferme sinon.
- Une porte ne se ferme jamais sur une case occupée: elle reste ouverte jusqu'à ce que la case se libère, puis se ferme si ses dalles ne sont plus toutes pressées.

### 3.5 Victoire

Le niveau est réussi dès que, après un coup, chaque astre se trouve sur le `goal` de sa couleur.

## 4. Temps réel

- La simulation tourne chez l'hôte à pas fixe de 60 Hz.
- Un déplacement dure 9 pas (150 ms). Pendant ce temps, l'astre ne peut pas commencer un autre coup. Une direction demandée pendant un déplacement est mémorisée (une seule) et jouée à la fin. Maintenir une touche répète le déplacement.
- Poussée à deux: quand l'astre A tente de pousser une pierre avec B correctement placé derrière lui, la tentative attend jusqu'à 12 pas (200 ms) que B demande la même direction. Si B la demande à temps, la poussée à deux a lieu; sinon, le coup de A échoue (« trop lourd »). La même fenêtre vaut si B appuie le premier.
- Deux coups simultanés des deux astres (même pas de simulation) sont résolus dans l'ordre: astre aqua, puis astre mauve.

## 5. Annuler et recommencer

- **Annuler** (touche E): annule le dernier coup du duo, quel que soit l'astre qui l'a joué. Historique illimité dans le niveau.
- **Recommencer** (touche R): l'un le demande, l'autre confirme en appuyant aussi sur R dans les 3 secondes; sinon, la demande s'efface.

## 6. Comptage et étoiles

- **Coups**: chaque astre qui bouge compte un coup (une poussée à deux en compte donc deux). Les coups annulés sont retirés du compte.
- **Par**: le nombre minimal de coups, calculé par le solveur du level designer.
- **Étoiles du niveau**: 1 si réussi; 2 si coups inférieurs ou égaux à `ceil(1,5 x par)`; 3 si coups inférieurs ou égaux au par. On garde la meilleure note obtenue.

## 7. Commandes (clavier AZERTY)

Touches lues par position (`KeyboardEvent.code`), libellés affichés selon le clavier réel.

| Action | Touches (code) | Libellé AZERTY |
|---|---|---|
| Avancer vers le nord, l'ouest, le sud, l'est | `KeyW`, `KeyA`, `KeyS`, `KeyD`, ou les flèches | Z, Q, S, D |
| Annuler | `KeyE` | E |
| Recommencer (à confirmer par l'autre) | `KeyR` | R |
| Faire signe (petite impulsion de lumière et son, visibles des deux) | `Space` | Espace |
| Pause | `Escape` | Échap |

Le sens visuel des directions en vue isométrique est décidé par le développeur et l'UX pour que Z « monte » à l'écran de façon naturelle; il ne change pas les règles.

## 8. Progression

- 4 îles de 6 niveaux, puis 1 niveau final: 25 niveaux.
  1. Île 1: déplacements, caisses, cases d'arrivée, vides comblés.
  2. Île 2: voiles aqua et mauve.
  3. Île 3: dalles et portes.
  4. Île 4: pierres lourdes (poussée à deux).
  5. Final: tout combiné.
- Dans une île, chaque niveau se débloque quand le précédent est réussi. L'île suivante se débloque quand 4 niveaux de l'île en cours sont réussis. Le final se débloque quand les 4 îles ont chacune 4 niveaux réussis.

## 9. Format des niveaux

Un fichier JSON par niveau: `games/deux-astres/niveaux/<ile>-<numero>.json` (par exemple `1-3.json`, `final.json`).

```json
{
  "id": "1-3",
  "nom": "Le petit pont",
  "ile": 1,
  "taille": [7, 5],
  "terrain": [
    "#######",
    "#..  .#",
    "#..  .#",
    "#.....#",
    "#######"
  ],
  "entites": [
    { "type": "star", "joueur": 1, "en": [1, 1] },
    { "type": "star", "joueur": 2, "en": [1, 3] },
    { "type": "goal", "joueur": 1, "en": [5, 1] },
    { "type": "goal", "joueur": 2, "en": [5, 3] },
    { "type": "crate", "en": [2, 1] },
    { "type": "heavy", "en": [3, 3] },
    { "type": "plate", "id": "A", "en": [2, 3] },
    { "type": "door", "lien": "A", "en": [5, 2] }
  ],
  "par": 9,
  "solution": ["1E", "1E", "2E", "..."],
  "indice": "Une caisse dans un trou, ça fait un pont."
}
```

- `terrain`: `hauteur` chaînes de `largeur` caractères (section 2.1). Les entités se posent sur du sol.
- `solution`: une solution optimale en coups: `"<joueur><direction>"` avec la direction parmi `N`, `S`, `O`, `E` (par exemple `"2O"`); une poussée à deux s'écrit `"DN"`, `"DS"`, `"DO"` ou `"DE"` (les deux astres dans la même direction, comptée deux coups).
- Le jeu vérifie au chargement, en test automatique, que chaque `solution` rejouée par sa simulation mène à la victoire en exactement `par` coups.

## 10. Données pour la plateforme

- **Sauvegarde du duo** (un emplacement par monde, trois emplacements): niveaux réussis, meilleure note et meilleur nombre de coups par niveau, temps de jeu total. Sauvegarde automatique à chaque niveau réussi et en quittant.
- **Historique**: une séance par partie lancée: durée hors pauses, niveaux réussis pendant la séance, étoiles gagnées.
- **Score cumulé**: progression commune, en étoiles sur 75.
