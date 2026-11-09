# Deux Tabliers, démo v0.1: le café de la place

| Champ | Valeur |
|---|---|
| Statut | proposition du game designer, à relire par le manager |
| Base | cahier des charges v0.2 (`docs/jeux/cosy-cafe/cahier-des-charges.md`), plans d'Ormeval (`plans/plans.json`, `adresses.md` 4.1), `ux.md`, `technique.md` section 11 |
| Données | `docs/jeux/cosy-cafe/demo/donnees/` (format: `donnees/README.md`) |
| Simulation | `docs/jeux/cosy-cafe/demo/simulations/demo_v0_1.py` (8 parties par duo et par ordre d'achat, graines fixes) |

## 1. En une phrase

Deux semaines de printemps à Ormeval: vous rouvrez le café de Simone, vous en faites votre maison, meuble après meuble, et vous régalez la fête du Tilleul, jusqu'à la lettre de René qui vous appelle à Mérelles.

Ce qu'on doit ressentir: « c'est à nous ». Chaque soir, la caisse permet un petit plaisir ou oblige à mettre de côté pour un grand; chaque matin, quelqu'un pousse la porte avec une histoire.

## 2. Périmètre

**Durée.** 15 jours de jeu: deux semaines ouvertes (12 journées) entre trois lundis fermés. Temps réel mesuré par la simulation: **4,0 h** pour le duo médian, 4,9 h pour le duo tranquille, 3,3 h pour le duo rapide (préparation, service de 10 minutes, fermeture, lundis, prologue et scènes compris). Après l'écran de fin, on peut rester à Ormeval jusqu'au jour 28.

**Dedans.**
- L'adresse d'Ormeval entière: salle, comptoir, réserve, cour de livraison, terrasse sous le store (E1), pièce du fond au coin du feu (E2).
- Toute la base du service: ardoise, commande et encaissement au comptoir, rail des tickets, espresso, lait, thé, vitrine, plan, crêpière, presse-agrumes, vaisselle à l'évier, débarrasser, livraison du matin à ranger (cartons lourds à deux), commande du soir, dépannage, panier du soir.
- 17 recettes, 10 profils (le flux d'Ormeval en fait vivre six), 6 habitués avec leurs premières étapes, 11 événements dont 8 scènes à enjeu, la brocante du lundi, le marché aux fleurs.
- L'aménagement complet: 61 meubles et objets en vente ou à la brocante, 12 pièces uniques gagnées, 6 styles dont 3 complets (campagne, jardin, bistrot), rénovation du mobilier de Simone, peintures, papiers peints, sols, enseigne au nom de la maison.
- Livre d'or, réputation (de 1,5 à 3 tasses ou plus), « Nos projets » (12 projets du village), bilan du soir, sauvegarde et historique de Duo.

**Dehors.** Mérelles et les adresses suivantes, four et fournées, service en salle, employés, succursales, déménagement (la démo s'arrête à la proposition), saisons autres que le printemps, recettes du bourg et au-delà, histoires des habitués au-delà du niveau 2 (sauf Simone), musique au choix (la radio seule).

## 3. Progression maîtrisée

Le genre ouvre son catalogue par paliers lisibles: un palier de réputation fait apparaître une nouvelle page de la boutique, l'argent décide de l'ordre. Ici, chaque palier s'ouvre **à la réputation ou à un jour fixe, le premier des deux**: un duo tranquille n'est jamais privé de la suite, un duo rapide la voit plus tôt sans pouvoir tout acheter (l'argent reste la limite).

| Palier | S'ouvre à | Ce qui arrive | Ce que ça change |
|---|---|---|---|
| t0 « À l'arrivée » | jour 1 | gobelets, fiches cappuccino et thé vert, pichet thermomètre, tabourets de comptoir, service de vaisselle; décor: chaises, guéridons, table de ferme, suspensions, appliques, plantes, cadres, tapis de lirette, étagère de pots, peintures, objets de comptoir | les premiers petits plaisirs du soir (12 à 120 €) |
| t1 « Deux tasses » | 2 tasses ou jour 7 | **terrasse sous le store** (450 €, posée dans la nuit), moulin à dose, presse-agrumes, étagère à livres; fauteuils, banc de ferme, tables de fer et de bistrot, papiers peints, sols, enseignes, citronnier, desserte de zinc, caisse ancienne | le premier grand choix: la terrasse de la fête, ou les machines qui font servir plus |
| t2 « Deux tasses et demie » | 2,5 tasses ou jour 9 | **pièce du fond** (600 €, deux nuits de travaux; Simone la libère), crêpière, range-vélos, coin des enfants, réfrigérateur vitré; banquette de moleskine, fauteuil club, vaisselier sauge, olivier, miroir peint, guirlande, mobilier de terrasse | le second grand choix: le coin du feu ou les familles et les cyclistes |
| t3 « Trois tasses » | 3 tasses ou jour 12 | bouilloire à température | la fin de la démo ne promet plus rien de neuf à acheter: elle tourne la page vers Mérelles |
| Brocante | chaque lundi (jours 8 et 15) | 6 pièces tirées parmi les pièces de brocante, -30 %, charme x1,5, dont des styles rétro et nordique qui jurent avec la campagne | la tentation d'une belle pièce qui casse la cohérence |
| Pièces uniques | habitués et événements | 12 objets offerts (aquarelle de Simone, dessins de Noé, fanion des Godillots...) | chaque scène laisse une trace au mur |

**Pourquoi la terrasse se pose dans la nuit et la pièce du fond en deux nuits.** Dans le cahier, les extensions se construisent le lundi suivant. Dans une démo de deux semaines, une terrasse achetée après le jour 7 n'aurait jamais servi à la fête. La terrasse n'est qu'une autorisation, un store et deux guéridons: Gaby les pose le soir. La pièce du fond demande une arche dans le refend: deux nuits. À reporter dans le cahier (question D1).

## 4. Déroulé jour par jour

| Jour | Titre | Nouveauté | Habitués | Événement |
|---|---|---|---|---|
| 1, lundi | Les clés | prologue sur le seuil, visite, nom de la maison à deux, premier noisette pour Simone, première ardoise, première commande | Simone | aucun |
| 2, mardi | On ouvre | la pancarte retournée à deux, commande, encaissement, service, évier, bilan, premier mot du livre d'or | Simone (première cliente) | aucun |
| 3, mercredi | Le mercredi des enfants | le goûter des familles, débarrasser, carnet des clients | Mathis, Farida et Noé | aucun |
| 4, jeudi | Le car de 8 h 12 | premier client à enjeu | Mathis | **Le car de 8 h 12** |
| 5, vendredi | Une lectrice | le confort et les fauteuils, ranger la livraison à deux | Lise | aucun |
| 6, samedi | Le marché aux fleurs | plantes à -20 % jusqu'au vendredi suivant, panne réparée à deux | Farida et Noé, Lise | **La vieille dame tousse** |
| 7, dimanche | Les Godillots | commande de groupe; palier t1 au plus tard | Bastien et Gribouille | **Les Godillots de l'Arvelle** |
| 8, lundi | Le premier lundi | brocante, travaux, bilan de la semaine | aucun | aucun |
| 9, mardi | Le carnet vert | palier t2 au plus tard | Mathis, Lise | **Le carnet vert** |
| 10, mercredi | Jules | indices partagés | Farida et Noé | **Jules a perdu sa mamie** |
| 11, jeudi | L'inspection | propreté sous le regard de l'inspectrice; le soir, la demande des mariés | Mathis | **L'inspection** |
| 12, vendredi | Le café d'honneur | pièce montée portée à deux; palier t3 au plus tard | Mathis | **Le café d'honneur** |
| 13, samedi | Le cœur de lait | concours de dessin sur le lait | Farida et Noé, Lise | **Le concours du cœur de lait** |
| 14, dimanche | La fête du Tilleul | le défi du village, affluence x1,6 | tous | **La fête du Tilleul** |
| 15, lundi | La lettre de Mérelles | René au comptoir, proposition « Partir pour Mérelles ? », écran de fin | Simone, René | fin de la démo |

L'averse de trois heures (météo) tombe une fois entre les jours 9 et 13, un jour couvert où la terrasse est ouverte. Simone vient chaque jour, deux fois; ses conseils ne passent qu'une fois par geste, puis elle se tait.

**Objectif de fin.** La fête du Tilleul tenue (elle réussit toujours: c'est une fête) et la lettre de René reçue. La lettre arrive au courrier du matin quand la renommée atteint 850 (jour 11 en médiane pour le duo médian, 12 à 13 pour le duo tranquille); sinon René l'apporte en personne le soir de la fête. Le lundi 15, la proposition « Partir pour Mérelles ? » se fait à deux; les deux réponses mènent à l'écran de fin, qui propose de rester à Ormeval.

**La fête a une date fixe** (deuxième dimanche du printemps), comme une vraie fête de village: plus de condition de réputation pour qu'elle ait lieu. Trois objectifs facultatifs la rendent « Formidable »: 45 groupes servis, la terrasse ouverte (sinon la mairie prête des tables à tréteaux), trois tasses. Écart avec le cahier (PR-02), question D2.

## 5. Les événements spéciaux

Règles communes: annoncés la veille (sauf deux surprises), jamais au milieu d'un geste, un seul par jour, aucun échec. Chaque scène finit « Réussi » ou « Formidable »; une aide arrive seule si le duo traîne (Gaby, Lucas). Chaque scène pousse à se parler: une information n'est visible que d'un des deux joueurs, ou le geste ne se fait qu'à deux. Détail complet (répliques, critères, récompenses): `donnees/evenements.json`.

| Événement | Jour | Scène et enjeu | Ce qui oblige à se parler | Réussi / Formidable | Récompense |
|---|---|---|---|---|---|
| Le car de 8 h 12 | 4 | Octave Brissac, en route pour un entretien d'embauche, veut un double crème d'avoine, mousse épaisse, croissant coupé, et « Courage » écrit sur le couvercle, en 75 secondes, avant que le car reparte | seul celui qui regarde par la vitrine voit le chauffeur, à qui l'on peut demander 30 secondes de plus | servi (avec ou sans rallonge) / avant le klaxon | 6 à 10 €, réputation, sa carte postale le lundi |
| La vieille dame tousse | 6 | le matin du marché aux fleurs, un groupe de la machine ne donne plus qu'un filet: un groupe sur deux tant que le joint n'est pas changé | geste à deux côte à côte (l'un tient le levier, l'autre change le joint) et choisir le moment où l'on quitte le comptoir | réparé, ou par Gaby après 3 minutes / à deux avant 9 h | réputation, geste « purge du groupe », le joint encadré |
| Le marché aux fleurs | 6 | la place couverte de plants, plus de flâneurs | décider ensemble ce que l'on achète en plantes à -20 % | jour du village | remise d'une semaine |
| Les Godillots de l'Arvelle | 7 | neuf randonneurs du club de Bastien, une liste votée dans le car, neuf gourdes à remplir, départ dans vingt minutes | Colette ne lit la liste qu'à celui qui prend la commande, qui la dicte à l'autre | tout servi / en moins de 4 minutes | cagnotte de 20 à 30 €, réputation, le fanion du club |
| Le carnet vert | 9 (dès 2 tasses, au plus tard le 10) | une cliente au chapeau de pluie demande un cappuccino et un conseil: c'est la plume de « L'Écho de l'Arvelle » | celui de la caisse entend la question, celui du bar voit le carnet vert | article aimable / article élogieux (4 critères sur 5: qualité, dessin, table propre, deux mots, conseil) | réputation, +8 à +15 % de passants pendant 3 jours, l'article encadré |
| Jules a perdu sa mamie | 10 | un petit garçon en ciré jaune entre seul | les indices (parapluie lilas, cabas à carreaux) ne s'affichent que chez celui qui lui parle; la place ne se voit que de la vitrine | retrouvée, ou ramenée par Lucas / en moins de 90 secondes | réputation, le moulin à poivre de Mamie Odile, un petit habitué du mercredi |
| L'inspection | 11 | Madame Ferrand observe 6 minutes sans rien toucher | cinq critères affichés chez les deux: qui tient le service, qui tient la plonge et le balai | « Satisfaisant » et deux conseils / « Très satisfaisant » | réputation, la plaque d'hygiène |
| Le café d'honneur | 12 | Nadia et Paul se marient à la mairie d'en face: quatorze invités, une pièce montée, une « surprise de la maison » | la pièce montée se porte à deux et se tourne à la porte; la surprise se choisit à deux | forfait de 160 € / de 200 € | forfait, réputation, la photo des mariés |
| Le concours du cœur de lait | 13 | Simone, Lise et Noé jugent chaque dessin sur le lait entre 10 h et midi | score commun du duo, jamais par joueur; les gestes simplifiés donnent « Bien » à chaque dessin | moins de 20 points / 20 points | réputation, le pichet d'argent |
| L'averse de trois heures | entre 9 et 13 | la pluie sur le store, la terrasse se replie dedans | l'un fait de la place dedans, l'autre rentre les tasses | / personne debout plus de 20 s | réputation |
| La fête du Tilleul | 14 | tout le village sur la place, la maire, René venu de Mérelles | le coup de feu à x1,6 se répartit à voix haute | toujours réussie / les 3 objectifs | 150 de renommée, 50 € de la mairie pour « Formidable », la lanterne de la fête |

Les événements répondent à la demande du client (critique déguisée, groupe de randonneurs, mariage, client pressé à la demande folle, inspection, enfant perdu, panne un matin de marché, concours de dessin sur le lait); Ormeval n'a pas de marché hebdomadaire, la panne tombe donc le matin du marché aux fleurs.

## 6. Économie de la démo

### 6.1 Ce qui entre, ce qui sort

| Poste | Valeur | Raison |
|---|---|---|
| Caisse au départ | 300 € | Simone la laisse « pour la monnaie et le premier lait »: de quoi faire trois ou quatre achats le premier soir |
| Loyer | 520 € par mois de 28 jours, soit 18,57 € par jour, lundi compris | cahier, table `adresses` |
| Charges | 8 € par jour ouvert | cahier |
| Réserve | 2 jours de charges (53 €) jamais entamés par un achat | aucune journée ne peut finir dans le rouge par un achat |
| Prix | prix conseillés du cahier, réglables de -30 % à +50 % | cahier AT-03 |
| Matières | somme exacte des ingrédients de `ingredients-fournisseurs.json` (table 6.2) | les coûts du cahier recalculés à partir de vrais produits; écart de 0 à 0,05 € par recette |
| Achat important | à partir de 150 €, ou des recettes moyennes d'une journée: proposé à l'autre joueur | au village, le seuil de 300 € du cahier ne toucherait presque rien |
| Réputation | 150 points pour la première demi-tasse, la k-ième en demande 150 x k x (k + 1) / 2; rattrapage après 12 jours ouverts | valeurs du cahier: 2 tasses vers le jour 4, 2,5 vers le jour 7, 3 vers le jour 12 pour le duo médian |
| Offre de Mérelles | renommée 850, ou en main propre le soir de la fête | la lettre arrive pendant la deuxième semaine: elle donne un enjeu à la fête |

### 6.2 Recettes et marges

<!-- table:sim_recettes -->
| Recette | Prix conseillé au comptoir | Matières | Marge | Part des matières | Déblocage |
|---|---|---|---|---|---|
| Espresso (petit noir) | 1,40 € | 0,20 € | 1,20 € | 14 % | départ |
| Café allongé | 1,60 € | 0,22 € | 1,38 € | 14 % | départ |
| Café crème | 2,40 € | 0,40 € | 2,00 € | 17 % | départ |
| Thé noir | 2,50 € | 0,24 € | 2,26 € | 10 % | départ |
| Chocolat chaud | 2,80 € | 0,44 € | 2,36 € | 16 % | départ |
| Croissant | 1,20 € | 0,70 € | 0,50 € | 58 % | départ |
| Pain au chocolat | 1,30 € | 0,75 € | 0,55 € | 58 % | départ |
| Tartine beurre-confiture | 2,20 € | 0,40 € | 1,80 € | 18 % | départ |
| Tarte aux fruits de saison | 3,20 € | 1,60 € | 1,60 € | 50 % | départ |
| Noisette | 1,70 € | 0,23 € | 1,47 € | 14 % | habitué `simone`, lien 0 |
| Cappuccino | 2,90 € | 0,37 € | 2,53 € | 13 % | achat `fiche_cappuccino` |
| Thé vert | 2,60 € | 0,28 € | 2,32 € | 11 % | achat `fiche_the_vert` |
| Infusion du jardin de Simone | 2,40 € | 0,16 € | 2,24 € | 7 % | habitué `simone`, lien 1 |
| Citronnade maison | 3,00 € | 0,33 € | 2,67 € | 11 % | habitué `bastien`, lien 1 |
| Jus d'orange pressé | 3,50 € | 0,90 € | 2,60 € | 26 % | achat `presse_levier` |
| Limonade artisanale | 3,20 € | 1,10 € | 2,10 € | 34 % | achat `frigo_vitre` |
| Crêpe | 2,50 € | 0,30 € | 2,20 € | 12 % | achat `creperie` |
<!-- fin:sim_recettes -->

Lecture: les boissons gardent 83 à 93 % de leur prix; les viennoiseries du boulanger rapportent peu (le four de Mérelles changera cela, c'est la promesse de la suite). Le jus pressé et la limonade coûtent plus en matières mais attirent les promeneurs.

### 6.3 Ambiance chiffrée

Ambiance (0 à 95 dans la démo) = décor (40 x charme / (1,2 x surface ouverte), 40 au plus) + 20 x cohérence + confort (30 x part des places confortables, 15 au plus) + lumière (10 x luminaires / (surface / 8), 10 au plus) + musique (5 si la radio joue la station qui va avec le style dominant, 2 sinon) + propreté (10 au plus, 8 dans la simulation). Surfaces: salle 26 m², pièce du fond 12,8 m²; la terrasse ne dilue pas le décor de la salle (sans cette règle, ouvrir la terrasse faisait baisser l'ambiance de 12 points: mesuré au deuxième essai). Le mobilier de Simone est usé: son charme compte à moitié jusqu'à la rénovation (15 € la chaise, 30 € le guéridon). À l'arrivée, l'ambiance vaut 41 (« Sympathique »); un duo qui décore atteint 75 à 81 (« Charmante ») le jour de la fête.

### 6.4 Une partie du duo médian, jour par jour (ordre d'achat « équilibre », médianes de 8 parties)

<!-- table:sim_median_jours -->
| Jour | Caisse le soir | Résultat du jour | Recettes | Matières | Groupes servis | Repartis | Satisfaction | Tasses | Renommée | Ambiance | Achats du soir (le plus fréquent) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 (lundi) | 281 € | fermé (loyer) | | | | | | 1,5 | 0 | | travaux, brocante |
| 2 (mardi) | 63 € | 115 € | 153 € | 32 € | 23 | 0 % | 77 | 1,5 | 64 | 41 | gobelets, fiche_cappuccino, renover_chaises, pichet_thermometre |
| 3 (mercredi) | 99 € | 136 € | 181 € | 41 € | 28 | 3 % | 79 | 1,8 | 148 | 55 | bouquet_champetre, fiche_the_vert, assiettes_faience |
| 4 (jeudi) | 108 € | 108 € | 137 € | 31 € | 21 | 0 % | 81 | 2,0 | 219 | 60 | presse_levier |
| 5 (vendredi) | 100 € | 138 € | 180 € | 37 € | 30 | 5 % | 80 | 2,0 | 305 | 60 | presse_levier |
| 6 (samedi) | 160 € | 185 € | 245 € | 57 € | 30 | 3 % | 79 | 2,0 | 401 | 64 | rien |
| 7 (dimanche) | 211 € | 263 € | 242 € | 52 € | 28 | 4 % | 80 | 2,5 | 510 | 64 | fauteuil_crapaud |
| 8 (lundi) | 192 € | fermé (loyer) | | | | | | 2,5 | 510 | | travaux, brocante |
| 9 (mardi) | 333 € | 151 € | 201 € | 44 € | 28 | 0 % | 83 | 2,5 | 628 | 72 | rien |
| 10 (mercredi) | 441 € | 190 € | 249 € | 55 € | 34 | 3 % | 82 | 2,5 | 752 | 72 | rien |
| 11 (jeudi) | 204 € | 174 € | 223 € | 49 € | 34 | 3 % | 83 | 2,5 | 882 | 72 | village_terrasse |
| 12 (vendredi) | 113 € | 328 € | 241 € | 50 € | 35 | 6 % | 83 | 3,0 | 1 025 | 73 | moulin_dose, tapis_lirette |
| 13 (samedi) | 264 € | 217 € | 281 € | 63 € | 36 | 9 % | 82 | 3,0 | 1 155 | 75 | rien |
| 14 (dimanche) | 473 € | 230 € | 295 € | 63 € | 44 | 38 % | 80 | 3,0 | 1 425 | 75 | rien |
| 15 (lundi) | 454 € | fermé (loyer) | | | | | | 3,0 | 1 425 | | travaux, brocante |
<!-- fin:sim_median_jours -->

Lecture: chaque soir de la première semaine permet un ou deux achats (12 à 220 €); les jours 8 à 10, le duo met de côté pour la terrasse (450 €): trois soirs sans achat, mais un but visible. Le samedi et le dimanche rapportent deux fois un mardi. La fête renvoie 38 % des groupes (coup de feu voulu), avec une satisfaction de 80.

### 6.5 Trois duos, quatre façons d'acheter

<!-- table:sim_synthese -->
| Duo | Ordre d'achat | Gagné en 12 jours (résultats) | Dépensé en achats | Caisse au jour 15 | Achats faits | Terrasse ouverte le jour 14 | Trois tasses avant la fête | Lettre de René (jour) | Pièce du fond ouverte pour la fête | Ambiance au jour 14 | Cohérence | Temps réel joué |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Duo tranquille | équilibre | 1 870 € | 1 757 € | 135 € | 14 | 8 sur 8 | 5 sur 8 | 12 | 0 sur 8 | 73 | 84 % | 4,9 h |
| Duo tranquille | décor d'abord | 1 886 € | 1 547 € | 361 € | 13 | 8 sur 8 | 8 sur 8 | 12 | 0 sur 8 | 81 | 88 % | 4,9 h |
| Duo tranquille | terrasse puis coin du feu | 1 873 € | 1 727 € | 183 € | 12 | 8 sur 8 | 5 sur 8 | 13 | 0 sur 8 | 67 | 82 % | 4,9 h |
| Duo tranquille | machines d'abord | 1 927 € | 1 740 € | 181 € | 12 | 8 sur 8 | 4 sur 8 | 13 | 0 sur 8 | 60 | 77 % | 4,9 h |
| Duo médian | équilibre | 2 190 € | 1 757 € | 454 € | 14 | 8 sur 8 | 8 sur 8 | 11 | 0 sur 8 | 75 | 85 % | 4,0 h |
| Duo médian | décor d'abord | 2 130 € | 1 547 € | 525 € | 13 | 8 sur 8 | 8 sur 8 | 11 | 0 sur 8 | 81 | 88 % | 4,0 h |
| Duo médian | terrasse puis coin du feu | 2 132 € | 1 797 € | 335 € | 12 | 8 sur 8 | 8 sur 8 | 12 | 7 sur 8 | 66 | 85 % | 4,0 h |
| Duo médian | machines d'abord | 2 134 € | 1 960 € | 179 € | 13 | 8 sur 8 | 8 sur 8 | 12 | 0 sur 8 | 58 | 76 % | 4,0 h |
| Duo rapide | équilibre | 2 384 € | 2 057 € | 341 € | 14 | 8 sur 8 | 8 sur 8 | 10 | 0 sur 8 | 75 | 85 % | 3,3 h |
| Duo rapide | décor d'abord | 2 285 € | 2 147 € | 179 € | 14 | 8 sur 8 | 8 sur 8 | 10 | 0 sur 8 | 81 | 88 % | 3,3 h |
| Duo rapide | terrasse puis coin du feu | 2 395 € | 2 282 € | 91 € | 14 | 8 sur 8 | 8 sur 8 | 11 | 8 sur 8 | 66 | 85 % | 3,3 h |
| Duo rapide | machines d'abord | 2 357 € | 2 220 € | 119 € | 14 | 8 sur 8 | 8 sur 8 | 11 | 0 sur 8 | 65 | 80 % | 3,3 h |
<!-- fin:sim_synthese -->

Lecture:
- **Tension sans frustration.** Sur deux semaines, un duo gagne de 1 900 à 2 500 € et le catalogue désirable en vaut plus de 4 000: impossible de tout avoir, chaque achat se choisit. Aucun duo ne finit sous la réserve; la caisse finale reste petite (90 à 530 €) parce qu'il y a toujours une envie de plus.
- **La terrasse est atteinte par tous** (96 parties sur 96 ouvrent la terrasse pour la fête): le but de la deuxième semaine est sûr.
- **La pièce du fond est un vrai choix.** Elle n'est ouverte pour la fête que si le duo la met juste après la terrasse (7 parties sur 8 du duo médian, 8 sur 8 du duo rapide, 0 du duo tranquille); sinon elle devient le premier projet après la démo. C'est voulu: la tablette ne la pousse pas.
- **Décorer paie.** « Décor d'abord » finit avec la meilleure ambiance (81) et autant de réputation que les machines; « machines d'abord » sert à peine plus et laisse une salle à 58. Comme dans le cahier, l'ambiance n'est pas un luxe.
- **Le duo tranquille** atteint 3 tasses avant la fête dans 4 à 8 parties sur 8 selon ses achats: la fête est quand même tenue (date fixe), la lettre arrive au jour 12 ou 13.

### 6.6 Calendrier d'achats d'une partie (duo médian, ordre « équilibre », graine 1000)

<!-- table:sim_calendrier -->
| Jour | Achat | Prix | Caisse après les achats du soir |
|---|---|---|---|
| 2 | `gobelets` | 40 € | 98 € |
| 2 | `fiche_cappuccino` | 30 € | 98 € |
| 2 | `renover_chaises` | 120 € | 98 € |
| 2 | `pichet_thermometre` | 60 € | 98 € |
| 3 | `suspension_osier` | 70 € | 70 € |
| 3 | `bouquet_champetre` | 12 € | 70 € |
| 3 | `fiche_the_vert` | 20 € | 70 € |
| 4 | `assiettes_faience` | 55 € | 118 € |
| 5 | `presse_levier` | 120 € | 102 € |
| 6 | `peinture_lin` | 120 € | 151 € |
| 7 | `fauteuil_crapaud` | 220 € | 183 € |
| 11 | `village_terrasse` | 450 € | 174 € |
| 12 | `moulin_dose` | 380 € | 66 € |
| 12 | `tapis_lirette` | 60 € | 66 € |
<!-- fin:sim_calendrier -->

### 6.7 Contrôle croisé

- La simulation relit les JSON de `donnees/` (jamais ses propres constantes) et vérifie: chaque coût de recette égale la somme de ses ingrédients, le catalogue a au moins 35 objets dans au moins trois styles, chaque objet cité par un événement existe. Sortie: code 0.
- Les tables 6.2, 6.4, 6.5 et 6.6 sont recopiées par `demo_v0_1.py --simuler --remplir`, jamais à la main.
- Hypothèses non simulées: les trois aides des événements (temps réel), l'effet du dessin sur le lait hors concours, les options (lait d'avoine, déca), la brocante (prix et charme en données, mais le duo simulé n'y achète pas).

## 7. Aménagement et personnalisation

- **Ce que l'on change**: chaque meuble (61 en vente ou à la brocante), sa place sur la grille de 25 cm, sa rotation (quart de tour, 15° pour fauteuils et plantes), la teinte des murs (4 peintures, 3 papiers peints), le sol (3 sols), l'enseigne (3 modèles, au nom choisi à deux), les objets du comptoir, la terrasse (guirlande, parasol, jardinières), et les 12 pièces uniques gagnées.
- **Contraintes de pose** (catalogue, `placementRules`): passages de 0,9 m jusqu'à chaque place et 1,2 m dans l'allée de la porte à la passe (C13), file laissée libre, objets muraux sur les murs libres seulement, suspensions entre les solives, meubles lourds portés à deux (banc de ferme, banquette, fauteuils club et crapaud, table de ferme, vaisselier, desserte, olivier, citronnier, miroir, horloge comtoise), un meuble occupé ne bouge pas pendant le service, 60 objets au plus (les revêtements ne comptent pas).
- **Trois styles complets**: campagne (le style de Simone, aimé des voisins, des familles et des gourmands), jardin (familles, promeneurs), bistrot (pressés, voisins, flâneurs, promeneurs). Le zinc de Simone est bistrot, ses chaises sont campagne: les deux « se côtoient » sur la roue, et c'est la première question de goût du duo. La brocante apporte du rétro (l'opposé de la campagne) et du nordique.
- **Où chaque chose a sa raison**: le range-vélos sur le trottoir côté voie verte; les géraniums sur l'appui de la vitrine sud; la guirlande sous le store; l'écuelle de Gribouille sous la terrasse; l'horloge d'école visible du comptoir pour l'heure du car.

## 8. Critères d'acceptation proposés (à rendre testables par qa-testeur)

| # | Critère | Vérification |
|---|---|---|
| D-01 | Une démo commencée au jour 1 atteint l'écran de fin le jour 15 sans aucune condition de réputation ni d'argent | test de simulation: 15 jours avec un duo qui n'achète rien |
| D-02 | La fête du Tilleul a lieu le jour 14 dans toutes les parties, terrasse ou non | test: sans terrasse, 4 places sur tréteaux le jour 14 |
| D-03 | La lettre de René est reçue au plus tard le soir du jour 14 | test: renommée forcée à 0 |
| D-04 | Chaque palier s'ouvre à sa réputation ou à son jour, le premier des deux | test sur les quatre paliers |
| D-05 | Un achat ne descend jamais la caisse sous deux jours de charges | test de la boutique |
| D-06 | Chaque coût de recette égale la somme de ses ingrédients | `demo_v0_1.py --simuler`, code 0 |
| D-07 | Chaque événement finit « Réussi » ou « Formidable », aide comprise, sans action du duo après la limite | test par événement, duo inactif |
| D-08 | Dans chaque événement à indices, l'indice n'est visible que chez le joueur concerné | test réseau à deux clients |
| D-09 | La terrasse achetée un soir est ouverte le lendemain; la pièce du fond deux jours après | test |
| D-10 | Aucun texte ne compare les deux joueurs (concours compris) | revue des textes |
| D-11 | Un meuble qui ferme un passage de 0,9 m vers une place est refusé avec sa phrase | test de pose |
| D-12 | Un duo médian joue la démo en 3,5 à 4,5 h | observation en séance chez le client |

## 9. Questions pour le client et pour l'équipe

| # | Question | Recommandation |
|---|---|---|
| D1 | Terrasse posée dans la nuit et pièce du fond en deux nuits, au lieu du lundi suivant: on l'adopte aussi dans le jeu complet ? | oui pour les extensions légères (terrasses), le lundi pour les gros travaux au-delà du village |
| D2 | Fête du Tilleul à date fixe (deuxième dimanche) plutôt qu'au premier dimanche après 3 tasses et la terrasse | oui: c'est plus naturel et la démo ne bloque jamais; dans le jeu complet, garder une date fixe par défi local |
| D3 | Offre de Mérelles à 850 de renommée dans la démo (500 dans le cahier) | garder 850: à 500, la lettre arrivait dès le jour 7 et la deuxième semaine perdait son enjeu |
| D4 | Pièce du fond à 600 € (900 dans le cahier) | 600 €: à 900, aucun duo simulé ne l'ouvre avant la fête |
| D5 | Seuil d'achat important (proposé à l'autre) à 150 € au village | oui: à 300 €, seuls deux achats demandaient l'accord |

## 10. Écarts avec le cahier v0.2 (à reporter par le manager si validés)

Terrasse et pièce du fond (travaux, prix, paliers), date fixe de la fête, seuil de l'offre de Mérelles, seuil des achats importants, coûts des matières recalculés par ingrédient (espresso 0,20 € au lieu de 0,22 €, cappuccino 0,37 € au lieu de 0,42 €...), ambiance calculée objet par objet (la simulation du cahier l'achetait par paliers de +10).
