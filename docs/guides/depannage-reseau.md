# Dépannage: l'autre ordinateur n'apparaît pas

Ce guide sert quand Duo ne trouve pas l'autre ordinateur, ou quand il te demande de régler quelque chose dans Windows ou dans macOS. La plupart du temps, tu n'en auras pas besoin: Duo trouve l'autre ordinateur tout seul, en quelques secondes.

- Commence toujours par le bouton « Que faire ? » dans Duo (sur l'accueil, dans le salon ou pendant une coupure). Duo fait lui-même les vérifications, te dit ce qui bloque et ouvre le bon réglage. Ce guide reprend les mêmes étapes, avec plus de détails.
- Après chaque correction, reviens dans Duo et clique sur « C'est fait, vérifier » ou « Relancer les vérifications ». Pas besoin de redémarrer Duo, sauf si c'est écrit.
- Les noms des menus sont ceux de Windows 11 et de macOS 15 en français. S'ils diffèrent un peu chez toi, choisis ce qui s'en rapproche le plus.
- Si une étape demande l'accord d'un administrateur sur le PC (une fenêtre « Voulez-vous autoriser cette application à apporter des modifications à votre appareil ? »), réponds « Oui ». Si le PC demande un mot de passe que tu n'as pas, il faut la personne qui gère ce PC.

## 1. Les trois vérifications de base (1 minute)

1. **Duo est ouvert sur les deux ordinateurs.** Pas seulement installé: ouvert. Il peut rester en arrière-plan.
2. **Les deux ordinateurs sont sur le même réseau de la maison**: le même Wi-Fi, ou l'un en Wi-Fi et l'autre branché à la box par un câble réseau. Les deux marchent.
3. **Aucun des deux n'est sur le Wi-Fi « invités » de la box** (voir la partie 7).

Ensuite, dans Duo: « Que faire ? », puis « Relancer les vérifications ».

## 2. Sur le PC: le réseau est réglé sur « Public »

Windows classe chaque réseau en « Public » (un café, une gare) ou en « Privé » (la maison). Sur un réseau public, Windows empêche les ordinateurs de se voir. À la maison, il faut « Privé ».

1. Dans Duo, clique sur « Ouvrir les paramètres réseau ». Sinon: bouton Démarrer, « Paramètres », puis « Réseau et Internet ».
2. Clique sur « Wi-Fi » (ou sur « Ethernet » si le PC est branché par un câble), puis sur le nom de ton réseau, ou sur « Propriétés » à côté de ce nom.
3. Sous « Type de profil réseau », choisis « Réseau privé ».
4. Reviens dans Duo et clique sur « C'est fait, vérifier ».

Ce réglage vaut pour ce réseau seulement: dans un autre lieu, Windows reste prudent.

## 3. Sur le PC: le pare-feu de Windows bloque Duo

Ça arrive si quelqu'un a cliqué sur « Annuler » dans la fenêtre du pare-feu, au premier lancement de Duo. Windows ne repose plus jamais la question: il faut lui dire à la main que Duo a le droit.

Si Duo propose un bouton « Réparer », c'est le plus simple: clique dessus, puis réponds « Oui » à la fenêtre de Windows (elle parle de « Windows PowerShell », un outil de Windows que Duo utilise pour faire la correction).

Sinon, à la main:

1. Dans Duo, clique sur « Ouvrir le pare-feu ». Sinon: bouton Démarrer, tape « Autoriser une application via le Pare-feu Windows », puis ouvre ce qui s'affiche.
2. Clique sur « Modifier les paramètres » (Windows peut demander l'accord d'un administrateur).
3. Cherche « Duo » dans la liste. Coche sa case dans la colonne « Privé ». Laisse la colonne « Public » décochée. S'il y a deux lignes « Duo », fais-le sur les deux.
4. Si Duo n'est pas dans la liste:
   1. clique sur « Autoriser une autre application », puis sur « Parcourir »;
   2. dans la barre d'adresse de la fenêtre qui s'ouvre, tape `%LOCALAPPDATA%\Programs\duo` puis Entrée;
   3. choisis « Duo » (ou « Duo.exe »), clique sur « Ouvrir », puis sur « Ajouter »;
   4. coche la colonne « Privé » sur la nouvelle ligne.
5. Clique sur « OK », reviens dans Duo et clique sur « C'est fait, vérifier ».

## 4. Sur le PC: un autre pare-feu ou un antivirus

Certains antivirus (Norton, McAfee, Kaspersky, Bitdefender, Avast, AVG, ESET...) ont leur propre pare-feu, qui remplace celui de Windows. Si Duo en voit un, il te dit son nom.

1. Ouvre cet antivirus (son icône est souvent en bas à droite de l'écran, près de l'heure).
2. Cherche la partie « Pare-feu », puis une liste d'« Applications » ou de « Règles ».
3. Autorise Duo (ou « Duo.exe »), au moins sur le réseau de la maison. Si l'antivirus demande quel type de réseau est ta maison, choisis « réseau domestique », « de confiance » ou « privé ».
4. Reviens dans Duo et relance les vérifications.

Chaque antivirus range ces réglages à sa façon. En cas de doute, une photo de l'écran envoyée au studio permet de te guider.

## 5. Sur le Mac: macOS empêche Duo de voir le réseau local

Au premier lancement, macOS demande si Duo peut trouver des appareils sur le réseau local. Si la réponse a été non, ou si macOS repose la question après une nouvelle version de Duo et qu'elle est restée sans réponse, Duo ne voit plus l'autre ordinateur.

1. Dans Duo, clique sur « Ouvrir les Réglages Système ». Sinon: menu Pomme (en haut à gauche), « Réglages Système », « Confidentialité et sécurité », puis « Réseau local ».
2. Active l'interrupteur à côté de « Duo ».
3. Reviens dans Duo et clique sur « C'est fait, vérifier ». Si Duo ne voit toujours pas l'autre ordinateur, quitte Duo (touches Cmd + Q) et rouvre-le.

Si Duo n'est pas dans la liste « Réseau local »: quitte Duo, rouvre-le, et attends la question de macOS pour répondre « Autoriser ».

Bon à savoir: même sans cette autorisation, le PC peut encore se connecter au Mac en tapant l'adresse du Mac (partie 9). C'est une solution de secours en attendant.

## 6. Sur le Mac: le coupe-feu bloque Duo

Le coupe-feu de macOS est éteint d'origine. Si quelqu'un l'a allumé:

1. Menu Pomme, « Réglages Système », « Réseau », puis « Coupe-feu ».
2. Clique sur « Options ».
3. Cherche « Duo » dans la liste et choisis « Autoriser les connexions entrantes ». S'il n'y est pas, ajoute-le avec le bouton « + » (Duo est dans le dossier Applications).
4. Clique sur « OK », reviens dans Duo et relance les vérifications.

Si macOS demande un jour « Voulez-vous que l'application « Duo » accepte les connexions réseau entrantes ? », réponds « Autoriser ». Cette question peut revenir après une nouvelle version de Duo.

## 7. Le Wi-Fi « invités » et l'isolation des appareils

Beaucoup de box ont un deuxième Wi-Fi, pour les visiteurs. Sur ce Wi-Fi, chaque appareil a accès à Internet, mais les appareils ne peuvent pas se parler entre eux: c'est fait exprès, pour protéger la maison. Deux ordinateurs sur ce Wi-Fi ne peuvent donc pas jouer ensemble. Certaines box et certains répéteurs ont aussi une option « isolation » qui fait la même chose sur le Wi-Fi principal.

Comment le reconnaître:

- le nom du Wi-Fi contient « invités », « guest », « visiteurs » ou « public »;
- ou les deux ordinateurs ne sont pas sur un Wi-Fi du même nom;
- ou Duo te dit que vos deux ordinateurs ne semblent pas être sur le même réseau.

Que faire, du plus simple au moins simple:

1. Connecte les deux ordinateurs au Wi-Fi principal de la box: celui dont le nom et la clé sont écrits sur l'étiquette de la box.
2. Ou branche l'un des deux ordinateurs à la box avec un câble réseau. L'isolation ne vise souvent que le Wi-Fi: ça suffit en général.
3. En dernier recours, désactive l'option « isolation » dans les réglages de la box. Seulement si tu sais où elle se trouve; sinon, préfère le câble.

Bon à savoir: si ta box a deux Wi-Fi presque du même nom (par exemple « MaBox » et « MaBox-5G »), c'est le même réseau, sur deux fréquences: ça marche. Avec un répéteur qui a son propre nom (par exemple « MaBox_EXT »), ça marche aussi en général; si ce n'est pas le cas, connecte les deux ordinateurs au même nom de Wi-Fi.

## 8. Un VPN est actif

Un VPN est une application qui fait passer toute la connexion de l'ordinateur par un tunnel vers un autre endroit (par exemple NordVPN, ProtonVPN, Surfshark, ou le VPN du travail). Il peut cacher l'autre ordinateur de la maison.

1. Coupe le VPN le temps de jouer (dans son application: « Déconnecter »).
2. Ou, si l'application du VPN le propose, active l'option qui autorise le « réseau local » (son nom varie: « LAN », « réseau local », « appareils locaux »).
3. Reviens dans Duo et relance les vérifications.

## 9. Se connecter avec une adresse (dernier recours)

Si rien de ce qui précède ne marche, tu peux dire à Duo où est l'autre ordinateur. C'est à faire une seule fois: Duo retient l'adresse et la réessaie tout seul les fois suivantes.

1. Sur l'**autre** ordinateur, ouvre Duo, puis « Réglages » et « Réseau ». L'adresse est écrite en grand, par exemple « 192.168.1.42 ». Si cet ordinateur a ouvert un salon, elle s'y affiche aussi au bout de 20 secondes.
2. Sur **ton** ordinateur, dans Duo: « Que faire ? », puis « Se connecter avec une adresse ».
3. Tape l'adresse (des chiffres et des points; une virgule marche aussi), puis appuie sur Entrée.

Si le Mac n'a pas l'autorisation « Réseau local » (partie 5), c'est le PC qui doit taper l'adresse du Mac, pas l'inverse.

Ce que veulent dire les réponses:

- « Pas de réponse »: vérifie l'adresse, que Duo est ouvert sur l'autre ordinateur, et les parties 2 à 7.
- « Un appareil répond à cette adresse, mais ce n'est pas Duo »: l'adresse est celle d'un autre appareil de la maison. Recopie celle qu'affiche Duo sur l'autre ordinateur.

## 10. Pendant une partie: « Connexion perdue »

Si le réseau se coupe pendant une partie, Duo la met en pause sur les deux ordinateurs et réessaie tout seul, aussi longtemps qu'il le faut. Rien n'est perdu tant que Duo reste ouvert sur l'ordinateur qui héberge.

- Vérifie le Wi-Fi de l'ordinateur qui a perdu la connexion. Duo te dit si c'est le tien qui est coupé.
- Ne ferme pas Duo. Dès que le réseau revient, Duo retrouve l'autre ordinateur, puis vous choisissez « Reprendre » sur les deux.
- Un ordinateur mis en veille (couvercle fermé) coupe aussi la connexion: rouvre-le, Duo se reconnecte.
- Tu peux toujours choisir « Arrêter la partie »: la progression est gardée jusqu'à la dernière sauvegarde.

## 11. La partie saccade ou réagit en retard

1. Rapproche les ordinateurs de la box, ou branche l'un des deux par un câble réseau: c'est le plus efficace.
2. Pendant la partie, évite les gros téléchargements et les vidéos sur les autres appareils de la maison.
3. Branche le PC portable sur le secteur: sur batterie, Windows peut ralentir le Wi-Fi pour économiser l'énergie.
4. Si ta box a un Wi-Fi « 5G » (ou « 5 GHz ») et que vous êtes dans la même pièce qu'elle, connecte-toi plutôt à celui-là.

## 12. Rien ne marche: envoyer un rapport au studio

1. Dans Duo: « Que faire ? », puis « Copier le rapport pour le studio » (ou « Réglages », « À propos »).
2. Duo te montre le rapport avant de le copier. Il ne contient aucune information personnelle en dehors de vos pseudos: ni nom d'ordinateur, ni nom de Wi-Fi, ni mot de passe.
3. Colle-le dans ton message au studio. Fais-le sur les deux ordinateurs si tu peux: le studio voit ainsi ce que chacun voit de l'autre.
