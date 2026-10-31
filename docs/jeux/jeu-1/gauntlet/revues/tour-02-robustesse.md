# Gauntlet, tour 2: revue adverse du pilier 8, robustesse et performance

| Champ | Valeur |
|---|---|
| Relecteur | architecte-technique (auteur de la revue du tour 1, pas des corrections du tour 2) |
| Date | 2026-10-31, de 10 h 25 à 11 h 00 UTC |
| Version relue | `4029680` (corrections `1b3227e` et `f7b1877`, réseau de l'invité `35f245c`), aucune modification du code ni des données de ma part |
| Méthode | lecture des différences depuis `85026e7` (`src/rendu/qualite.ts`, `moteur.ts`, `reglages.ts`, `src/sauvegarde/sauvegarde.ts`, `src/reseau/hote.ts`, `invite.ts`, `tests/sauvegardes-reference.test.ts`, `tests/endurance.test.ts`), suite Vitest, typecheck et lint du jeu, deux mutations faites dans une copie hors du dépôt (`/tmp/lpl-mut/`) |

## 1. Verdict: mieux qu'avant, oui. Note: 7,5 sur 10 (6,5 au tour 1)

Trois des cinq risques du tour 1 sont traités sérieusement, avec des tests qui échouent quand on retire la correction:

| Risque du tour 1 | Fait au tour 2 | Preuve vérifiée par moi | Effet sur la note |
|---|---|---|---|
| 1. Aucun recours si le PC ne suit pas | repli automatique vers le mode léger (`qualite.ts`, logique pure), paliers dès 18 ms, retour possible une fois, inscrit au journal de la plateforme | 8 tests dans `src/rendu/qualite.test.ts` (écran à 48 ou 50 Hz, machine à 7 images par seconde, hystérésis, second repli définitif); seuils dans `RENDER_SETTINGS` | +0,75 (pas +1: voir le risque nouveau A) |
| 2 (c). Rien ne prévient avant le mur des 64 Kio | alerte à 32 Kio dans `tests/endurance.test.ts`, mesurée en octets UTF-8 comme le SDK | 27,2 à 27,5 Kio au jour 15 selon `ETAT.md`, soit 84 % de l'alerte | +0,25 |
| 3 (a). Une sauvegarde abîmée fait planter chaque relance | `restoreWorld` rejoue 100 pas sur une copie, toute exception devient `SaveError` | **mutation**: `TRIAL_STEPS = 0` fait échouer 2 tests sur 8 de `tests/sauvegardes-reference.test.ts` | +0,25 |
| 3 (d). Aucune vraie ancienne sauvegarde en test | quatre sauvegardes de référence (deux du format 1 produites par la version publiée `1e38cea`, deux du format 2), rechargées et jouées jusqu'au lendemain; le test échoue s'il manque une référence pour un format | lecture du test et du README de `tests/donnees/sauvegardes/` | +0,25 |
| Réseau de l'invité (hors de ma liste) | l'hôte rejoue la dernière commande de l'invité quand elle est en retard et la compte pour le numéro suivant; l'invité interpole sa prédiction entre deux pas | **mutation**: retirer `ack += 1` (`hote.ts` ligne 93) fait échouer « 80 ms, 20 ms de gigue, 2 % de pertes » de `tests/invite-fluidite.test.ts` | neutre (voir le risque nouveau C) |

Total: 6,5 + 1,5 = 8, moins 0,5 pour le risque nouveau B, qui transforme un défaut connu (risque 3 b) en perte de partie plus probable. **7,5.** La barre de 8 (« un joueur ne remarque aucun manque ») sera franchie quand le risque B sera fermé et qu'un essai sur le PC confirmera le repli.

## 2. Contrôles relancés

| Contrôle | Résultat |
|---|---|
| `pnpm --filter @duo/la-petite-ligne test` | 42 fichiers, **287 tests réussis** (247 au tour 1), 218 s |
| `pnpm --filter @duo/la-petite-ligne typecheck` | aucune erreur |
| `pnpm --filter @duo/la-petite-ligne lint` | aucune erreur |
| Mutation 1: `TRIAL_STEPS = 0` (`sauvegarde.ts`) | tuée: « ferait planter le premier pas sans garde-fou » et « est refusée par une SaveError » échouent |
| Mutation 2: sans `ack += 1` (`hote.ts`) | tuée: le test de gigue et de pertes de `invite-fluidite.test.ts` échoue |

## 3. Risques nouveaux introduits par le tour 2

### A. Le repli compile des programmes au pire moment, et dépasse le budget de 12 (important)

- **Constat**: `applyQuality` (`moteur.ts` lignes 498 à 520) coupe l'ombre à chaud. Three.js doit alors compiler les variantes sans ombre de chaque matériau: 11 puis 16 programmes au repli, 20 après le retour (mesuré par l'autre architecte dans `rendu.html`). Ces compilations se font de façon synchrone, à la première image après la bascule, **précisément sur la machine qui vient de se montrer trop lente**. Sur une UHD 620 sous Windows, où ANGLE traduit chaque programme en HLSL, une compilation coûte couramment de 50 à 300 ms: le repli risque un gel d'une demi-seconde à plus d'une seconde, en pleine partie, puis un autre au retour 60 s plus tard. Le budget de l'architecture (« 12 programmes au plus, tous compilés pendant le chargement », section 14.2) n'est plus tenu, et l'indicateur passe au rouge.
- **Preuve**: lecture de `moteur.ts`; commentaire de `applyQuality` et section « gauntlet tour 2: robustesse » de `ETAT.md` (11, 16 puis 20 programmes). Le temps réel de compilation ne se mesure pas ici (rendu logiciel).
- **Correction proposée**: au chargement, après le `compileAsync` actuel (`moteur.ts` ligne 377), couper l'ombre, relancer `compileAsync`, puis la remettre: les deux jeux de programmes sont prêts avant `duo.ready()`, en parallèle si `KHR_parallel_shader_compile` est là (c'est le cas de Chrome sous Windows). Coût: quelques programmes de plus en mémoire, aucun gel en partie. Libérer aussi la carte d'ombre au repli (`sun.shadow.map?.dispose()`), qui garde jusqu'à 16 Mo de mémoire vidéo pour rien. Réviser le budget de 12 programmes en « 12 visibles à la fois » dans l'architecture si la mesure sur le PC le permet.
- **Effort**: 45 minutes, plus 15 minutes de mesure dans `rendu.html?adaptatif=1` (nombre de tâches longues après la bascule).
- **Gain attendu**: +0,25.

