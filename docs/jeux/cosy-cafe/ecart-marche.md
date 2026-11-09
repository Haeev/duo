# Deux Tabliers: écart avec les simulateurs de commerce du marché et plan d'amélioration

| Champ | Valeur |
|---|---|
| Rédaction | game-designer, 2026-11-09 |
| Statut | analyse et proposition, à valider par le client (questions EM-Q1 à EM-Q5) |
| Origine | demande du client: un jeu « amusant, intuitif et équivalent à la gamme des jeux de simulation du marché »; séance du 2026-11-09 sur la 0.2.4 (jours 2 et 3, 18 remarques avec captures) |
| Vaut pour | la 0.2.4 jouée en séance et la v0.3 du dépôt (départ en cellule vide) |
| Ne change rien | aucun code, aucune donnée, aucun modèle: ce document ne fait que proposer |
| Documents liés | `cahier-des-charges.md`, `demo/demo-v0-1.md`, `demo/economie-premiers-jours-v0-3.md`, `demo/depart-cellule-vide-v0-3.md`, `technique.md` (contraintes C1 à C26), `son.md`, `games/deux-tabliers/ETAT.md` |

## 1. En bref

Le fond de Deux Tabliers est plus riche que celui de la plupart des jeux du genre (ardoise, habitués, événements, économie simulée, départ en cellule vide). Ce qui manque pour être « au niveau », c'est la couche que le joueur touche pendant les dix premières minutes:

1. **On ne reconnaît pas les objets.** Tous les postes, la vaisselle et la nourriture sont des formes simples faites par script; seuls les personnages viennent de Meshy. La vitrine est une boîte vide, la bouilloire un dôme, la plonge n'a pas d'évier, le réfrigérateur est un bloc blanc.
2. **Les gestes ne répondent pas assez.** On encaisse sans voir un seul montant, on range sans voir le stock monter, on sert une viennoiserie qu'on ne voit pas, on ne voit pas ce qu'on tient.
3. **La prise de commande est muette.** Le client ne dit rien: il faut aller lire le ticket. C'est le geste le plus fréquent du jeu, et c'est celui qui devrait faire parler le couple.
4. **Les récompenses sont trop espacées.** Quatre paliers en quatre heures de démo, soit un déblocage par heure environ; le genre en donne un toutes les dix à vingt minutes.
5. **Le monde est figé.** Place vide, lumière qui ne bouge pas de l'ouverture à la fermeture.
6. **Le premier jour punit.** Un service parfait finit dans le rouge (correctif déjà conçu dans `demo/economie-premiers-jours-v0-3.md`, pas encore programmé).

Le plan (section 5) propose 15 améliorations classées par plaisir rapporté au coût: 6 « vite faits » de moins de 2 h (7 h 30 en tout, livrables en une ou deux mises à jour du soir) et 9 chantiers de 3 à 8 h. La liste des modèles à produire avec Meshy (section 6) compte 49 modèles en trois priorités, pour 840 à 1 300 crédits selon le nombre d'essais.

## 2. Méthode et limites

- **Référence**: les simulateurs de commerce en vue subjective cités par le client (supérette, boutique de cartes, garage, café). Ils ne sont pas nommés ici et rien n'en est repris: on relève les principes de plaisir communs au genre, puis on y répond avec les moyens propres à Deux Tabliers (section 1.2 du cahier: pas d'ordinateur de commande, pas de caisse à scanner, pas de note qui tombe, pas de faillite, rien qui compare les deux joueurs).
- **Source de la connaissance du genre**: ma connaissance de ces jeux, sans recherche en ligne ni partie jouée aujourd'hui. Les principes retenus sont ceux que l'on retrouve d'un titre à l'autre; aucun chiffre de cadence du marché n'a été mesuré (les « dix à vingt minutes » entre deux déblocages sont un ordre de grandeur).
- **État de Deux Tabliers**: lu dans le dépôt le 2026-11-09 (`ETAT.md`, données, tables de `src/rendu/correspondances.ts`, événements émis et lus), dans les rapports de recette du 2026-11-08 et sur les captures de la séance. Je n'ai pas lancé le jeu.
- **Estimations**: en heures de travail d'un membre du studio, relecture et intégration par le manager non comprises. Elles ne sont pas mesurées; les crédits Meshy sont comptés à 15 par essai (image vers 3D en topologie intelligente, fiche `docs/production/meshy.md`).

## 3. Ce que la séance a montré

Les 18 remarques de la séance, regroupées par cause. Les numéros entre parenthèses renvoient aux améliorations de la section 5.

| Famille | Remarques du joueur (résumé) | Cause relevée dans le dépôt | Réponse |
|---|---|---|---|
| Objets qu'on ne reconnaît pas | la vitrine (« c'est quoi ? »), l'étagère métallique du plan de préparation, la zone de la plonge (« c'est censé être un lavabo ? »), le bloc blanc de la réserve, le « plan de travail du frigo » introuvable, le rail à tickets invisible | postes en formes simples (`assets-src/modeles/*.py`); `frigo-armoire`, `etagere`, `etagere-longue`, `palette-livraison` sans modèle (blocs de substitution); `frigo-sous-plan` sans forme propre | (4), (14), section 6 |
| On ne sait pas quoi faire | « on fait quoi avec les cartons ? », « on fait quoi dans l'arrière-salle ? » | rien ne dit où va un carton tant qu'on ne vise pas le bon meuble | (6), (11) |
| Gestes contre-intuitifs | le thé (il faut d'abord poser une tasse sur la bouilloire, lancer la chauffe depuis 20 °C, puis recliquer au bon moment), la vitrine (« on voit pas la bouffe, on sait pas comment s'en servir »), le thé servi en théière | `planKettle` de `src/service/regles.ts` (trois étapes dont deux muettes), `gestures.kettle.startC` à 20, table `OBJECT_MODEL` qui pointe les thés sur `ware_teapot`, vitrine sans contenu visible | (1), (11) |
| Prise de commande | « prendre une commande devrait nous dire direct ce que le client veut plutôt que d'aller voir le ticket; je suis censé dire à l'autre quoi faire » | CO-01 du cahier prévoit la bulle du client; l'événement `clientele-order` est émis par `src/clientele/clients.ts` mais aucune interface ne le lit | (2) |
| Finition | assiette invisible une fois posée, tasses qui flottent, client dans le mur, étagère qui traverse la vitrine, repos des personnages trop agité | ancrages et dimensions; clip de repos | (3), (9) |
| Monde figé | « le village est désert en extérieur, et la luminosité n'évolue pas de la journée » | lumière cuite une fois pour toutes; les passants existent dans la simulation (`clientele-passed-by`) mais ne sont pas affichés | (15) |
| Économie | journée parfaite finie à -14 € | bilan qui compte le stock acheté, loyer et charges dès le premier jour | (7) |
| Départ | café livré tout prêt | corrigé par la v0.3 (cellule vide) | fait |

Aucune remarque ne porte sur le fond (l'ardoise, les habitués, l'idée de tenir un café à deux): les joueurs butent avant d'y arriver. C'est une bonne nouvelle: l'écart se comble surtout par de la lisibilité et des retours, pas par une refonte.

## 4. Les principes de plaisir du genre, et où en est Deux Tabliers

Douze principes: les onze du brief, plus « un monde qui vit autour de la boutique », que la séance a mis en avant. Pour chacun: ce qui fait le plaisir dans le genre, ce que fait Deux Tabliers aujourd'hui, l'écart, et une proposition originale pensée pour deux joueurs qui se parlent. Note d'écart: faible, moyen, fort.

### 4.1 La boucle d'achat: commander, recevoir, déballer

