# Retours de la séance du 3 novembre 2026

Version jouée: Duo 0.2.x avec La Petite Ligne 0.12.1 (installée par la mise à jour automatique ou depuis le fichier).

## Constats du client

- R01. Coupe de cheveux qui bogue: nattes ou mèches qui pendent à côté de la tête et traversent le haut du personnage (capture du client, non versionnée).
- R02. Beaucoup de sols scintillent, surtout dans les intérieurs: deux surfaces au même niveau se battent (pavés et terre devant une façade dans la vidéo, `r02-sol-scintille.jpg`, six images à une seconde d'écart).
- R03. Trop de texte dans les menus, par exemple l'onglet Poissons du carnet: le jeu doit être léger en texte et jouer sur des icônes, des images et des animations plutôt que des pavés.
- R04. Les icônes manquent de variété: tous les poissons ont la même icône, on ne retrouve pas le bon.
- R05. Les jambes d'un personnage traversent la voie ferrée (traverses et rails passent devant les jambes, capture du client).
- R06. Le samedi, le train repart à reculons au lieu de continuer tout droit: pas immersif.

- R07. Le panneau de la gare est laid: lettres pixelisées et baveuses, poteaux trop fins (`r07-panneau-gare.png`).
- R08. Le menu de la basse-cour est trop textuel et affiche des identifiants bruts (`hen_white`, `hen_red`, `hen_black`) dans la collection (`r08-menu-basse-cour.png`). Il doit permettre de gérer la basse-cour par icônes et jauges, lisible presque par un enfant, tout en restant adulte.
- R09. Cultures: commencer avec 6 parcelles, en gagner de plus en plus de façon assez linéaire pour cultiver vite en quantité, et les placer librement sur le terrain (les retirer pour les mettre ailleurs). Aujourd'hui, un bloc fixe de 12 carrés devant la maison (`r09-parcelles.webp`).
- R10. Les pages des magasins en liste obligent à faire défiler: interfaces à refaire. Trop d'icônes identiques (même caisse pour les trois vases, même planche pour le sac de grain, le coupon de toile, le sucre et le bocal): on n'identifie pas l'objet au premier regard (capture du comptoir d'Odette, non versionnée car elle montre un prénom).
- R11. La petite déco se pose toujours sous la table et non dessus.

- R12. Le menu du réchaud est trop lourd et complexe (`r12-rechaud.png`: phrases de recette, « Il manque : ... » en toutes lettres, même icône de pain pour cinq recettes). Il faut refaire toutes les interfaces: moins de texte, plus d'images et d'animation.
- R13. Sur Windows, il n'y a pas d'ombres, contrairement au Mac.
- R14. Portage à deux: le colis flotte dans le vide au-dessus et à côté des deux joueurs, bras levés, qui ne le touchent pas (capture du client, non versionnée car elle montre les deux profils).

- R15. Dans la maisonnette, un élément accroché au mur (le râtelier à outils, une barre à crochets sur deux montants) chevauche la fenêtre (capture du client, non enregistrée sur le disque).
- R16. La porte de la maisonnette n'apparaît toujours pas vue de l'intérieur.
- R17. Un cadre ne se pose pas sur les murs de la maison: l'aperçu reste rouge dès qu'un objet occupe la case de sol au pied du mur, alors que le mur est libre. Et posé sur une fenêtre, il la recouvre.
- R18. Question du client sur l'étal: des produits semblent partir quand personne n'est derrière, sans rien rapporter. Selon le code, rien ne se vend sans joueur derrière l'étal; à 13 h, le reste retourne au cellier ou au coffre (message « L'étal est rangé »). À vérifier avec le client; la fermeture doit se voir mieux.

## Décisions du manager

- Patch 0.12.2, en ligne le 4 novembre avant 21 h: R01 à R08, R10 à R14, à partir de `main` (0.12.1), sans le travail de la 0.13.
- R09 (parcelles libres, 6 au départ puis de plus en plus) va dans la 0.13, avec les parcelles de la carte agrandie: c'est le même système.