### B. Le garde-fou des sauvegardes rend la nouvelle partie silencieuse plus probable (bloquant pour la suite)

- **Constat**: le risque 3 (b) du tour 1 reste ouvert, et le tour 2 l'aggrave. Avant, une sauvegarde abîmée en profondeur faisait planter la partie, mais restait intacte sur le disque. Maintenant `restoreWorld` la refuse proprement, et `session.ts` (lignes 133 à 139) **démarre une nouvelle partie sans rien dire**; la sauvegarde automatique l'écrase 5 minutes plus tard, puis à chaque aube. Les copies de secours de la plateforme gardent les trois révisions précédentes: après une vingtaine de minutes de jeu sur la nouvelle partie, la bonne sauvegarde n'est plus récupérable par ce chemin. Pour un duo qui joue des semaines, c'est la pire panne: tout perdre sans comprendre. Le garde-fou rejette aussi tout ce qui lève une exception dans les 100 premiers pas, y compris un bug du jeu qui n'a rien à voir avec la sauvegarde.
- **Preuve**: `src/session.ts` lignes 133 à 139 inchangées depuis le tour 1 (« sauvegarde illisible: nouvelle partie »); `ETAT.md` le note lui-même (« Reste à faire (risque 3 b) »).
- **Correction proposée**: dans `session.ts`, sur `SaveError`, ne pas créer de monde: arrêter la séance avec un message clair des deux côtés (« Ta sauvegarde n'a pas pu être relue. Rien n'a été effacé. ») et ne rien écrire; la plateforme propose déjà ses copies de secours. Version minimale en attendant l'écran: `duo.saves.provide(() => null)` et aucun `writeNow` tant qu'une sauvegarde a été refusée, pour qu'elle ne soit jamais écrasée. Un test dans `tests/sauvegardes-reference.test.ts`: séance hôte avec une sauvegarde abîmée, aucune écriture ensuite.
- **Effort**: 30 minutes pour la version minimale et son test; 90 minutes avec l'écran (avec dev-plateforme si le choix de la copie passe par Duo).
- **Gain attendu**: +0,5 (et retire la pénalité de ce tour).