- **Dans le genre**: on commande, la marchandise arrive sous forme de cartons qu'on porte, qu'on ouvre et qu'on vide. Le carton est l'objet fétiche: il rend l'argent dépensé tangible.
- **Aujourd'hui**: commande le soir depuis le téléphone, livraison le matin par les fournisseurs du village, cartons sur une palette dans la cour, à ranger (« Ranger le carton »). L'idée des livreurs en personne est originale et à garder.
- **Écart: moyen.** La palette est un bloc, les cartons sont anonymes, et rien ne dit où ils vont (« on fait quoi avec les cartons ? »). Le carton rangé disparaît sans que rien n'apparaisse à sa place.
- **Proposition**: des cartons marqués d'un pictogramme (lait, grains, thé, viennoiseries), une destination nommée et encadrée dès qu'on en tient un (6), et un rangement qui se voit (11). À deux: **la chaîne du matin**. Si l'un passe un carton à l'autre de main en main (viser son partenaire, E), le carton est rangé deux fois plus vite par celui qui le reçoit: on forme naturellement une chaîne cour vers réserve, et on se parle (« le lait, c'est pour toi »). Bonus à garder pour plus tard, hors des 15.

### 4.2 La mise en rayon ou la préparation

- **Dans le genre**: remplir un rayon vide article par article, ou assembler un produit étape par étape. Le geste est simple, répétitif, et son résultat reste visible.
- **Aujourd'hui**: des gestes de barista variés et bien pensés pour le café (moudre, extraire, mousser, avec jauges). Mais le thé demande trois étapes dont deux muettes, la vitrine ne montre aucune viennoiserie, et le poste « Réfrigérateur et plan » n'a pas de forme.
- **Écart: fort** sur le thé, la vitrine et le plan de préparation; faible sur le café.
- **Proposition**: une vitrine garnie le matin, où l'on vise directement la viennoiserie voulue et où l'on voit les rangées se vider (11); un thé en tasse avec une bouilloire gardée tiède (1); un plan de préparation reconnaissable (14). À deux: celui qui garnit la vitrine le matin annonce ce qu'il reste (« plus que deux tartes »), l'autre barre la ligne sur l'ardoise.

### 4.3 L'encaissement

- **Dans le genre**: le moment où l'argent entre. Un geste court, un son de caisse, un montant qui s'affiche: c'est la récompense la plus fréquente du jeu.
- **Aujourd'hui**: on maintient E à la caisse (2,5 s, plus 0,4 s par article), le ticket part au rail. Le cahier écarte volontairement la caisse à scanner et le rendu de monnaie. Les événements `service-paid` et `service-tip` existent, mais seul le son les lit: aucun montant ne s'affiche, le pot à pourboires ne se remplit pas à l'écran (prévu en 5.2 du cahier).
- **Écart: fort.** Le geste le plus fréquent est muet deux fois: le client ne dit rien, la caisse ne montre rien.
- **Proposition**: **le client dit sa commande** (2). Pendant le maintien, une bulle s'écrit article par article au-dessus du client, visible seulement chez celui qui encaisse. Il l'annonce à voix haute à son partenaire, qui lance la préparation avant même que le ticket n'atteigne le rail. Le ticket reste la mémoire, il n'est plus le passage obligé. Et **les sous qui tombent** (5: afficheur de la caisse, montant qui s'élève, pièces dans le pot).

### 4.4 L'agrandissement

- **Dans le genre**: la boutique grandit par étapes visibles: un mur tombe, une pièce s'ouvre, une nouvelle activité arrive. On compare mentalement avec le premier jour.
- **Aujourd'hui**: « Nos projets » (12 projets), la terrasse (450 €), la crêperie, le départ en cellule vide de la v0.3 qui donne un vrai « avant ». La recette a relevé une terrasse achetée mais ignorée par la clientèle (RN-01).
- **Écart: moyen.** Le contenu existe, mais l'agrandissement arrive tard (terrasse au jour 11 pour le duo médian) et rien ne célèbre le moment.
- **Proposition**: **la photo du lundi**. Chaque lundi de fermeture, le jeu prend une photo du café depuis le même point de la place et l'épingle dans le livre d'or: on feuillette semaine après semaine et on voit le café changer. Les travaux se lancent à deux (chacun un outil, comme la pancarte) et se terminent par un dévoilement (le drap qu'on tire à deux). Bonus hors des 15; corriger RN-01 d'abord.

### 4.5 Des déblocages fréquents

- **Dans le genre**: une petite nouveauté toutes les dix à vingt minutes (un produit, un meuble, une licence). C'est le « encore un jour » du genre.
- **Aujourd'hui**: quatre paliers (jour 1, 2 tasses ou jour 7, 2,5 tasses ou jour 9, 3 tasses ou jour 12) pour quatre heures de démo. La réputation en demi-tasses ne bouge visiblement qu'une fois par heure environ.
- **Écart: fort.**
- **Proposition**: **le paquet du matin** (13). Les voisins remercient le café: tous les 5 à 35 groupes servis, un paquet ficelé attend sur le seuil le lendemain matin. On l'ouvre à deux (chacun tire un bout de la ficelle). Dedans: un objet à poser, une recette de Simone, un lot d'ingrédients rares. Douze paquets sur la démo, un par jour de service: le compte se lit sur l'afficheur de la caisse (« encore 8 clients avant le prochain paquet »). Les paliers du catalogue restent, les paquets comblent les creux.

### 4.6 Des retours satisfaisants

- **Dans le genre**: chaque geste a un son net, un chiffre qui monte ou un objet qui se remplit. Rien n'est gratuit, rien n'est silencieux.
- **Aujourd'hui**: 141 sons, dont beaucoup déjà prêts (`coins-drawer`, `tip-jar-1` à `3`, `shelf-place`, `carton-open`, `dish-wash`); des jauges de geste soignées. Mais le visuel ne suit pas: pas de montant, pas de stock visible, vaisselle sale sans évier ni eau, objet tenu invisible en vue subjective (seule une ligne de texte « en main »), bilan en chiffres fixes.
- **Écart: fort** sur le visuel, faible sur le son.
- **Proposition**: (5), (8), (10), (11). Règle maison à respecter (`son.md`): aucun son ni signe ne juge la qualité d'un geste ou ne compare les joueurs. Les retours proposés célèbrent ce qui entre dans le pot commun, jamais qui l'a fait entrer.

### 4.7 La lisibilité immédiate des objets

- **Dans le genre**: on reconnaît chaque objet à sa silhouette, sans texte: une caisse est une caisse, un frigo est un frigo. Les produits ont des emballages distincts. C'est ce qui rend ces jeux « intuitifs ».
- **Aujourd'hui**: les 15 personnages viennent de Meshy; tout le reste (postes, vaisselle, nourriture, meubles) est modélisé par script en formes simples. Quatre meubles n'ont aucun modèle et s'affichent en blocs. Le guide de Simone et le cadre vert du poste demandé aident, mais ils disent où aller, pas ce qu'est l'objet.
- **Écart: fort.** C'est la première cause des remarques de la séance (9 sur 18).
- **Proposition**: refaire les postes que le joueur n'a pas reconnus (14, section 6), et d'ici là **faire dire son nom à chaque poste** dès qu'on le regarde de près (4). À deux: les aides restent propres à chaque joueur. Celui qui connaît le café coupe les noms sur son écran, l'autre les garde, et personne ne le voit.

### 4.8 Le rythme de la journée

- **Dans le genre**: ouverture, montée, coup de feu, accalmie, fermeture, bilan. La lumière et la fréquentation disent l'heure sans horloge.
- **Aujourd'hui**: le découpage est bon (écran du matin, pancarte à deux, service de 10 à 13 min, bilan, « À demain »), avec une montée en charge les premiers jours. Mais la lumière est la même de l'ouverture à la fermeture, et rien dans le décor n'annonce le coup de feu ni la fin.
- **Écart: moyen.**
- **Proposition**: une lumière qui suit l'heure (15, lot A): matin doré, midi clair, fin d'après-midi chaude, lampes du café et de la place qui s'allument avant la fermeture. Et un signal du monde avant le coup de feu: la cloche de l'église sonne midi, les passants se font plus nombreux (15, lot B). À deux: celui qui est en salle voit la place par la vitrine et prévient (« ça arrive »).

### 4.9 Des objectifs courts

- **Dans le genre**: une liste de petites tâches toujours visible: on sait quoi faire dans les deux prochaines minutes, et on coche souvent.
- **Aujourd'hui**: le guide « À faire » de Simone tient ce rôle pour l'apprentissage. Pendant le service, le seul objectif est « servir tout le monde »; les objectifs suivants sont à l'échelle de la journée (le bilan) ou de la semaine (les projets).
- **Écart: moyen à fort** une fois le guide terminé.
- **Proposition**: **les envies du jour** (12). Chaque matin, trois petits mots épinglés près de la caisse: des envies de voisins (« Farida aimerait une part de tarte avant midi », « dix cappuccinos aujourd'hui », « personne n'attend debout plus d'une minute »). Elles sont communes, se cochent pendant le service, et chacune rapproche le prochain paquet du matin. Aucune ne peut être ratée avec bruit: une envie non comblée s'efface le soir, sans commentaire. À deux: on choisit ensemble le matin laquelle viser d'abord, et certaines demandent les deux postes.

### 4.10 La personnalisation visible

- **Dans le genre**: on pose ses meubles, on choisit ses couleurs, on nomme sa boutique. Chaque partie finit par ne ressembler à aucune autre.
- **Aujourd'hui**: c'est un point fort: catalogue de meubles et de décorations, brocante du lundi, enseignes, aménagement libre, gros meubles portés à deux, cellule vide au départ.
- **Écart: faible.** Il manque surtout de voir le café de l'extérieur et de garder une trace de son évolution.
- **Proposition**: la photo du lundi (4.4), et les objets des paquets du matin, qui ne s'achètent pas: deux duos n'auront pas reçu les mêmes au même moment.

### 4.11 Les petites surprises

- **Dans le genre**: un client étrange, une livraison inattendue, un objet rare. De quoi raconter la partie.
- **Aujourd'hui**: 11 événements scénarisés, des habitués, la brocante, le livre d'or. C'est plus écrit que la moyenne du genre. La recette a noté un livre d'or qui se répète (RN-06) et `ETAT.md` l'absence d'événements au hasard sur la place.
- **Écart: faible à moyen.**
- **Proposition**: de petites scènes de place sans enjeu, vues par la vitrine (le facteur à vélo, un chat sur le rebord, une noce qui passe), à brancher sur les passants (15, lot B). À deux: une seule machine les voit de près, celle du joueur en salle; il les raconte à l'autre.

### 4.12 Un monde qui vit autour de la boutique

- **Dans le genre**: la rue est habitée: passants, voitures, cycle du jour. La boutique paraît exister quelque part.
- **Aujourd'hui**: la simulation fait passer des gens devant le café (`clientele-passed-by`), mais on ne les voit pas. La place est vide, le ciel fixe.
- **Écart: fort** (remarque 18 de la séance).
- **Proposition**: afficher les passants que la simulation compte déjà (15, lot B), dans la limite de 24 personnages au village et 40 animés (C1, C2). Un passant qui lit l'ardoise puis entre ou repart rend visible la règle la plus originale du jeu: c'est l'ardoise qui choisit la clientèle. À deux: on voit ensemble quelqu'un hésiter devant l'ardoise et repartir, et on en discute le soir.

### 4.13 Vue d'ensemble

| Principe | Écart | Améliorations |
|---|---|---|
| Boucle d'achat | moyen | 6, 11 |
| Mise en rayon ou préparation | fort (thé, vitrine, plan) | 1, 11, 14 |
| Encaissement | fort | 2, 5 |
| Agrandissement | moyen | bonus (photo du lundi), RN-01 |
| Déblocages fréquents | fort | 13 |
| Retours satisfaisants | fort (visuel) | 5, 8, 10, 11 |
| Lisibilité des objets | fort | 4, 14, section 6 |
| Rythme de la journée | moyen | 15 |
| Objectifs courts | moyen à fort | 12 |
| Personnalisation | faible | 13 |
| Petites surprises | faible à moyen | 15 |
| Monde vivant | fort | 15 |

## 5. Les 15 améliorations les plus rentables

### 5.1 Classement

Plaisir: note de 1 à 5 (5: change la première impression ou la boucle principale; 3: retire une gêne nette; 1: confort). Coût: heures de travail estimées. Rapport: plaisir divisé par le coût. Le classement dit quoi faire d'abord à effort égal; l'ordre de production (section 8) tient aussi compte des dépendances.

| Rang | Amélioration | Plaisir | Coût | Rapport | Rôle |
|---|---|---|---|---|---|
| **Vite faits (moins de 2 h)** | | | | | |
| 1 | Thé en tasse, bouilloire tiède | 3 | 0 h 45 | 4,0 | dev gameplay |
| 2 | Le client dit sa commande | 5 | 1 h 30 | 3,3 | dev gameplay, UX |
| 3 | Des clients au calme | 3 | 1 h | 3,0 | dev gameplay |
| 4 | Chaque poste dit son nom | 4 | 1 h 30 | 2,7 | UX, dev gameplay |
| 5 | Les sous qui tombent | 4 | 1 h 30 | 2,7 | dev gameplay, sound |
| 6 | Carton en main: où le ranger | 3 | 1 h 15 | 2,4 | dev gameplay |
| **Chantiers (2 h et plus)** | | | | | |
| 7 | Des premiers jours qui rapportent | 5 | 3 h | 1,7 | dev gameplay |
| 8 | Ce qu'on tient se voit | 4 | 3 h | 1,3 | dev gameplay |
| 9 | Rien ne flotte, rien ne traverse | 4 | 3 h 30 | 1,1 | dev gameplay, QA |
| 10 | Une plonge qu'on reconnaît | 3 | 3 h | 1,0 | dev gameplay, sound |
| 11 | Vitrine garnie, réserve qui se remplit | 5 | 5 h | 1,0 | dev gameplay |
| 12 | Les envies du jour | 4 | 4 h | 1,0 | dev gameplay, UX |
| 13 | Le paquet du matin | 5 | 6 h | 0,8 | dev gameplay, artiste 3D |
| 14 | Des postes qu'on reconnaît | 5 | 6 h et 120 à 240 crédits | 0,8 | artiste 3D avec Meshy |
| 15 | Le village vit | 5 | 8 h (deux lots de 4 h) | 0,6 | tech-artist, dev gameplay |

Total: 7 h 30 pour les six vite faits, 41 h 30 pour les neuf chantiers.

### 5.2 Les vite faits

#### 1. Thé en tasse, bouilloire tiède (0 h 45, dev gameplay)

- **Problème vu par le joueur**: « le thé se sert en théière au lieu de en tasse »; « la bouilloire, 20 degrés, on comprend pas où appuyer ». Il faut poser une tasse, cliquer, attendre 7,5 s sans rien d'autre à faire, puis recliquer.
- **Solution**: les trois thés arrivent dans la tasse (la table `DRINK_VESSEL` le prévoit déjà, c'est `OBJECT_MODEL` qui pointe sur la théière) et ne salissent qu'une pièce. La bouilloire est gardée tiède: départ à 60 °C au lieu de 20, donc 95 °C en 3,5 s et 80 °C en 2 s, et le refus « L'eau chauffe encore » (sous 60 °C) disparaît de lui-même. Le verbe du poste devient « Pose une tasse, chauffe, verse à 95 °C ». La théière devient une récompense plus tard (un thé pour deux, voir 13).
- **Fichiers ou données**: `src/rendu/correspondances.ts` (entrées `the-noir`, `the-vert`, `infusion` de `OBJECT_MODEL`), `donnees/service/recettes.json` (`dishes` de 2 à 1), `donnees/service/reglages.json` (`gestures.kettle.startC` de 20 à 60), `donnees/postes.json` (`verb` de `bouilloire`).
- **Critère d'acceptation**: un thé noir servi apparaît à table avec le modèle `ware_cup_cappuccino` et laisse une seule pièce sale; la chauffe atteint 95 °C en 3,5 s à 0,2 s près (test de règle); aucun refus « L'eau chauffe encore » sur 20 thés simulés.
- **À noter**: écart avec CO-11 du cahier (« une théière et sa tasse comptent pour deux »), question EM-Q1.

#### 2. Le client dit sa commande (1 h 30, dev gameplay et UX)

- **Problème vu par le joueur**: « prendre une commande devrait nous dire direct ce que le client veut plutôt que d'aller voir le ticket; je suis censé prendre la commande, donc dire à l'autre quoi faire directement ».
- **Solution**: pendant le maintien à la caisse (le moment où l'on « écoute »), une bulle s'écrit au-dessus du client, un article à la fois: « Bonjour ! Un cappuccino, un croissant. » Elle reste 4 s après la fin du maintien. Elle n'apparaît que sur l'écran de celui qui encaisse: c'est lui qui annonce à voix haute. Le ticket part toujours au rail (mémoire et vérification). Aide réglable par joueur dans le téléphone: « je vois aussi les commandes prises par l'autre » (pour un joueur moins à l'aise, invisible pour l'autre).
- **Fichiers ou données**: `src/clientele/clients.ts` (l'événement `clientele-order` porte déjà `group`, `player`, `items`), `src/branchement/interface.ts`, `src/interface/hud.ts` ou `src/interface/dialogue.ts`, `src/interface/modele.ts`, `donnees/clientele/textes.json` (formules de politesse par profil), `donnees/reglages.json` (durée d'affichage). Si les articles ne sont tirés qu'à la fin du maintien, le dev les tire au début, avec la même graine.
- **Critère d'acceptation**: sur 20 commandes simulées, la liste d'articles de la bulle est identique à celle du ticket créé; la bulle est complète avant la fin du maintien; dans une partie à deux clients, la bulle est présente dans l'interface de celui qui encaisse et absente chez l'autre, sauf si son aide est active.
- **À noter**: réalise CO-01 du cahier (« le client dit sa commande, bulle de texte, sans voix »), jamais programmé.

#### 3. Des clients au calme (1 h, dev gameplay)

- **Problème vu par le joueur**: « l'idle animation de tout le monde est bizarre, on dirait qu'ils tweak tous, ils peuvent pas rester plus calmes ? ».
- **Solution**: ralentir le clip `idle` (vitesse 0,5 à 0,6), décaler sa phase d'un client à l'autre pour qu'ils ne bougent pas ensemble, et garder la pose droite déjà prévue pour les clients assis. Si cela ne suffit pas, remplacer le clip par un repos calme de la bibliothèque Meshy (section 6, priorité 1).
- **Fichiers ou données**: `src/clientele/rendu3d.ts`, `src/rendu/melange.ts`, `donnees/reglages.json` (nouvelle valeur de vitesse du repos, pas de valeur en dur).
- **Critère d'acceptation**: la vitesse du repos est lue dans les réglages et vaut au plus 0,6; deux clients créés à la suite n'ont pas la même phase (test); sur une capture de 10 s d'une file de quatre clients, le directeur artistique ne relève aucun geste plus ample qu'une respiration ou un transfert d'appui.

#### 4. Chaque poste dit son nom (1 h 30, UX et dev gameplay)

- **Problème vu par le joueur**: « c'est quoi ça ? » devant la vitrine, le plan de préparation, la plonge, le réfrigérateur; « on nous demande de préparer au plan de travail du frigo mais c'est quoi ? ».
- **Solution**: quand un poste est à moins de 4 m et proche du centre de l'écran, son nom et une ligne d'usage s'affichent sous le point de visée, même si aucune action n'est possible: « Vitrine: les viennoiseries du jour », « Plonge: laver tasses et assiettes ». L'étiquette s'éteint après trois usages du poste par ce joueur. Réglage par joueur dans le téléphone: toujours, au début, jamais. Deux libellés à clarifier au passage: « Réfrigérateur et plan » devient « Plan de préparation », « Cloche à viennoiseries » devient « Vitrine », et le guide de Simone emploie les mêmes mots.
- **Fichiers ou données**: `donnees/postes.json` (`label`, nouveau champ `hint`), `donnees/SCHEMA.md`, `src/interface/hud.ts`, `src/branchement/interface.ts`, `src/branchement/guide.ts`, `donnees/reglages.json` (distance, nombre d'usages).
- **Critère d'acceptation**: le validateur refuse un poste sans `label` ou sans `hint`; à moins de 4 m d'un poste jamais utilisé, l'étiquette est affichée, et elle ne l'est plus après trois usages par ce joueur (test); le réglage d'un joueur ne change rien sur l'écran de l'autre; aucun texte du jeu ne contient plus « plan de travail du frigo ».
- **À noter**: c'est un pansement utile en attendant les modèles (14), et une aide durable pour un joueur débutant.

#### 5. Les sous qui tombent (1 h 30, dev gameplay et sound)

- **Problème vu par le joueur**: on encaisse sans rien voir entrer. La séance s'est finie sur « on finit la journée à -14 euros » sans que rien, pendant le service, n'ait montré l'argent.
- **Solution**: à chaque encaissement, le montant s'élève de la caisse (« +4,20 € », 1,2 s, sur les deux écrans, avec le son `coins-drawer` existant). À chaque pourboire, « +0,50 € » au-dessus du pot à pourboires avec `tip-jar-1` à `3`. Viser la caisse affiche la recette du jour sur son afficheur. Rien de permanent n'est ajouté au HUD. Aucun nom de joueur n'est attaché à un montant: c'est le pot commun.
- **Fichiers ou données**: `src/branchement/interface.ts` (lire `service-paid` et `service-tip`, aujourd'hui lus par le seul `src/audio/espace.ts`), `src/interface/hud.ts`, `src/rendu/monde3d.ts`, `donnees/reglages.json` (durée).
- **Critère d'acceptation**: à chaque `service-paid`, un montant égal à celui de l'événement s'affiche au-dessus de la caisse pendant 1 à 1,5 s sur les deux écrans; la recette lue en visant la caisse est égale à la somme des encaissements du jour (test sur 10 commandes); le HUD au repos compte le même nombre d'éléments qu'avant.

#### 6. Carton en main: où le ranger (1 h 15, dev gameplay)

- **Problème vu par le joueur**: « on fait quoi avec les cartons ? », « on fait quoi dans les trucs de l'arrière-salle ? ».
- **Solution**: dès qu'on tient un carton, la ligne « en main » nomme le produit et sa place (« Lait: au réfrigérateur »), et le meuble de destination est encadré en vert (mécanisme existant du poste demandé). En visant la palette les mains vides: « Prendre un carton (il en reste 4) ». Le guide de Simone gagne une étape « Range la livraison » le premier matin.
- **Fichiers ou données**: `src/rendu/surlignage.ts`, `src/branchement/guide.ts`, `src/branchement/interface.ts`, `src/interface/textes.ts`, `donnees/service/reglages.json` (`storage`, qui donne déjà les meubles par famille), `donnees/service/ingredients.json`.
- **Critère d'acceptation**: pour chacun des 21 ingrédients, tenir son carton encadre un meuble dont le type figure dans `storage` pour sa famille, et la ligne « en main » contient le nom du produit et celui de la destination (test paramétré).

### 5.3 Les chantiers

#### 7. Des premiers jours qui rapportent (3 h, dev gameplay)

- **Problème vu par le joueur**: « on a fini une journée en servant tous les clients avec des marges de +90 % et on finit la journée à -14 euros ». Dans le genre, le premier jour finit toujours un peu au-dessus de zéro: c'est ce qui donne envie du deuxième.
- **Solution**: celle de `demo/economie-premiers-jours-v0-3.md`, déjà conçue et simulée: bilan par la marge (le stock acheté n'est plus une perte), loyer de la première semaine laissé par Simone, charges réduites pendant la montée en charge, port offert à la première livraison, commande proposée à la mesure de la salle.
- **Fichiers ou données**: `donnees/clientele/economie.json`, `donnees/clientele/regles.json`, `donnees/clientele/fournisseurs.json`, `donnees/clientele/textes.json`, `src/clientele/journee.ts`, `src/branchement/interface.ts`, `src/interface/bilan.ts`, `src/interface/modele.ts`, `src/interface/textes.ts`.
- **Critère d'acceptation**: ceux de la section 9 de ce document; en résumé, un premier mardi où tous les groupes sont servis finit avec un résultat du jour positif dans `demo/simulations/premiers_jours_v0_3.py` et dans une partie de robots d'une journée.

#### 8. Ce qu'on tient se voit (3 h, dev gameplay)

- **Problème vu par le joueur**: on prend une tasse, elle disparaît; seule une ligne de texte dit ce qu'on porte. Chez l'autre, l'avatar marche les mains vides (`ETAT.md`: « les avatars ne portent rien visiblement »). Dans le genre, voir le carton ou le produit dans ses mains est la base de la sensation de travail.
- **Solution**: l'objet tenu s'affiche en bas à droite de la vue, attaché à la caméra, avec un léger balancement à la marche; le plateau montre ce qu'il porte. Pas de mains (question Q13 du cahier: objet seul au prototype). Chez le partenaire, le même modèle est accroché à la main de l'avatar, comme la tasse des clients l'est déjà.
- **Fichiers ou données**: `src/rendu/monde3d.ts` (`inHands`), `src/rendu/scene.ts`, `src/rendu/tenue.ts`, `src/rendu/melange.ts` (prise de main), `donnees/reglages.json` (position et taille à l'écran).
- **Critère d'acceptation**: pour chaque type d'objet de `OBJECT_MODEL`, une capture en vue subjective montre le modèle dans le quart bas droit de l'écran, sans traverser le plan proche; la capture de l'autre joueur montre le même objet dans la main de l'avatar; le nombre de programmes WebGL reste dans le budget de 12; la caméra ne bouge pas (C22).

#### 9. Rien ne flotte, rien ne traverse (3 h 30, dev gameplay et QA)

- **Problème vu par le joueur**: « assiette invisible quand on les pose », « les tasses volent dans le vide », « pnj glitché dans le mur », une étagère qui traverse la vitrine, « pas de rack à ticket visible ». Chacun de ces défauts coûte peu de temps de jeu mais beaucoup de confiance: on cesse de croire que le reste est voulu.
- **Solution**: une passe de correction sur les cinq scènes de la séance, plus les défauts de même famille déjà relevés en recette (RV-04 tasse en trop, RV-05 gorgée au front, RN-02 tickets orphelins sur le rail). Et, pour que cela ne revienne pas, un contrôle mécanique de l'aménagement par défaut: aucune boîte englobante de meuble n'en traverse une autre, tout objet posé a sa base sur une surface, toute place de client est dans la zone praticable. À vérifier au passage: les entrées `balai` (`broom`) et `rideau-*` (`shutter_bay`) de `FURNITURE_MODEL`, qui ne correspondent à aucun fichier de `assets/modeles/`, et `presse-agrumes`, sans modèle alors que `presse_levier.glb` existe.
- **Fichiers ou données**: `donnees/amenagement.json`, `donnees/meubles.json`, `donnees/objets.json`, `donnees/departs/village-cellule.json`, `src/rendu/correspondances.ts`, `src/rendu/monde3d.ts`, `src/clientele/places.ts`, `src/clientele/rendu3d.ts`, validateur des données.
- **Critère d'acceptation**: le validateur échoue si deux meubles de l'aménagement par défaut se recouvrent de plus de 1 cm ou si un emplacement d'objet est à plus de 1 cm de sa surface; les cinq scènes de la séance, recapturées, ne montrent plus le défaut; sur une simulation de 3 min de service, aucun client n'a de position hors de la zone praticable; le rail à tickets est visible depuis la caisse et depuis la machine à espresso (deux captures).

#### 10. Une plonge qu'on reconnaît (3 h, dev gameplay et sound)

- **Problème vu par le joueur**: « c'est quoi ça ? » devant la zone en pointillés; « je comprends qu'on lave la vaisselle mais ça n'est pas bien montré (manque lavabo et animation de lavage) ».
- **Solution**: un évier posé sur le plan (modèle en section 6, priorité 0; d'ici sa livraison, le modèle actuel suffit pour brancher le reste). Pendant le maintien: un filet d'eau au robinet, de la mousse dans le bac, la pile sale qui baisse pièce par pièce et la pile propre qui monte sur l'égouttoir, avec les sons existants (`tap-loop`, `dish-wash`, `dish-rack`). La zone en pointillés disparaît. Pas de physique (C12): l'eau et la mousse sont deux formes animées.
- **Fichiers ou données**: `src/rendu/monde3d.ts`, `assets/modeles/station_sink.glb` et sa source dans `assets-src/modeles/`, `donnees/service/reglages.json` (`wash`), `src/audio/espace.ts`, `assets/son/sons.json`.
- **Critère d'acceptation**: en lavant quatre pièces, la pile sale affichée passe de 4 à 0 et la pile propre de 0 à 4, une pièce toutes les 1,5 s (test sur l'état de la vue); l'eau et la mousse ne sont visibles que pendant le maintien (deux captures); `tap-loop` s'arrête moins de 0,3 s après le relâchement; plus aucun pointillé sur la capture de la plonge.

#### 11. Vitrine garnie, réserve qui se remplit (5 h, dev gameplay)

- **Problème vu par le joueur**: « le truc qui sert de la bouffe, c'est incompréhensible, déjà on voit pas la bouffe, on sait pas comment s'en servir ». Et, côté réserve, un carton rangé disparaît sans laisser de trace. Dans le genre, le rayon qui se remplit puis se vide est le cœur du plaisir.
- **Solution**: la vitrine montre son stock réel: une rangée par produit (croissants, pains au chocolat, parts de tarte), une pièce affichée par pièce en stock jusqu'à huit par rangée, une étiquette de prix devant (`price_tag.glb` existe). On vise la viennoiserie voulue et l'invite la nomme (« Servir un croissant »); une rangée vide affiche « Plus de croissants ». Même principe en réserve et au réfrigérateur: chaque ingrédient a sa place sur l'étagère et y montre de une à six unités selon le stock (bouteilles de lait, sac de grains, boîtes de thé; modèles en section 6, priorité 1, cartons marqués en attendant). Affichage par instances, avec un plafond réglable pour la machine de référence.
- **Fichiers ou données**: `src/rendu/monde3d.ts`, `src/rendu/correspondances.ts`, `src/branchement/interface.ts`, `donnees/meubles.json` (emplacements), `donnees/service/reglages.json` (`storage`, nouvelle table d'affichage: unités par pièce visible, maximum par rangée), `donnees/SCHEMA.md`.
- **Critère d'acceptation**: avec six croissants en stock, six sont visibles dans la vitrine; après un service, cinq, sur les deux écrans en moins de 0,5 s; à zéro, la rangée est vide et l'invite dit « Plus de croissants »; ranger un carton de lait ajoute au moins une bouteille visible au réfrigérateur; le nombre d'instances affichées ne dépasse jamais le plafond des réglages (test).

#### 12. Les envies du jour (4 h, dev gameplay et UX)

- **Problème vu par le joueur**: une fois le guide de Simone terminé, le service n'a qu'un but, « servir tout le monde », le même chaque jour. Le genre donne toujours deux ou trois petites cases à cocher dans les minutes qui viennent.
- **Solution**: à l'ouverture, trois petits mots épinglés sur un tableau de liège près de la caisse (et rappelés dans le téléphone): des envies de voisins. Règles:
  - elles sont tirées après l'écriture de l'ardoise, parmi celles que l'ardoise du jour rend possibles;
  - familles: vendre N fois un produit, servir à un habitué nommé sa boisson préférée, ne laisser personne debout plus de X secondes, finir le service sans vaisselle sale, servir N groupes en terrasse;
  - elles sont communes aux deux joueurs et se cochent d'un trait de crayon sur les deux écrans;
  - une envie non comblée disparaît le soir, sans son ni commentaire;
  - chaque envie comblée compte pour 3 groupes servis dans le compteur du paquet du matin (13); sans le 13, elle vaut une ligne signée au livre d'or;
  - elles se sauvegardent avec la journée; une déconnexion ne les change pas.
- **Fichiers ou données**: nouveau `donnees/clientele/envies.json` (familles, seuils par palier, textes), `donnees/SCHEMA.md`, `src/clientele/journee.ts`, `src/clientele/clients.ts`, `src/branchement/interface.ts`, `src/interface/hud.ts`, `src/interface/bilan.ts`, `donnees/clientele/textes.json`.
- **Critère d'acceptation**: sur 50 graines, l'ouverture tire exactement trois envies, toutes réalisables avec l'ardoise du jour (produit présent, terrasse possédée, habitué attendu); une envie « dix cappuccinos » se coche à la dixième vente sur les deux écrans; une envie non comblée ne produit ni son ni texte le soir; sur la simulation du duo médian, 1,5 à 2,5 envies sont comblées par jour en moyenne.
- **À simuler avant de coder**: les seuils N et X par palier, avec `demo/simulations/demo_v0_1.py`, pour tenir la cible de deux envies sur trois.

#### 13. Le paquet du matin (6 h, dev gameplay et artiste 3D)

- **Problème vu par le joueur**: entre deux paliers, il se passe une heure de jeu sans nouveauté. On ne se dit pas « encore un jour ».
- **Solution**: les voisins remercient. Règles:
  - un compteur commun de groupes servis depuis le début de la partie;
  - douze seuils en données; valeurs de départ 5, 15, 30, 55, 85, 110, 140, 170, 205, 240, 275, 310, soit un paquet par jour de service pour le duo médian (jours 2 à 7, puis 9 à 14), le premier dès le premier service;
  - le soir où un seuil est franchi, le bilan l'annonce (« Demain matin, un paquet sur le seuil »); le lendemain, un paquet ficelé attend devant la porte;
  - on l'ouvre à deux, chacun tirant un bout de la ficelle (maintien simultané, comme la pancarte); si un seul tire, la ficelle se tend et attend, sans limite de temps;
  - un seul paquet par matin; un deuxième seuil franchi le même jour attend le matin suivant;
  - le contenu suit un ordre fixe en données (pas de tirage): 5 objets à poser qui ne s'achètent pas, 3 recettes ou variantes (dont la théière, « un thé pour deux »), 3 lots d'ingrédients, 1 photo pour le livre d'or;
  - viser la caisse affiche « encore N clients avant le prochain paquet »;
  - le compteur et les paquets en attente se sauvegardent en fin de journée.
- **Fichiers ou données**: nouveau `donnees/clientele/paquets.json`, `donnees/SCHEMA.md`, `donnees/catalogue.json` (objets non achetables), `src/clientele/journee.ts`, `src/installation/` (geste à deux), `src/rendu/monde3d.ts`, `src/interface/bilan.ts`, `donnees/clientele/textes.json`, sons existants `carton-open` et `event-fanfare`; modèles en section 6, priorité 2.
- **Critère d'acceptation**: sur la simulation du duo médian (12 jours de service), 12 paquets sont remis, jamais plus d'un par matin, le premier au lendemain du premier service; un joueur seul ne peut pas ouvrir le paquet (test), deux maintiens simultanés l'ouvrent; le contenu du paquet n correspond à la ligne n des données; compteur et paquets en attente survivent à une sauvegarde suivie d'un rechargement.
- **Preuve de la cadence**: seuils calculés sur la table 6.4 de `demo/demo-v0-1.md` (groupes servis par jour: 23, 28, 21, 30, 30, 28, 28, 34, 34, 35, 36, 44), les quatre premiers jours ramenés à la montée en charge de la 0.2.3 (7 groupes, puis 0,5, 0,7 et 0,85 de la valeur), ce qui donne un cumul de 7, 21, 36, 62, 92, 120, 148, 182, 216, 251, 287, 331. Chaque seuil tombe dans un jour différent. À recaler avec `demo/simulations/demo_v0_1.py` avant de coder: la table 6.4 date d'avant la montée en charge.

#### 14. Des postes qu'on reconnaît (6 h et 120 à 240 crédits, artiste 3D avec Meshy)

- **Problème vu par le joueur**: neuf remarques sur dix-huit sont des « c'est quoi ? ». La vitrine est une boîte beige vide, la bouilloire un dôme vert, la plonge n'a pas d'évier, le réfrigérateur est un bloc blanc, le plan de préparation une étagère métallique.
- **Solution**: produire les huit modèles de priorité 0 de la section 6 avec la chaîne de `docs/production/meshy.md` (image de référence dans le style de la bible, image vers 3D en topologie intelligente, mise en conformité par script: échelle, palette, budgets C8, fiche de génération). Les dimensions et les points d'ancrage des modèles actuels sont conservés, pour ne toucher à aucune donnée d'aménagement. Chaque modèle se juge d'abord à sa silhouette, à 3 m, sans texte.
- **Fichiers ou données**: `assets/modeles/station_vitrine.glb`, `station_bouilloire.glb`, `station_sink.glb`, nouveaux `station_prep.glb`, `frigo_armoire.glb`, `etagere_reserve.glb`, `etagere_reserve_longue.glb`, `palette_livraison.glb`; `assets/modeles/modeles.json`; fiches de génération à côté de chaque modèle; `src/rendu/correspondances.ts` (cinq entrées de `FURNITURE_MODEL` à relier, au moment de l'intégration par le dev).
- **Critère d'acceptation**: épreuve du « c'est quoi ? »: une capture de chaque modèle seul, à 3 m, sous la lumière du jeu, est montrée sans légende à un membre qui ne connaît pas la liste; il nomme correctement les huit. Le validateur des budgets C8 passe; aucun meuble de l'aménagement par défaut ne tombe sur un bloc de substitution; la vitrine passe sous l'étagère sans la toucher (contrôle du 9); solde de crédits relevé avant et après.

#### 15. Le village vit (8 h en deux lots, tech-artist et dev gameplay)

- **Problème vu par le joueur**: « le village est désert en extérieur, et la luminosité n'évolue pas de la journée ».
- **Solution, lot A, la lumière suit l'heure (tech-artist, 4 h)**: la lumière reste cuite (C10, C11: ni ombre ni reflet en direct), mais sa teinte et son intensité suivent une courbe réglée sur l'horloge du jeu, comme `src/rendu/cafe-ferme.ts` sait déjà le faire pour le café fermé: matin doré, midi clair, fin d'après-midi chaude, soir bleuté. Le ciel change avec elle. Avant la fermeture, les lampes du café et les lanternes de la place s'allument (matière émissive, sans lumière réelle de plus: C9).
- **Solution, lot B, des passants sur la place (dev gameplay, 4 h)**: chaque groupe que la simulation fait déjà passer devant le café (`clientele-passed-by`) traverse la place à pied, s'arrête devant l'ardoise 2 à 4 s, puis entre ou repart. Plafond réglable (6 passants à la fois au départ), sous les limites C1 (40 personnages animés) et C2 (24 au village). Trois petites scènes sans enjeu en plus (le facteur à vélo, le chat sur le rebord, la cloche de midi).
- **Fichiers ou données**: lot A: `src/rendu/cafe-ferme.ts`, `src/rendu/scene.ts`, `src/rendu/coque-glb.ts`, `donnees/reglages.json` (courbe par heure). Lot B: `src/clientele/rendu3d.ts`, `src/clientele/places.ts`, `src/clientele/clients.ts`, `donnees/clientele/regles.json` (plafond, durées), `donnees/adresses/` (chemins de la place).
- **Critère d'acceptation, lot A**: quatre captures prises du même point à l'ouverture, à midi, à 16 h et à la fermeture: la luminance moyenne du soir vaut au plus 75 % de celle de midi et le rapport rouge sur bleu du soir au moins 1,15 fois celui de midi; aucune variation de plus de 2 % entre deux images successives; budget de 12 programmes WebGL tenu.
- **Critère d'acceptation, lot B**: sur 3 min de service simulé, chaque événement `clientele-passed-by` produit un passant affiché; le nombre de passants ne dépasse jamais le plafond et le total de personnages reste sous 24; un passant qui repart s'est arrêté 2 à 4 s devant l'ardoise.
- **À noter**: les deux lots sont indépendants et peuvent sortir deux soirs différents. Le coût sur la machine de référence ne se mesure que chez le client.

### 5.4 Écartées des 15, à garder pour la suite

| Idée | Pourquoi pas maintenant |
|---|---|
| Le geste du thé en un seul maintien (viser la bouilloire tasse en main, maintenir, relâcher dans la zone) | le vite fait 1 retire l'essentiel de la gêne; à rejuger après une séance |
| Un bilan dont les chiffres montent, avec les records du duo | agréable, mais le bilan est refait par le 7: à faire dans la foulée |
| La chaîne du matin (se passer les cartons) | dépend du 6 et du 8 |
| La photo du lundi | demande un point de vue extérieur soigné, donc le lot A du 15 |
| Laver à deux (l'un lave, l'autre range) | dépend du 10 |
| Des mains visibles (Q13 du cahier) | prévu à l'alpha; le 8 apporte déjà l'objet tenu |

## 6. Modèles 3D à produire ou à refaire avec Meshy

État de départ: 15 personnages Meshy (`char_*`), tout le reste modélisé par script Blender en formes simples. Dans le genre, ce sont les postes et les produits que l'on regarde de près toute la partie: c'est là que l'écart visuel se voit.

Règles communes à toute la liste:

- chaîne et coûts de `docs/production/meshy.md`: image vers 3D en topologie intelligente, 15 crédits par essai, mise en conformité par script (échelle, palette de la bible, budgets C8), fiche de génération à côté de chaque modèle;
- les cotes font foi dans `donnees/meubles.json` et `donnees/objets.json`: un modèle refait garde les dimensions et les ancrages de celui qu'il remplace;
- un objet se reconnaît à sa silhouette à 3 m, puis se regarde de près: rien qui dépasse, flotte ou traverse (règle du sens du détail);
- les formes très simples (étagère, palette, vaisselle de révolution) restent mieux servies par un script, sans crédit: elles sont signalées;
- les crédits sont comptés à un ou deux essais par modèle en priorité 0, un à un et demi en moyenne ensuite; le solde se relève au début et à la fin de chaque lot.

### 6.1 Priorité 0: ce que le joueur n'a pas reconnu (8 modèles, 120 à 240 crédits)

À lancer en premier: c'est l'amélioration 14.

| # | Modèle | Sert à | Fichier actuel | À quoi on doit le reconnaître |
|---|---|---|---|---|
| 1 | Vitrine de comptoir | poste `vitrine` | `station_vitrine.glb`, à refaire | vitre bombée, deux niveaux, fond clair éclairé, trois rangées avec porte-étiquettes; passe sous l'étagère |
| 2 | Bouilloire à col de cygne sur son socle | poste `bouilloire` | `station_bouilloire.glb`, à refaire | bec, anse, cadran à aiguille lisible de face (c'est la jauge du geste) |
| 3 | Évier de plonge | poste `plonge` | `station_sink.glb`, à refaire | bac en inox, robinet haut, égouttoir avec place pour une pile propre, emplacement de pile sale |
| 4 | Plan de préparation | poste `frigo-sous-plan` | aucun modèle | meuble bas réfrigéré à deux portes, planche à découper, couteau, deux bacs |
| 5 | Réfrigérateur de réserve | meuble `frigo-armoire` | aucun (bloc blanc) | armoire en inox, poignée longue, porte vitrée pour voir le stock (11) |
| 6 | Étagère de réserve | meuble `etagere` | aucun (bloc) | quatre niveaux en bois, montants visibles; par script de préférence |
| 7 | Étagère longue | meuble `etagere-longue` | aucun (bloc) | la même en double largeur; par script de préférence |
| 8 | Palette de livraison | meuble `palette-livraison` | aucun (bloc) | palette de bois aux planches disjointes; par script de préférence |

### 6.2 Priorité 1: ce qu'on vend, ce qu'on range, les postes vedettes (24 modèles, 405 à 585 crédits)

Sert les améliorations 3, 8 et 11.

| # | Modèle | Sert à | Fichier actuel | Remarque |
|---|---|---|---|---|
| 9 | Croissant | vitrine, assiette | `food_croissant.glb`, à refaire | feuilletage et dorure lisibles dans la vitrine |
| 10 | Pain au chocolat | vitrine, assiette | `food_pain_chocolat.glb`, à refaire | les deux barres visibles en bout |
| 11 | Tarte aux fruits (entière et part) | vitrine, assiette | `food_tarte_fruits.glb`, à refaire | la tarte entière se vide part par part |
| 12 | Tartine | plan de préparation | `food_tartine.glb`, à refaire | pain de campagne, beurre, confiture |
| 13 | Crêpe | crêpière | `food_crepe.glb`, à refaire | pliée en triangle, sucre visible |
| 14 | Bouteille de lait | `lait-entier`, `lait-avoine` | aucun | verre et capsule; variante de teinte pour l'avoine |
| 15 | Sac de grains | `grains-maison` | aucun | toile de jute, étiquette de la maison |
| 16 | Boîte à thé | `the-noir`, `the-vert` | aucun | métal peint; deux teintes |
| 17 | Bocal de plantes | `plantes-simone` | aucun | bocal à joint, étiquette manuscrite |
| 18 | Cagette d'agrumes | `oranges`, `citrons` | aucun | deux variantes de fruits |
| 19 | Sac de farine | `farine`, `sucre` | aucun | papier kraft; deux étiquettes |
| 20 | Pot de confiture | `confiture` | aucun | couvercle en tissu |
| 21 | Boîte d'œufs | `oeufs` | aucun | carton ouvert, six œufs |
| 22 | Motte de beurre | `beurre` | aucun | papier plié |
| 23 | Bouteille de limonade | `limonade-bouteille` | aucun | bouchon mécanique |
| 24 | Pain de campagne | `pain-campagne` | aucun | miche entamée |
| 25 | Botte de menthe | `menthe` | aucun | dans un verre d'eau |
| 26 | Boîte de cacao | `cacao` | aucun | boîte ronde en métal |
| 27 | Machine à espresso à deux groupes | poste central | `station_espresso_2g.glb`, à refaire | c'est l'objet le plus regardé du jeu: groupes, buse, manomètre, chauffe-tasses |
| 28 | Moulin à café | poste `moulin` | `station_grinder.glb`, à refaire | trémie transparente où l'on voit les grains |
| 29 | Caisse enregistreuse | poste `caisse` | `station_caisse.glb`, à refaire | tiroir, afficheur lisible (5) |
| 30 | Rail à tickets | poste `rail-tickets` | `station_ticket_rail.glb`, à refaire | barre et pinces visibles depuis la caisse (9) |
| 31 | Étagère à tasses | poste `pile-tasses` | `station_cup_shelf.glb`, à refaire | les piles se lisent d'un coup d'œil |
| 32 | Lave-vaisselle | poste `lave-vaisselle` | `station_dishwasher.glb`, à refaire | porte, panier, voyant |

En plus, sans modèle nouveau: un repos calme de la bibliothèque d'animations pour les 15 personnages (3 crédits chacun, 45 crédits, compris dans le total) si le vite fait 3 ne suffit pas; des pictogrammes sur les cartons `crate_box_s`, `m` et `l` (par script, sans crédit); le contenu des tasses et des verres (mousse, thé, citronnade) en matières, par script.

### 6.3 Priorité 2: le décor, les passants, les cadeaux (17 modèles, 315 à 475 crédits)

Sert les améliorations 12, 13 et 15.

| # | Modèle | Sert à | Remarque |
|---|---|---|---|
| 33 | Théière | récompense « un thé pour deux » (13) | `ware_teapot.glb`, à refaire; le reste de la vaisselle (`ware_*`) reste en script, ses formes simples conviennent |
| 34 | Fontaine de la place | décor (15) | le centre de la place: on s'y donne rendez-vous |
| 35 | Banc public | décor (15) | deux ou trois, tournés vers la fontaine |
| 36 | Réverbère | décor (15, lot A) | s'allume le soir |
| 37 | Vélo du facteur | scène de place (15, lot B) | sacoches |
| 38 | Chat | scène de place (15, lot B) | assis sur le rebord, une seule pose |
| 39 | Étal de marché | décor des jours de marché | toile rayée, cagettes |
| 40 | Facteur | passant (15, lot B) | personnage: environ 35 crédits avec squelette et marche |
| 41 | Grand-mère au cabas | passante | personnage |
| 42 | Enfant au cartable | passant de la sortie d'école | personnage; proportions à vérifier au squelette |
| 43 | Paquet ficelé | le paquet du matin (13) | papier kraft, ficelle à deux bouts bien visibles |
| 44 | Bouquet séché sous cloche | cadeau 1 (13) | objets qui ne s'achètent pas |
| 45 | Coq en faïence | cadeau 2 (13) | |
| 46 | Nichoir peint | cadeau 3 (13) | |
| 47 | Broderie encadrée aux deux tabliers | cadeau 4 (13) | |
| 48 | Bonbonnière en verre | cadeau 5 (13) | |
| 49 | Tableau de liège | les envies du jour (12) | trois mots épinglés lisibles |

### 6.4 Total

| Priorité | Modèles | Crédits estimés | Dépend de |
|---|---|---|---|
| 0 | 8 | 120 à 240 | rien: à lancer tout de suite |
| 1 | 24 (et 15 animations) | 405 à 585 | 11 pour les produits |
| 2 | 17 | 315 à 475 | 12, 13, 15 |
| Total | 49 | 840 à 1 300 | solde à relever avant chaque lot |

Les clients actuels ne sont pas à refaire: ce sont déjà des modèles Meshy, et la seule remarque de la séance à leur sujet vise l'animation de repos.

## 7. Garde-fous: ce qu'on ne copie pas, ce qu'on ne touche pas

**Originalité.** Chaque proposition répond à un principe du genre avec un moyen propre au jeu:

| Principe du genre | Ce qu'on ne reprend pas | La réponse de Deux Tabliers |
|---|---|---|
| Encaisser | scanner des articles, rendre la monnaie | écouter le client parler, l'annoncer à voix haute à son partenaire |
| Débloquer souvent | niveaux de boutique, licences à acheter | des paquets laissés par les voisins, ouverts à deux |
| Objectifs courts | liste de tâches du gérant | trois envies de voisins épinglées, qui s'effacent sans reproche |
| Stock visible | rayons de supermarché à prix affichés article par article | une vitrine de café et une réserve; les prix restent sur l'ardoise |
| Monde vivant | rue passante générique | les passants sont ceux que l'ardoise attire ou laisse repartir |

**Ce qui reste intact** (principes du cahier, à ne pas entamer en cherchant à ressembler au genre):

- pot commun: aucun montant, aucune envie, aucun paquet n'est attribué à un joueur;
- aucun son ni signe ne juge un geste ou ne montre un client déçu (`son.md`);
- la réputation ne baisse jamais, pas de faillite, une envie manquée ne coûte rien;
- HUD minimal: tout ce qui est ajouté est éphémère ou porté par un objet du café;
- les aides sont propres à chaque joueur et invisibles pour l'autre;
- contraintes techniques C1, C2, C9 à C12 et C22 respectées par chaque proposition (personnages, lumières, ombres, physique, caméra).

**Les atouts à garder**, que le genre n'a pas: l'ardoise qui choisit la clientèle, les habitués et leurs événements, les fournisseurs en personne, les gestes portés à deux, le départ en cellule vide. Le plan ne retire rien de cela: il le rend visible.

## 8. Ordre de production proposé

Par mises à jour du soir, deux ou trois membres en parallèle. Le classement de la section 5 donne la priorité à effort égal; l'ordre ci-dessous tient compte des dépendances (les modèles sont longs à produire et débloquent les chantiers 10 et 11).

| Soir | Livré | En parallèle, pour la suite |
|---|---|---|
| 1 | 1 (thé), 2 (commande dite), 3 (clients au calme), 7 (premiers jours) | l'artiste 3D lance la priorité 0 de Meshy (14) |
| 2 | 4 (noms des postes), 5 (sous qui tombent), 6 (cartons), 9 (rien ne flotte) | suite de la priorité 0; simulation des envies et des paquets |
| 3 | 14 (postes refaits), 10 (plonge), 8 (objet tenu) | priorité 1 de Meshy: nourriture et produits |
| 4 | 11 (vitrine garnie et réserve) | lot A du 15 |
| 5 | 15, lots A et B | priorité 1 de Meshy: postes vedettes |
| 6 et 7 | 12 (envies du jour), puis 13 (paquet du matin) | priorité 2 de Meshy |

Deux séances du client sont utiles: après le soir 2 (la prise de commande et les noms suffisent-ils à rendre le jeu intuitif ?) et après le soir 4 (le café se lit-il sans aide ?). Les chantiers 12 et 13 ne se lancent qu'après la première, et après simulation de leurs seuils.

## 9. Questions pour le client

| # | Question | Recommandation |
|---|---|---|
| EM-Q1 | Le thé se sert-il en tasse, la théière devenant une récompense plus tard ? | Oui. C'est la remarque de la séance, et la théière gagne à être attendue. Le cahier (CO-11) prévoyait théière et tasse dès le départ. |
| EM-Q2 | La commande dite par le client n'apparaît-elle que chez celui qui encaisse ? | Oui: c'est ce qui fait parler. Une aide par joueur permet de la voir aussi chez l'autre, sans que cela se sache. |
| EM-Q3 | Accepte-t-on des montants qui s'affichent un instant à la caisse et au pot à pourboires ? | Oui. Rien ne reste à l'écran, et c'est le retour le plus attendu du genre. Les montants restent ceux du pot commun. |
| EM-Q4 | Ajoute-t-on les envies du jour et le paquet du matin à la démo ? | Oui, après les soirs 1 à 4 et une séance: d'abord rendre le jeu lisible, ensuite ajouter des récompenses. Ce sont deux ajouts au cahier. |
| EM-Q5 | Quel budget Meshy ce mois-ci ? | Priorités 0 et 1 (525 à 825 crédits), la priorité 2 le mois suivant. Le solde est à relever avant de lancer. |

## 10. Écarts avec les documents existants

| Document | Point | Écart proposé |
|---|---|---|
| `cahier-des-charges.md`, CO-11 | « une théière et sa tasse comptent pour deux » | thé en tasse, une pièce (EM-Q1) |
| `cahier-des-charges.md`, CO-01 | bulle de commande du client | aucun écart: c'est sa réalisation, avec une précision (visible chez celui qui encaisse) |
| `cahier-des-charges.md`, 5.2 | HUD minimal; pot à pourboires où tombent les pièces | montants éphémères ancrés à la caisse et au pot; rien de permanent |
| `cahier-des-charges.md`, Q13 | mains visibles à l'alpha | objet tenu affiché dès maintenant, sans mains |
| `demo/demo-v0-1.md` | contenu et rythme de la démo | deux mécaniques en plus (envies, paquets), 12 paquets et leur contenu; tables de simulation à régénérer |
| `donnees/postes.json` | libellés « Réfrigérateur et plan », « Cloche à viennoiseries » | « Plan de préparation », « Vitrine » |
| `technique.md` | contraintes C1 à C26 | aucun écart demandé |

Si le client valide, ces écarts s'inscrivent dans l'historique du cahier par le manager.
