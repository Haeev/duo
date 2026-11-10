# La cuisine: conception (dev-gameplay-3d, 2026-11-10)

D'après le cahier 4.4 (repas spéciaux), 4.7 (cuisine, R32), `interface.md` 5.6 et `technique.md` (mini-jeux locaux, bornés par l'hôte). Code: `games/la-petite-ligne-2/src/simulation/cuisine/` et `src/interface/cuisine/`.

## La boucle

1. On vise un poste de cuisine (un meuble qui déclare la brique `cook`: réchaud, cuisinière, four, plan de travail) et on appuie sur Espace.
2. Le livre de recettes s'ouvre, en images: le plat, ses ingrédients en vignettes avec compteur (« 2/2 », barré s'il manque), l'effet sur la faim, les étoiles déjà obtenues. Une recette d'un autre poste montre le picto de ce poste; une recette inconnue est une silhouette (celles qui se trouvent « par essai » montrent leurs ingrédients en devinette).
3. Recette simple (réchaud, sans étapes): le plat sort aussitôt, petite poêle qui saute. Aucune attente (règle des 1,5 s).
4. Recette cuisinée: un mini-jeu de 15 à 40 s, 2 à 4 étapes. Une frise de pictos en haut, une seule jauge au centre, la touche à faire sous la jauge.
5. Le plat sort avec 1, 2 ou 3 étoiles (correct, bon, parfait). Un plat jamais cuisiné est fêté: le plat grossit, un jingle, « Nouveau plat ! », il s'inscrit au livre pour les deux.

On ne rate jamais un plat: la note de chaque geste va de 1 à 3, la moyenne donne la qualité. Un meilleur plat donne un peu plus (une portion de plus, ou un plat plus nourrissant), selon la fiche.

## Les gestes (Espace, Q et D, plus Z Q S D pour dresser)

| Étape | Geste | Ce qui varie d'une recette à l'autre |
|---|---|---|
| Couper | Espace en rythme sur un métronome qui pulse (2 coups par seconde au plus) | nombre de coups, tempo |
| Remuer | alterner Q et D à l'allure de la cuillère qui tourne | nombre de tours, allure |
| Cuire | tenir Espace, le feu monte; relâcher dans la zone dorée | nombre de cuissons, place et largeur de la zone (tirées de la graine) |
| Assaisonner | une aiguille balance; Espace quand elle passe sur la pincée | nombre de pincées, vitesse |
| Dresser | refaire une petite suite de flèches (Z Q S D) montrée sur l'assiette | longueur de la suite |

Chaque étape a une durée plafond: passé ce temps, elle se termine avec la note acquise. Personne ne martèle: au plus 3 appuis par seconde. Les fenêtres s'élargissent avec le bonus « Bien reposé » (modificateur `minigame` des besoins), l'aide réglable (0, 25, 50 %) et le réglage « cuisine tranquille » (fenêtres doublées).

## Recettes en données

Une fiche par recette (`donnees/commun/recettes/<id>.json`, gabarit commenté): poste, ingrédients, plat obtenu, étapes, durée visée, qualité (`quality.good` et `quality.perfect`: ce que donne un meilleur plat), façon de l'apprendre (`learn.book`: un objet livre qu'on lit au poste; `learn.trial`: on la trouve en cuisinant ses ingrédients; sinon un habitant l'apprend par l'effet de dialogue `remember` sur la clé `cuisine.recette.<id>`). Le moteur ne nomme aucune recette.

## À deux

Un repas spécial a une seconde part (`second`): son poste, ses ingrédients, ses étapes. Le premier qui choisit la recette prend la première part, l'autre (sur un autre poste de la même cuisine, à moins de 6 m) prend la seconde: l'un coupe pendant que l'autre remue. Chacun voit la frise de l'autre au-dessus de la sienne. L'ordre compte un peu: une étape de la seconde part peut attendre une étape de la première (`after`); faite trop tôt, sa note perd un cran (jamais sous 1). Seul, on fait la première part puis la seconde: deux fois plus long, même résultat.

Le plat obtenu porte le bonus exclusif (`meal.perk` de l'objet). On le sert à table (`serve_meal`, système des besoins), les deux assis: faim à 100, bonus pour les deux, puis une scène de 15 s jouée sur les deux machines à partir de l'événement `meal_shared` (on s'assoit, on se sert, on trinque, on mange, un soupir content), chaque temps fort étant un événement local pour le rendu et le son.

## Réseau

Le mini-jeu se joue sur la machine du joueur, avec la graine que l'hôte envoie au départ (`cook_started`). Chaque étape finie part en intention (`cook_step`, note de 1 à 3); l'hôte borne la note, refuse une part finie trop vite (moins de 40 % de la durée visée), retire les ingrédients à la fin seulement (quitter ne coûte rien) et donne le plat. Le partenaire voit chaque étape par l'événement `cook_step_done`.
