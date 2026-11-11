# Coupure de la liaison en pleine activité (dev-reseau, 2026-11-11)

Ce que devient chaque activité quand la liaison tombe pendant qu'un joueur y est engagé, puis revient. Code: `games/la-petite-ligne-2/src/` (`session.ts`, `reseau/hote.ts`, `reseau/invite.ts`, `simulation/noyau/systemes.ts`). Tests: `tests/reconnexion-activites.test.ts`, sur le banc `tests/aides-coupure.ts`.

## Ce qui se passe vraiment à une coupure

D'après `docs/plateforme/reseau.md` (8.3, 10.3) et le code de la liaison (`packages/liaison/src/link.ts`, `apps/duo/src/main/platform.ts`):

1. Le lien tombe. Pendant 2 s environ, la plateforme ne le sait pas encore: les deux jeux continuent, chacun de son côté (60 pas). L'hôte simule sans les commandes de l'invité; l'invité joue contre un monde figé.
2. La plateforme déclare la perte: pause des deux jeux, raison `disconnect`. Les pas s'arrêtent, mais la page dessine toujours ses images, et l'heure de session comme le son continuent.
3. Le lien revient: les messages fiables qui attendaient sont remis dans l'ordre, sans perte ni doublon; d'un canal `latest`, seul le dernier.
4. Les deux joueurs reprennent: l'hôte renvoie tout l'état (`host.resume()`), l'invité oublie ses instantanés et sa prédiction.

Deux cas voisins ne sont pas une reconnexion:

- **Duo relancé chez l'un des deux** (invité ou hôte): la plateforme arrête la partie des deux côtés (`guest-gone`, « l'hôte a quitté »), l'hôte enregistre. La partie repart de la sauvegarde. Le retour d'un invité relancé dans une partie gardée en pause (CA-PF-048 de la plateforme) n'existe pas encore.
- **Coupure de l'hôte vue de l'invité**: c'est la même coupure, vue de l'autre bout. Le banc la joue dans les deux sens (canne chez l'hôte, pêche seule de l'hôte, air mené par l'un ou l'autre).

Le banc reproduit les étapes 1 à 4 avec le vrai pas de simulation: 2 s sans l'autre, pause de 20 s sur l'heure de session, retour, reprise dans les deux ordres possibles du signal chez l'invité.

## La règle des coupures

Une seule règle, déclarée par chaque activité (`GameSystem.interrupt` dans `simulation/noyau/systemes.ts`):

- **Par défaut, une activité se suspend.** Si tout son état est dans le monde et qu'elle avance sur l'horloge des pas, la pause l'arrête d'elle-même et l'hôte la renvoie complète à l'invité à la reprise. Elle n'a rien à déclarer. C'est le cas de la plupart.
- **Ce qui se joue sur la machine du joueur s'arrête avec les pas.** En pause, `session.paused()` est vrai et `main.ts` donne une durée d'image nulle à l'interface: un combat de pêche ou une cuisson joués localement n'avancent plus.
- **Ce qui ne peut pas se suspendre s'annule sans rien coûter.** Un système déclare `interrupt(sim, joueur, cause)`. Cause `pause`: l'activité court sur une horloge qui ne s'arrête pas (heure de session, son). Cause `reload`: la partie repart d'une sauvegarde, aucune interface n'est ouverte. Ce que l'activité avait pris est rendu.
- **Chaque machine prévient son interface à sa propre pause**, sans attendre l'autre: événement local `session_paused`, jamais transmis. Pendant une coupure, les annulations de l'hôte n'arrivent chez l'invité qu'au retour du lien.

Ajouter une activité demain: si son état est dans le monde et sur les pas, rien à faire. Sinon, une fonction `interrupt` dans son système et un cas dans `tests/reconnexion-activites.test.ts`.

## Tableau des activités

« Avant »: mesuré sur le banc avant correction (branche à e8feb1f), ou lu dans le code quand c'est dit. Chaque test est un cas de `tests/reconnexion-activites.test.ts`.

