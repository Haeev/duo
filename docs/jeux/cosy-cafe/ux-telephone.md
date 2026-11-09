# Deux Tabliers: le téléphone tenu en main

| Champ | Valeur |
|---|---|
| Statut | validée par le manager (H1, H2 en v0.2, H3), implémentée le 2026-11-08 (`src/interface/telephone.ts`); remplace la tablette de la maison (`ux.md`, 4.7, CC10) |
| Version | 0.1 |
| Date | 2026-11-08 |
| Demande du client | « Tous les menus, commandes, etc. se font sur un écran de téléphone: pense l'UI pour correspondre à celle d'un téléphone portable dans le jeu. » |
| Sources | `ux.md` (sections 0, 2.2, 4, 8, 9, 10); `src/interface/tablette.ts`, `calques.ts`, `theme.ts`; `bible-artistique.md` (section 10, rendu semi-réaliste Q17); `demo/realisme-v0-2.md`; `demo/remises-marketing-v0-2.md`; `donnees/clientele/carte.json`, `fournisseurs.json` |
| Maquettes | `design/maquettes/cosy-cafe/telephone/telephone.html` (9 états par ancre), captures dans `captures/` |
| Vérifications | `node design/maquettes/cosy-cafe/telephone/outils/verifier.cjs` (clavier seul, débordements, contrastes, taille minimale, HUD sous le téléphone), `outils/capturer.cjs` (captures) |

## En bref