### C. La commande devinée par l'hôte (mineur, à surveiller)

- **Constat**: quand une commande de l'invité arrive en retard, l'hôte rejoue la précédente et la compte pour le numéro suivant (`hote.ts` lignes 88 à 94); la vraie, arrivée ensuite, est écartée (ligne 79). C'est juste pour le déplacement (l'invité se recale par sa prédiction, mutation tuée par le test de gigue). Deux effets de bord: (1) un `actHeld` deviné après un relâchement tient Espace un pas de trop, ce qui peut, à la limite exacte du délai de répétition de « Espace tenu » (`heldRepeat`, `pas.ts` ligne 109), déclencher un geste de trop (une case bêchée en plus); (2) après un trou de plus de 6 pas, l'hôte cesse de deviner mais garde l'avance prise sur les numéros, et jusqu'à 6 commandes réelles de l'invité sont écartées d'un coup. Les appuis brefs, eux, ne se perdent pas: ils partent en intentions fiables (`commandes.ts` lignes 134 et 138).
- **Preuve**: lecture de `hote.ts`, `commandes.ts`, `pas.ts`; aucun test ne couvre un relâchement d'Espace pendant un retard.
- **Correction proposée**: ne pas deviner `actHeld` (rejouer la dernière commande avec `actHeld: false`): un geste manqué d'un pas ne se voit pas, un geste de trop si. Un test: Espace tenu puis relâché, la commande du relâchement en retard, aucun geste répété en plus.
- **Effort**: 30 minutes.
- **Gain attendu**: +0,1 (robustesse de principe, rare en pratique sur un réseau local).

## 4. Ce qui reste ouvert du tour 1

- Risque 2 (a et b): l'état complet part encore à chaque changement, avec notifications, textes des lettres et copie des compteurs. L'alerte est à 84 %: **la prochaine semaine de contenu la déclenchera**. Il faut l'envoi par différences et l'état allégé (migration vers le format 3, avec sa sauvegarde de référence, que le test exige désormais) avant d'ajouter du contenu.
- Risque 4 (audio, 128 Mo de plafond pour un budget de 64): l'autre architecte montre qu'un plafond de 40 Mo empêcherait de décoder la musique (deux thèmes de 35,5 Mo à la transition). Piste à trancher: musiques décodées en flux (`MediaElementAudioSourceNode`) ou en mono à 24 kHz (neuf fois moins de mémoire), ou budget de l'architecture revu par ADR après mesure sur le PC.
- Risque 5 (messages de l'hôte peu contrôlés chez l'invité): inchangé.

## 5. Les trois priorités du tour 3

1. **Risque B**: plus jamais de nouvelle partie silencieuse sur une sauvegarde refusée (30 minutes pour la version minimale).
2. **Risque A**: compiler les programmes sans ombre au chargement, libérer la carte d'ombre au repli (45 minutes).
3. **Risque 2 (a, b)**: état allégé et envoi par différences, format 3 avec sa référence, avant toute semaine de contenu nouvelle (environ 4 h, dev réseau et dev gameplay).

## 6. Non vérifié, et pourquoi

- Durée réelle des compilations au repli et au retour: rendu logiciel ici; à mesurer sur le PC (journal de la plateforme: « rendu: mode léger automatique », puis temps de la première image qui suit).
- Comportement du repli en vraie partie: je n'ai pas relancé l'essai dans Chromium de l'autre architecte (images injectées par `lplRendu.advance`), seulement lu son protocole et ses tests.
- Effets de la commande devinée sur Espace tenu: déduits de la lecture, non reproduits.

## 7. À tester chez le client

- Sur le PC: jouer 10 minutes à 17 h de jeu (ombres de 2048); si le jeu passe en mode léger (image plus floue, ombres absentes), noter s'il y a eu un gel au moment du passage. Le journal de Duo en garde la trace.