| Activité | Avant | Après | Test |
|---|---|---|---|
| Pêche à deux (canne et épuisette, `fish_hold`, `fish_net`) | Le combat reprend, la prise vient, un seul appât mangé. Lu dans le code: Espace relâché pendant la pause restait « tenu » jusqu'au prochain appui. | Pareil; les touches de la pêche sont relâchées à la pause. | « à deux, canne chez l'invité », « à deux, canne chez l'hôte » |
| Pêche seule (ligne à l'eau, poisson ferré) | Toute pause, Échap compris, chez l'hôte comme chez l'invité: la partie locale continuait seule sur les images. Pendant la touche: « manqué », le poisson part. Pendant le combat: prise refusée par l'hôte (`invalid`) ou poisson échappé, et l'appât déjà mangé part avec lui. | La partie locale s'arrête avec les pas; la prise est validée, l'appât compté une fois. | « seule (invité ou hôte), coupure pendant la touche ou le combat », plus le témoin du défaut |
| Cuisson et mini-jeu de cuisine | Les étapes défilaient pendant la pause: soupe à 2 étoiles et 1 portion au lieu de 3 étoiles et 2 portions. | Le mini-jeu reprend où il était: plat parfait, ingrédients retirés une fois. | « le mini-jeu de l'invité reprend où il était » |
| Musique (`music_*`), seul ou en duo | Toute pause: l'accompagnement et l'heure de session continuaient, pas l'horloge de l'hôte. Au retour, presque toutes les notes comptées manquées (40 sur 44 chez l'un, 37 sur 48 chez l'autre), mot de la fin le plus bas retenu comme premier mot de l'air, amitié du jour des auditeurs donnée au minimum. Lu dans le code: un air d'accord perdu sur chaque instrument. | L'air est abandonné à la pause comme si chacun rangeait son instrument: cahier fermé sur les deux machines tout de suite, rien de compté. On le rejoue et il va au bout. | « duo au pupitre, liaison perdue », « duo au pupitre, pause demandée (Échap) » |
| Chantier par ardoise (`worksite`) | Correct: le travail continue, l'étape se finit. | Inchangé. | « chantier » |
| Fabrication à l'établi | Correct: l'ouvrage attend sur le poste (les matériaux ne partent qu'à la fin). | Inchangé. | « établi » |
| Geste d'outil en cours | Correct: le coup va au bout pendant les 2 s, l'arbre garde son avancement. | Inchangé. | « geste d'outil » |
| Dialogue et boutique ouverts | Correct: la conversation est dans l'état du joueur, l'invité la retrouve et la ferme; l'achat passe. | Inchangé. | « dialogue et boutique » |
| Décision à deux en attente | Correct: le choix de l'un est un fait de la progression, il attend l'autre. | Inchangé. | « décision à deux en attente » |
| Scène en cours | Correct: la réplique lue par l'un attend l'autre (ou son délai de lecteur seul). | Inchangé. | « scène » |
| Sommeil à deux | Correct: l'invité reste couché, la nuit passe quand l'hôte le rejoint. | Inchangé. | « sommeil à deux » |
| Assis ou couché | Correct: la place reste tenue, on se lève à la première direction. | Inchangé. | « assis » |
| Draisine (`vehicle_*`) | Correct: les deux restent à bord, elle roule sur son élan, repart, on descend à l'arrêt. Pas de partenaire fantôme. | Inchangé. | « draisine » |
| Mode déco, meuble en main, objet en main | Correct si le signal de reprise de l'invité précédait l'envoi complet de l'hôte. Dans l'autre ordre, l'invité jetait toutes les différences suivantes: lieu et progression figés chez lui jusqu'au filet (30 s). Vaut pour toutes les activités de ce tableau. | L'invité ne remet plus ses assembleurs à zéro à la reprise: les deux ordres donnent le même état. | « mode déco » (reprise dans l'ordre défavorable) |
| Reprise d'une sauvegarde faite en pleine activité (hôte ou Duo relancé) | Ligne à l'eau gardée sans personne pour la jouer: impossible de relancer tant que le joueur ne s'éloignait pas d'un mètre ou que le filet de l'hôte ne l'avait pas rangée (une minute environ, lu dans le code), appât mangé perdu. Meuble tenu en mode déco gardé verrouillé, mode déco « actif » sans écran. | La ligne est rangée sans effrayer l'ombre, l'appât revient au sac; le meuble retourne d'où il vient, le mode déco est quitté. Gestes, dialogues, voyage et draisine: déjà remis d'aplomb (`settleForResume`). | « rend ce que chacun tenait » |
| La séance elle-même | La pause de la plateforme n'était connue que pour enregistrer. | Les deux séances se savent en pause, préviennent leur interface, repartent. | « les deux machines se savent en pause » |

## Ce qui reste

- **Intentions parties pendant les 2 s du trou** (mineur): ce que l'invité a demandé sans réponse est joué à la reprise. Mesuré: un coup d'épuisette donné dans le vide compte comme un plongeon raté (prise à 2 étoiles au lieu de 3), un second coup de hache part tout seul, un achat cliqué pendant le trou se fait au retour. Rien n'est perdu. Les écarter demande de dire lesquelles (un geste) et lesquelles non (`place_loaded`, le résultat d'un mini-jeu): à décider avec les devs gameplay.
- **Touches tenues des autres mini-jeux** (mineur): cuisine, accordage et mode déco gardent leur propre état de touches; seule la pêche le relâche à la pause. Une touche relâchée pendant la pause se rattrape au premier appui.
- **Gel de l'interface**: la ligne de `main.ts` n'a pas de test automatique (pas de DOM dans la suite rapide). Le banc prouve la conséquence (partie locale figée, prise validée) et la séance prouve `paused()`. À confirmer dans un parcours à deux contextes et sur les machines.
- **Rendu et sons d'ambiance** continuent pendant la pause (animations sur place): voulu par la plateforme, sans effet sur l'état.
- **Invité relancé dans une partie en pause**: quand la plateforme le permettra, l'hôte devra appliquer la règle au joueur de l'invité (cause `reload`) et annuler ce qu'il tient pour lui hors de l'état (cuisson en cours, voix d'un duo). Rien à faire avant.