1. **Tab sort le téléphone et le range**, partout, comme la tablette aujourd'hui (même touche, même mémoire des doigts). Il monte du bas de l'écran en 180 ms, tenu dans la main droite, en portrait, un peu à droite du centre.
2. **Le café reste visible et vivant**: le téléphone n'occupe qu'un tiers de la largeur; la vue est à peine assombrie (28 %), jamais floue; le HUD (horloge, tickets, l'autre, « En main ») reste en place et à jour; l'horloge tourne. Tu restes sur place, la caméra ne bouge pas (C22).
3. **Un écran d'accueil**: la maison, « À faire », puis dix applis en grille de quatre: Commandes, Réserve, Catalogue, Carte et prix, Remises, Faire connaître, Bilans, Nos projets, Messages, Réglages.
4. **Navigation**: flèches ou Z Q S D d'un élément au voisin, Entrée ou Espace pour choisir, **Retour arrière** pour revenir d'un cran (jusqu'à ranger le téléphone), **A et E** pour l'appli voisine, molette pour faire défiler, clic à côté pour ranger. Échap reste la pause de Duo.
5. **Barre d'état** du jeu, pas d'un vrai téléphone: heure du jeu, jour, caisse. Ni batterie ni réseau: rien ne se décharge, rien ne coupe.
6. **Notifications**: téléphone sorti, une bannière en haut de l'écran du téléphone; téléphone rangé, une alerte au centre du HUD avec une vibration douce. Une proposition de l'autre ne vole jamais le focus: Entrée ouvre le téléphone directement sur elle.
7. **Messages** porte les propositions à deux (achat, action de plus de 30 €, nouvelle remise) et les nouvelles (livraisons, habitués, astuces de Simone).
8. **Restent dans le monde**: l'ardoise, le rail, la caisse, le livre d'or, les postes. **Le bilan du soir reste un écran à part** (moment partagé, café fermé), relisible ensuite dans l'appli Bilans.
9. **L'autre voit** ton personnage baisser les yeux sur son téléphone, et lit dans sa carte du HUD: « Sur son téléphone : Commandes ».

## 1. Pourquoi un téléphone, et ce qui change par rapport à la tablette

| | Tablette (aujourd'hui) | Téléphone (proposé) |
|---|---|---|
| Place à l'écran | panneau de 72 rem sur la vue assombrie à 55 % | portrait de 23 em sur 46 em au plus, la vue reste lisible |
| Disposition | sections à gauche, tableaux à six colonnes | une appli à la fois, listes en cartes, une colonne |
| Objet du monde | tablette posée derrière le comptoir | **retirée du décor** (objet sans raison d'être une fois le téléphone dans la poche); son support peut porter le livre d'or |
| Touche | Tab | Tab (inchangée) |
| Sections A et E | oui | oui (appli voisine) |
| Retour arrière | ferme la tablette | revient d'un cran, puis range |

Raison d'être dans le monde: Simone tenait ses comptes sur « l'appli de la maison »; chaque joueur l'a sur son propre téléphone. Les deux peuvent donc regarder en même temps, chacun le sien. Réplique de Simone à la première visite (remplace celle de la tablette): « Tout est dans vos téléphones : les commandes, la réserve, la carte. Moi, je préférais le carnet, mais bon. »

## 2. Le téléphone en main, en vue subjective

### 2.1 Sortir et ranger

| Moment | Ce qui se passe |
|---|---|
| Tab (ou clic sur l'appli d'une notification) | le personnage s'arrête; le pointeur est rendu (C20); le téléphone monte du bas, rotation de 6° à 0°, de 70 % de sa hauteur à sa place, 180 ms, sortie douce (`cubic-bezier(.2,.8,.3,1)`); la vue s'assombrit de 0 à 28 % dans le même temps |
| Rangé (Tab, Retour arrière à l'accueil, clic à côté, bouton « Retour » à l'accueil) | le chemin inverse, 150 ms; le pointeur est repris sans clic (C20) |
| Réduire les animations (Duo) | apparition et disparition sans mouvement ni fondu |
| Anti-double-appui | Entrée, Espace et E ignorés 300 ms après la sortie (comme `calques.ts`) |
| Les mains pleines | autorisé: l'objet tenu reste dans la main gauche, hors du cadre; « En main » le dit toujours. Rien ne tombe, rien ne refroidit plus vite (P8) |
| Pendant un geste (maintien, versement) | Tab attend la fin du geste: le téléphone sort juste après (pas de geste coupé) |
| Réouverture | le téléphone revient sur l'écran laissé, avec son défilement; après la nuit, sur l'accueil |

Son: un frottement de tissu très court à la sortie, rien au rangement (à confier à sound-designer, famille des sons d'interface du jeu, ux.md 9.6).

### 2.2 Position et taille

Mesures relevées par `verifier.cjs` (téléphone entier, coque comprise):

| Écran (points logiques) | Taille du texte de Duo | Police du téléphone | Téléphone |
|---|---|---|---|
| 1280 x 720 | 100 % | 16 px | 368 x 622 |
| 1366 x 768 (portable) | 100 % | 16 px | 368 x 670 |
| 1366 x 768 | 150 % | 24 px | 552 x 620 (jeu: 512 x 626, voir plus bas) |
| 1920 x 1080 | 100 % | 20 px | 460 x 920 |

Règles CSS (reprises telles quelles dans le jeu):

```css
.tel {
  font-size: max(1rem, min(calc(100vh / 54), 1.25rem)); /* 1rem = 16 px x taille du texte de Duo */
  width: min(23em, 46vw);
  height: min(46em, calc(100vh - 5.4rem - 0.75rem));    /* sous la bande haute du HUD */
  left: 54%; bottom: 0.75rem; transform: translateX(-50%);
}
```

- **Pourquoi à 54 %**: tenu dans la main droite, un téléphone se porte un peu à droite du regard; le téléphone tombe entre la colonne des tickets (à gauche) et « En main » (coin bas droit), sous l'alerte du centre et la carte de l'autre (en haut). Vérifié: aucune capsule du HUD sous le téléphone, aux quatre tailles.
- **Pourquoi plus grand en 1080p**: à 16 px, un téléphone de 670 px dans un écran de 1080 se lit moins bien que sur le portable; la police monte avec la hauteur jusqu'à 20 px.
- **Taille du texte à 125 et 150 %**: le texte grossit, le téléphone s'élargit (jusqu'à 46 % de la largeur) et sa hauteur reste bornée par l'écran; la proportion passe de 1:1,8 à 1:1,1. On garde la lisibilité plutôt que la silhouette.
- **Écrans Retina et Windows à 150 %**: tout est en unités CSS, la netteté vient du facteur d'échelle (captures à 2x examinées).
- **Rien sous 14 px** dans le téléphone (contrôlé).
- **Dans le jeu**, la largeur est aussi bornée pour ne jamais passer sur « En main » (coin bas droit du HUD, plus large que dans la maquette): `min(23em, 46vw, 2 x (46vw - 15,5 em du HUD))`, soit 512 px à 1366 x 768 et 150 % (vérifié par `games/deux-tabliers/outils/telephone/verifier.cjs`).

### 2.3 Le café autour

- Vue assombrie de 28 % seulement, sans flou (bible: aucun flou); les clients bougent, l'autre joueur passe, les tickets arrivent sur le rail.
- Le HUD reste au-dessus de la vue et à côté du téléphone, à jour: horloge, tickets (« attend depuis 2 min »), alertes douces, carte de l'autre, « En main ». Les sons du café continuent; les repères visuels des sons (ux.md 8.6) aussi.
- Le personnage ne marche pas (Z Q S D servent au téléphone); la caméra ne bouge pas.
- Aide des touches dans une capsule à gauche du téléphone (et non dedans: la place de l'écran est précieuse); elle se masque avec le réglage « Afficher l'aide des touches » (Réglages, pour toi), comme les autres aides du jeu.

### 2.4 La coque et la main

- Coque en noyer et liseré de laiton, reprise de l'objet tablette de la bible (section 10), écran expresso: un objet original, sans bouton physique, encoche, caméra ni logo. Coins de 2,1 em.
- Main droite: quatre bouts de doigts sur le bord gauche, le pouce sur le bord droit, sous l'écran. Dans la maquette, une forme provisoire; dans le jeu, **une image rendue depuis le modèle des mains en vue subjective** (artiste-3d), teintée à la peau de l'avatar, posée dans la couche HTML avec le téléphone pour rester alignée à toutes les tailles. Sans image, la coque seule suffit.
- Nouvelle pose « téléphone » pour l'avatar vu par l'autre (section 8), dans la liste des poses de la bible (section 5).

## 3. Écran et composants communs

### 3.1 Barre d'état

`17 h 25   mar. 9                    [caisse] Caisse 486 €`

- Heure du jeu (format du jeu, « 17 h 25 »), jour abrégé, caisse disponible. Pendant une proposition d'achat ou une commande mise de côté, l'appli concernée détaille « dont 45 € réservés »; la barre garde le total.
- Pas de batterie, pas de réseau, pas d'heure réelle: le téléphone ne crée aucune contrainte que le jeu n'a pas.
- Nom accessible: « Barre d'état »; elle ne prend jamais le focus.

### 3.2 Barre du bas

Deux boutons toujours là: « Retour » (même effet que Retour arrière) et « Accueil ». Ils ne défilent pas.

### 3.3 Tête d'appli

Pastille de l'appli, titre en Jost; elle reste collée en haut quand on fait défiler (on sait toujours où on est, même quand le focus par défaut est plus bas).

### 3.4 Composants et états

| Composant | États | Notes |
|---|---|---|
| Pastille d'appli | repos, survol (liseré crème second), focus (anneau or), badge (nombre, crème sur expresso) | rond émaillé de couleur claire, icône au trait expresso (grille de 24, trait de 1,9); le nom est toujours écrit dessous; la couleur n'est jamais seule à distinguer une appli |
| Tâche « À faire » | repos, survol, focus | rangée entière cliquable: icône, texte, action en or, chevron |
| Bouton | normal, principal (or), lien, inactif (pointillés, dit pourquoi à côté) | ceux de `theme.ts` (`dt-btn`, `dt-btn-primary`) |
| Pas à pas (− valeur +) | normal, inactif (ligne tenue par l'autre) | noms accessibles « Moins de croissants », « Monter le prix du café crème » |
| Interrupteur | coupé (piste vide, « Coupée »), actif (piste verte, « Active »), inactif | `role="switch"`, l'état est aussi écrit |
| Puce de choix | non choisie (contour), choisie (fond crème) | taux, jours |
| Carte | pleine, lue (sans fond: rien à faire), en attente (pointillés: proposition en cours) | |
| Alerte douce | icône or et texte | toujours une raison et quoi faire |
| Ligne tenue par l'autre | filet à la couleur de l'autre à gauche, jeton et « Sacha modifie cette ligne », pas à pas inactifs | jamais la couleur seule |
| Bannière | crème sur expresso, 5 s puis rangée dans Messages; survol: pause du délai | clic ou Entrée quand elle a le focus: ouvre l'appli concernée |
| Barre collante | total et action principale toujours visibles en bas | ombre de la couleur du fond pour masquer ce qui passe dessous |

### 3.5 Couleurs et contrastes (WCAG, calculés)

| Texte | Fond | Contraste |
|---|---|---|
| crème `#F6EEDF` | expresso `#2B211C` | 13,6:1 |
| crème second `#CDBBA6` | expresso | 8,4:1 |
| crème second | carte `#3A2D26` | 7,1:1 |
| expresso | or `#FFC857` (bouton principal) | 10,2:1 |
| or (action d'une tâche, focus) | expresso | 10,2:1 |
| succès `#6BD69A` | carte `#3A2D26` | 7,4:1 |
| ambre `#F2B94B` (à finir demain, bouclage) | carte `#3A2D26` | 7,5:1 |
| expresso (icône) | pastilles d'appli (la moins contrastée, `#F2B8A0`) | 9,1:1 |

Le vérificateur parcourt tous les textes visibles des sept écrans, aux quatre tailles: aucun sous 4,5:1. Anneau de focus: 3 px or, décalé de 2 px, doublé d'expresso (visible sur les cartes comme sur les pastilles claires). Couleurs des joueurs: toujours dans leur jeton (disque de nuit cerclé d'encre) avec le prénom.

## 4. Navigation

### 4.1 Touches

| Touche (position) | Téléphone rangé | Téléphone sorti |
|---|---|---|
| Tab | sortir le téléphone | ranger le téléphone |
| Entrée | si une proposition attend: sortir le téléphone sur Messages, focus sur « D'accord » | choisir |
| Espace | agir dans le monde | choisir |
| flèches, Z Q S D (`KeyW`, `KeyA`, `KeyS`, `KeyD`) | marcher | élément voisin, par navigation spatiale |
| A et E (`KeyQ`, `KeyE`) | (A ne sert pas, E agit) | appli précédente, suivante, dans l'ordre de l'accueil, en boucle |
| Retour arrière | | revenir d'un cran: détail, appli, accueil, puis ranger |
| Origine (`Home`) | | accueil (raccourci de confort; absent des claviers de Mac, jamais indispensable) |
| Échap | pause de Duo | pause de Duo; le téléphone reste sorti dessous, le focus revient où il était |
| Maj+Tab | | rien (évite de ranger par erreur) |

- Pas de raccourci sur la rangée des chiffres (règle du jeu, ux.md 9).
- Navigation spatiale: distance de bord à bord dans l'axe, plus deux fois l'écart de centre en travers (carnet du studio). Les flèches haut et bas sortent d'un champ d'une ligne.
- Une touche maintenue n'agit qu'une fois; anti-double-appui de 300 ms à la sortie.

### 4.2 Souris

- Clic: choisir. Clic hors du téléphone: le ranger (comme « clic à côté » des interfaces posées). La vue ne tourne pas: le pointeur est libre.
- Molette au-dessus du téléphone: faire défiler l'appli; ailleurs: rien.
- Survol: liseré crème second sur ce qui se clique.

### 4.3 Focus par défaut

| Écran | Focus par défaut |
|---|---|
| Accueil | première tâche « À faire », sinon la dernière appli ouverte |
| Commandes | « Commander pour mercredi » (barre collante) |
| Réserve | « Dépanner » de la première ligne en rupture, sinon la première ligne |
| Catalogue | premier article achetable |
| Carte et prix | « Baisser le prix » de la première ligne |
| Remises | interrupteur de l'heure douce |
| Faire connaître | « Répondre à Sacha » si une action attend ta réponse, sinon le premier « Lancer ce soir » |
| Bilans | le dernier bilan |
| Nos projets | premier projet |
| Messages, fil avec une proposition | « D'accord » |
| Messages, liste | première conversation non lue |
| Réglages | premier réglage |

Le conteneur défile pour montrer le focus (jamais la page); la tête d'appli reste visible.

## 5. Notifications

| Événement | Téléphone sorti | Téléphone rangé | Son |
|---|---|---|---|
| Proposition de l'autre | bannière « Proposition de Sacha · Un encart dans L'Écho, 45 € » | alerte du HUD au centre: « Téléphone · Sacha propose : un encart dans L'Écho, 45 € · Entrée voir et répondre », deux petites secousses (aucune avec « Réduire les animations ») | sonnerie douce des propositions (ux.md 2.2) |
| Livraison (matin, dépannage) | bannière « Livraison de Lucas · Le dépannage de croissants est à la porte de service. » | alerte du HUD « Téléphone · Livraison de Lucas à la porte de service », 4 s | vibration courte (deux impulsions sourdes), distincte de la sonnerie |
| Habitué qui arrive | bannière « Bastien arrive · Il prendra sans doute un crème, comme d'habitude. » | alerte du HUD, 4 s | vibration courte |
| Réponse à ta proposition | bannière « Sacha a dit d'accord : un encart dans L'Écho, lancé ce soir. » ou « Sacha préfère attendre : rien n'a été dépensé. » | alerte du HUD, 4 s | celui de la validation, ou rien pour un refus |
| Astuce de Simone | rien en bannière; un badge sur Messages | rien | rien |

Règles: aucune notification ne prend le focus (P5); une seule bannière à la fois, les suivantes attendent 1 s; toutes restent dans Messages; badge de Messages = messages non lus; pastille de l'accueil « À faire » = propositions à répondre plus commande pas encore passée (comme `todoCount` de `tablette.ts`). La vibration ne se joue jamais pendant la pause de Duo.

## 6. Les applis

L'ordre de la grille suit la journée: ce qu'on fait chaque soir d'abord (Commandes, Réserve), puis ce qu'on règle de temps en temps, puis ce qu'on relit. **Équipe** (dès la ville) et **Nos cafés** (dès le deuxième café) s'ajoutent après Nos projets le jour où ils existent, avec la bannière « Nouvelle appli : Équipe ».

Règle des changements pendant le service (hypothèse H1, section 11): ce qui touche la carte, les prix et les remises se prépare à tout moment et **prend effet à la prochaine ouverture**; une commande se modifie jusqu'à la fermeture à clé (inchangé); une action se lance pour ce soir.

### 6.1 Accueil (maquette `#accueil`)

- Tête: emblème de la maison (pastille aux couleurs de la maison), « La Tasse Bleue », « place du Tilleul · Ormeval ».
- « À faire »: propositions à répondre, commande pas encore passée, lot à finir demain sans offre du jour (« 6 parts de tarte à finir demain · Voir la réserve »). Vide: « Rien à faire pour l'instant. »
- Grille des dix applis, quatre par rangée, badge sur Messages.
- La météo, la réputation et le projet épinglé de l'accueil de la tablette passent dans Bilans (page « Aujourd'hui ») et Nos projets: l'accueil d'un téléphone reste une porte d'entrée, pas un tableau de bord.

### 6.2 Réserve (inventaire, `realisme-v0-2.md` P0-3)

- Liste par famille (laitages, café et thé, boulangerie, fruits, épicerie): nom au conditionnement, quantité en réserve, « bon jusqu'à jeudi », et en ambre « À finir demain ».
- Bouton « Dépanner » par ligne pendant le service: « Dépannage par Mireille : livré dans l'heure, payé 30 % plus cher ». Fenêtre de confirmation: « Dépanner : lait entier, 1 caisse de 6 bouteilles · 10,14 € · Livré vers 18 h 25 à la porte de service. » « Dépanner » · « Annuler ».
- Le soir: titre « La réserve ce soir »; une ligne « À finir demain » propose « En offre du jour » (va dans Remises, ligne remplie).
- Vide (premier jour, avant Simone): « La réserve est vide. Le frais se commande dans Commandes. »

### 6.3 Catalogue

Celui de la tablette (ux.md 4.7), en une colonne: filtres en puces qui défilent à l'horizontale (Familles, puis Style), cartes d'article (vignette, nom, ce qu'il apporte, ce qu'il demande, prix, action). États et textes inchangés: « Acheter », « Proposer à Sacha », « Répondre à Sacha », « Retirer ma proposition », « Il manque 918 € », « Il faut : un point d'eau, une prise », « Livré demain matin ».

### 6.4 Commandes (maquette `#commandes`)

- Titre « Commandes pour mercredi » (le prochain jour ouvert). Intro: « Chaque fournisseur passe ses jours à lui, vers 7 h. Tu paies à la livraison. « Habituelle » : de quoi tenir jusqu'à son prochain passage. »
- **Une carte par fournisseur** (au lieu d'un tableau à six colonnes): portrait, « Lucas, le boulanger », « passe du mardi au dimanche ». Chaque ligne: nom du produit, pas à pas des cartons, puis en dessous « par 10 · en réserve : 4 · habituelle : 3 · 21,00 € ». Lot à finir: en ambre « en réserve : 6 parts, à finir demain ». Pied de carte: « Port offert. » ou « Port : 3 €. Encore 6,20 € pour le port offert. »
- Fournisseur qui ne passe pas ce jour-là: carte sans fond, « Ne passe pas mercredi. Prochain passage : jeudi. », en bas de la liste.
- Ligne tenue par l'autre: « Sacha modifie cette ligne » avec son jeton.
- Barre collante: « À payer à la livraison » et le total, « Commander pour mercredi » (or), « Revenir à la commande habituelle » (lien). Puis « Mis de côté pour cette commande : 41,00 € ».
- Envoyée: « Commande envoyée : livrée mercredi vers 7 h. Tu peux la modifier jusqu'à la fermeture à clé. » et « Modifier la commande ».
- Lundi: « Le lundi, personne ne livre : cette commande arrive mardi. »

### 6.5 Carte et prix (maquette `#carte`)

- Intro: « Le revient, c'est ce que coûtent les ingrédients d'une portion. Le reste paie le loyer, les charges et vos projets. »
- Pendant le service, alerte douce: « Le café est ouvert : un nouveau prix s'écrit sur l'ardoise ce soir, à la fermeture. » Une ligne changée montre « demain » et « aujourd'hui 1,20 € ».
- Rubrique « Sur l'ardoise · 6 lignes sur 8 ». Par recette, trois rangées: nom et puce « Vedette » (★ choisie, ☆ non); pas à pas du prix par 10 centimes; « revient 0,40 € · marge 2,00 € (83 %) · prix juste pour le village ». Avis de prix de l'ardoise repris tel quel (« Un peu cher pour le village : les familles hésiteront »).
- Barre collante: « Écrire sur l'ardoise »: range le téléphone et ouvre l'ardoise (interface posée, ux.md 4.3), qui reste le lieu où l'on compose la carte (ajouter, effacer une ligne, mot du jour). Raison: l'ardoise est un objet du monde que les clients lisent; l'écrire à la craie est un geste du café.

### 6.6 Remises (maquette `#remises`)

Textes de `remises-marketing-v0-2.md` 5.1, en cartes:

- Intro, puis « Hier, les remises t'ont coûté 6,40 €. »
- **Heure douce**: interrupteur « Active »/« Coupée », aide, ligne de résumé « De 15 h à 17 h, boissons -20 % », réglage de l'heure (pas à pas « Commence à 15 h », « Dure 2 h »), puces de taux (-10, -20, -30 %), puces des jours (mar. à dim.).
- **Carte de fidélité**: interrupteur inactif tant que les cartes ne sont pas achetées, « Achète d'abord les cartes au catalogue (15 €). », « Voir au catalogue ».
- **Offre du jour**: interrupteur, aide, suggestion en alerte douce (« Il reste 6 parts de tarte à finir demain, tu en vends 3 d'habitude. En offre du jour ? »), bouton qui remplit la ligne (« Tarte aux fruits à -30 %, demain »), puis choix de la recette et du taux; « Prix plancher : le revient. » sous le prix quand il joue.
- **Tarif réduit**: « Tarif randonneur, sur présentation de ta carte des sentiers » avec interrupteur et taux; « Pas d'étudiants au village : le car du lycée ne s'arrête qu'à Mérelles. »
- Jour plein: alerte douce « Dimanche : la salle sera sans doute pleine, une remise ne fera pas venir plus de monde. »
- À deux (hypothèse H2): activer une remise qui n'a jamais tourné envoie une proposition (« Proposer à Sacha »; message « Camille propose une remise · Heure douce de 15 h à 17 h, boissons -20 %. Ça te va ? »); retoucher une remise déjà acceptée se fait seul, et l'autre reçoit une nouvelle (« Camille a changé l'heure douce : de 15 h à 17 h, -20 %. »).

### 6.7 Faire connaître (maquette `#connaitre`)

Textes de `remises-marketing-v0-2.md` 5.2. Une carte par action, du plus petit au plus grand: nom, prix, phrase, « Pour : voisins, pressés · 7 jours », état, action.

- Première carte, sans fond: « Le bouche-à-oreille · gratuit », son aide, « Hier : environ 8 clients ».
- États: « En cours jusqu'à samedi » (coche verte) et bouton inactif « Déjà en cours »; « Relancée trop tôt : effet réduit »; « S'estompe »; « Bouclage ce soir : paraît jeudi. » (ambre); proposée par l'autre (carte en pointillés, « Proposée par Sacha · 45 € réservés », « Répondre à Sacha »); la tienne (« Ta proposition · en attente de Sacha », « Retirer ma proposition »).
- Actions: « Lancer ce soir » sous 30 €; « Proposer à Sacha » à partir de 30 €. Lancé: « C'est lancé : une affiche chez Lucas. Payée ce soir, à la fermeture. »
- Saturation, alerte douce en tête: « Beaucoup d'actions vers les mêmes clients : chacune rapporte moins. »
- Le colonnage du tableau (`cols`) devient l'ordre des rangées de la carte: pas de tableau à cinq colonnes sur un téléphone.

### 6.8 Bilans

- Liste des jours, le plus récent en haut: « Mardi 9 · résultat +38,20 € · 3 tasses ». Ouvrir un jour montre ses pages (livre d'or, ce qu'on retient, chiffres, demain) en une colonne, flèches gauche et droite pour tourner les pages; lignes de la v0.2 (Recette, Pourboires, Marchandise reçue, Port, Dépannages, Loyer, Charges, Publicité, Résultat du jour, Remises consenties pour mémoire) avec détail des charges dépliable.
- En tête, une page « Aujourd'hui » (l'ancien accueil de la tablette): service en cours, météo et demain, réputation.
- Vide: « Votre premier bilan s'écrira ce soir, à la fermeture. »

### 6.9 Nos projets

Celui de la tablette, en une colonne: en cours (avancement « 2 sur 3 », « Il manque : un store. », « Épingler »), « Plus tard », « Réalisés ». Vide: « Aucun projet réalisé pour l'instant : le premier ne tardera pas. »

### 6.10 Messages (maquette `#messages`)

- **Liste**: « À répondre » en tête (propositions), puis les conversations: Sacha (propositions, réponses, ce que l'autre a lancé ou changé), Simone (astuces), Les fournisseurs (livraisons, dépannages), Les habitués (arrivées, petits mots). Chaque rangée: portrait ou jeton, nom, dernier message, heure, point « non lu » (forme et mot « Nouveau » pour les lecteurs d'écran).
- **Fil avec Sacha**: séparateurs d'heure (« Hier, 18 h 10 », « Aujourd'hui, 17 h 21 »), nouvelles centrées en crème second (« Tu as lancé : une affiche chez Lucas, 8 €. »), puis la **proposition** en carte au liseré or:
  - « Proposition de Sacha » (jeton), titre « Un encart dans L'Écho de l'Arvelle », « 45 € · il resterait 441 € dans la caisse », ce que ça apporte, quand ça se paie (« Payé ce soir, à la fermeture. »);
  - « D'accord » (or, focus), « Pas maintenant », « Voir dans Faire connaître »;
  - aide sous la carte: « Retour arrière : répondre plus tard. La somme reste réservée jusqu'à ta réponse, ou jusqu'à la fin de la journée. »
- Toutes les propositions de `ux.md` 2.2 passent ici avec leurs textes (achat, embauche, renommer la maison, fermer plus tôt, remise, action). Exception: « On ouvre ? » se joue à la pancarte (geste du monde); le téléphone la montre aussi dans Messages pour qui préfère répondre de là.
- Après réponse, la carte devient une nouvelle: « Tu as dit d'accord : un encart dans L'Écho, lancé ce soir. »
- Pas de texte libre: les deux joueurs sont dans la même pièce, et une saisie libre ouvrirait des questions (clavier, filtrage) sans rien apporter au jeu. En P1, trois réponses toutes faites dans le fil de Sacha: « J'arrive », « Je m'en occupe », « Merci ! ».

### 6.11 Réglages

Ceux de la tablette (« pour toi », puis « pour vous deux », ux.md 8.10), plus « Afficher l'aide des touches à côté du téléphone » (pour toi, actif par défaut). La taille du texte et « Réduire les animations » restent dans Duo; une ligne le dit: « Taille du texte et animations : dans les réglages de Duo (Échap). »

## 7. Ce qui reste hors du téléphone

| Élément | Où | Pourquoi |
|---|---|---|
| Ardoise murale | dans le monde, interface posée (ux.md 4.3) | objet lu par les clients; composer la carte à la craie est un geste du café. Le téléphone règle prix et vedettes et y mène par « Écrire sur l'ardoise » |
| Rail à tickets, caisse, postes | dans le monde, postes rapides | se servent sans lâcher la souris, au rythme du service |
| Livre d'or | dans le monde | objet que les clients remplissent |
| Pancarte « On ouvre ? » | dans le monde (geste maintenu) | le moment d'ouvrir se vit à la porte; la réponse peut aussi se donner depuis Messages |
| **Bilan du soir** | **reste un écran à part**, plein, à la fermeture (ux.md 7) | c'est le moment partagé de fin de journée: les deux le lisent ensemble, café fermé, et finissent par « À demain ». Le mettre dans un téléphone le rendrait solitaire. Il se relit ensuite dans Bilans |
| Écrans de choix (matin, nuit, première fois, déménagement) | écrans pleins | décisions à deux, à gauche et à droite (règle de Duo) |
| Pause, réglages de Duo | Duo (Échap) | règle de la plateforme |

## 8. Ce que voit l'autre joueur

- Le personnage s'arrête, sort son téléphone de la poche droite du tablier et le regarde, tête un peu baissée (pose « téléphone »). L'écran du téléphone vu de loin est un aplat lumineux de la couleur de l'appli, sans texte lisible: rien d'espionnable, rien à comparer.
- Carte de l'autre dans le HUD (en haut à droite): « Sur son téléphone : Commandes » (le nom de l'appli ouverte; message `ui-place` existant, texte changé: `Sur son téléphone : {appli}` au lieu de `Sur la tablette : {section}`).
- Si les deux sont dans la même appli: « Sacha y est aussi » (jeton) sous la tête d'appli; les verrous par ligne restent.
- Ranger le téléphone efface la mention.

## 9. Textes exacts (nouveaux ou changés)

Écrits ici avec des espaces ordinaires; le jeu les typographie (`typo.ts`). Tutoiement, rédaction neutre (aucun participe accordé au genre d'un joueur).

| Clé proposée | Texte |
|---|---|
| `phone.name` (nom accessible) | Ton téléphone |
| `phone.status` (nom accessible) | Barre d'état |
| `phone.cash` | Caisse {amount} |
| `phone.back` | Retour |
| `phone.home` | Accueil |
| `phone.apps.*` | Commandes · Réserve · Catalogue · Carte et prix · Remises · Faire connaître · Bilans · Nos projets · Messages · Réglages · Équipe · Nos cafés |
| `phone.todo.title` | À faire |
| `phone.todo.empty` | Rien à faire pour l'instant. |
| `phone.todo.proposal` | {player} propose : {name}, {amount} · Répondre |
| `phone.todo.order` | Commande de {weekday} : pas encore passée · Préparer la commande |
| `phone.todo.useFirst` | {n} {item} à finir demain · Voir la réserve |
| `phone.newApp` | Nouvelle appli : {name} |
| `phone.keys` | Tab ranger le téléphone · Retour arrière revenir · A E appli voisine · Entrée choisir · flèches ou Z Q S D : se déplacer · Le café continue pendant que tu regardes. |
| `phone.sameApp` | {player} y est aussi |
| `hud.partnerPhone` | Sur son téléphone : {app} |
| `hud.phoneAlert` | Téléphone · {text} |
| `hud.phoneProposal` | Téléphone · {player} propose : {name}, {amount} · Entrée voir et répondre |
| `notif.delivery` | Livraison de {supplier} · {text} |
| `notif.deliveryMorning` | La commande est arrivée à la porte de service. |
| `notif.deliveryEmergency` | Le dépannage de {item} est à la porte de service. |
| `notif.regular` | {name} arrive · Il prendra sans doute {usual}, comme d'habitude. (ou « Elle prendra » selon le personnage, qui a son genre) |
| `notif.accepted` | {player} a dit d'accord : {name}. |
| `notif.declined` | {player} préfère attendre : rien n'a été dépensé. |
| `messages.title` | Messages |
| `messages.toAnswer` | À répondre |
| `messages.threads` | Sacha · Simone · Les fournisseurs · Les habitués |
| `messages.new` | Nouveau |
| `messages.youLaunched` | Tu as lancé : {name}, {amount}. |
| `messages.theyLaunched` | {player} a lancé : {name}, {amount}. |
| `messages.youAgreed` | Tu as dit d'accord : {name}. |
| `messages.proposal.head` | Proposition de {player} |
| `messages.proposal.cash` | {amount} · il resterait {left} dans la caisse |
| `messages.proposal.paidTonight` | Payé ce soir, à la fermeture. |
| `messages.proposal.buttons` | D'accord · Pas maintenant · Voir dans {app} |
| `messages.proposal.later` | Retour arrière : répondre plus tard. La somme reste réservée jusqu'à ta réponse, ou jusqu'à la fin de la journée. |
| `menu.duringService` | Le café est ouvert : un nouveau prix s'écrit sur l'ardoise ce soir, à la fermeture. |
| `menu.tomorrow` | demain |
| `menu.today` | aujourd'hui {amount} |
| `menu.writeSlate` | Écrire sur l'ardoise |
| `menu.star` | Vedette |
| `menu.line` | revient {cost} · marge {amount} ({pct} %) |
| `orders.supplierDays` | passe {days} (« passe du mardi au dimanche », « passe mardi, jeudi et samedi ») |
| `orders.lineInfo` | {pack} · en réserve : {stock} · habituelle : {usual} · {price} |
| `orders.lineUseFirst` | en réserve : {stock}, à finir demain |
| `orders.shipping` | Port : {shipping}. Encore {amount} pour le port offert. |
| `stock.title` | Réserve · La réserve ce soir (après la fermeture) |
| `stock.goodUntil` | bon jusqu'à {weekday} |
| `stock.emergency` | Dépanner |
| `stock.emergencyConfirm` | Dépanner : {item}, {pack} · {amount} · Livré vers {time} à la porte de service. |
| `stock.empty` | La réserve est vide. Le frais se commande dans Commandes. |
| `discounts.proposeNew` | Proposer à {player} |
| `discounts.changed` | {player} a changé {name} : {line}. |
| `marketing.launchTonight` | Lancer ce soir |
| `marketing.launched` | C'est lancé : {name}. Payée ce soir, à la fermeture. |
| `marketing.wordYesterday` | Hier : environ {n} clients |
| `marketing.for` | Pour : {profiles} · {days} jours |
| `settings.keysHelp` | Afficher l'aide des touches à côté du téléphone |
| `settings.duo` | Taille du texte et animations : dans les réglages de Duo (Échap). |
| `simone.phone` | Tout est dans vos téléphones : les commandes, la réserve, la carte. Moi, je préférais le carnet, mais bon. |
| `hint.firstPhone` (HUD, une fois) | Tab : sortir ton téléphone |

Les autres textes (Commandes, Catalogue, Remises, Faire connaître, propositions) restent ceux de `ux.md` 4.7 et 2.2 et des deux documents de la démo v0.2, sans changement.

## 10. Passation pour le développeur

1. **Nouveau calque** `phoneLayer` dans `calques.ts` à la place de `tabletLayer` (`closeKey: 'Tab'`, `section(delta)` = appli voisine, `back()` qui revient d'un cran et ne ferme qu'à l'accueil). Le fond du calque passe de 0,55 à 0,28 d'opacité pour ce calque seulement, et le calque ne couvre pas le HUD (z-index du HUD au-dessus du fond, sous le téléphone).
2. **Clic à côté**: inchangé (ferme). **Molette**: défilement du corps de l'appli (`overscroll-behavior: contain`).
3. **Pile de navigation** propre au téléphone (appli, détail) gardée entre deux sorties; vidée à la nuit.
4. **`ui-place`**: texte `Sur son téléphone : {appli}`; ajouter `phone.sameApp`.
5. **Notifications**: file unique; bannière dans le calque si sorti, alerte du HUD sinon; aucune ne prend le focus; Entrée sur une alerte de proposition ouvre `phoneLayer` sur Messages, fil de l'autre, focus « D'accord ».
6. **Sections de la tablette** → applis: `home` → Accueil; `orders` → Commandes (en cartes) et Réserve (nouvelle); `catalogue`, `menu`, `reports`, `projects`, `settings` gardent leur code de contenu, mis en une colonne; Remises et Faire connaître selon la démo v0.2; Messages nouvelle (elle reprend les propositions de `modele.ts`).
7. **Styles**: jetons de `theme.ts`, plus `--noyer #4B2F1F`, `--noyer-clair #6E4A31`, `--laiton #B8924F` (coque) et les dix teintes de pastilles de `telephone.css` (à valider par directeur-artistique). Classes de la maquette prêtes à reprendre: `.tel`, `.tel__coque`, `.tel__ecran`, `.etat`, `.nav`, `.appli-tete`, `.tache`, `.app`, `.pastille-app`, `.badge`, `.ligne`, `.pas`, `.inter`, `.puce`, `.carte`, `.collant`, `.banniere`, `.proposition`.
8. **Tests** (qa-testeur, en petit): Tab sort et range; Retour arrière jusqu'au rangement; A et E bouclent; Échap ne range pas; Entrée sur l'alerte ouvre la proposition; aucun texte sous 14 px; contrastes; aucune capsule du HUD sous le téléphone à 1280x720, 1366x768 (100 et 150 %), 1920x1080. Le script `verifier.cjs` de la maquette sert de modèle.

## 11. Hypothèses (à aligner par le manager)

| # | Hypothèse | Avec qui |
|---|---|---|
| H1 | Prix, vedettes et remises se préparent pendant le service et prennent effet à la prochaine ouverture (aujourd'hui l'ardoise est en lecture seule pendant le service) | game-designer |
| H2 | Une remise jamais activée passe par une proposition; une remise déjà acceptée se retouche seul, avec une nouvelle chez l'autre | game-designer |
| H3 | La tablette disparaît du décor; son support derrière le comptoir reçoit le livre d'or ou est retiré | directeur-artistique, level-designer |
| H4 | Main sur le téléphone: image rendue depuis le modèle des mains, teintée à la peau de l'avatar | artiste-3d, tech-artist |
| H5 | Pose « téléphone » de l'avatar et écran vu de loin en aplat sans texte | artiste-3d |
| H6 | Sons: frottement à la sortie, vibration courte, sonnerie des propositions inchangée | sound-designer |
| H7 | Les teintes des dix pastilles d'appli et la coque noyer et laiton | directeur-artistique |

## 12. Maquettes et vérifications

`design/maquettes/cosy-cafe/telephone/telephone.html`, états par ancre: `#accueil`, `#notif` (bannière de livraison), `#commandes`, `#carte`, `#remises`, `#connaitre`, `#messages` (proposition), `#range` (téléphone rangé, proposition reçue), `#autre` (« Sur son téléphone : Commandes » dans la carte de l'autre). Paramètres `?taille=125` ou `150`, `?reduit`. Fond: rendu de l'essai de style B (`docs/jeux/cosy-cafe/essai-style/captures/B-vue1-1920x1080.png`), le rendu choisi par le client. Polices DM Sans et Jost copiées dans `polices/` avec leur licence OFL.

- `node design/maquettes/cosy-cafe/telephone/outils/verifier.cjs`: 43 contrôles, tous bons (parcours au clavier seul de bout en bout; sept écrans à 1366x768, 1920x1080, 1366x768 à 150 % et 1280x720 sans débordement, sans texte sous 14 px, sans contraste sous 4,5:1, sans capsule du HUD sous le téléphone).
- `node design/maquettes/cosy-cafe/telephone/outils/capturer.cjs`: 25 captures dans `captures/` (1366x768 et 1920x1080 à l'échelle 1 pour tous les états, à l'échelle 2 pour l'accueil, Commandes et Messages, 150 % et 1280x720 pour quelques écrans).

## 13. Historique

| Date | Version | Changement | Par |
|---|---|---|---|
| 2026-11-08 | 0.1 | Première proposition: téléphone en main, dix applis, notifications, ce qui reste hors du téléphone | ux-ui-designer |
| 2026-11-08 | 0.2 | Implémentation dans le jeu; largeur bornée par « En main » à 150 %; décisions du manager H1, H2 (v0.2), H3 | dev-plateforme |
