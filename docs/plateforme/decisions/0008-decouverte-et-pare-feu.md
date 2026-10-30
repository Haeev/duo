# ADR 0008: Découverte et pare-feu

| Champ | Valeur |
|---|---|
| Statut | acceptée (manager, 2026-10-30) |
| Date | 2026-10-30 |
| Rédacteur | dev-reseau |
| À relire par | architecte-technique (cohérence avec les ADR 0003, 0006, 0009), ingenieur-build (`Info.plist`, pare-feu et installation, ADR 0011), ux-ui-designer (E03, E04, E17, textes proposés), qa-testeur (critères F02) |
| Fonctions du cahier | F02, F13 (versions comparées dès que les machines se voient), F14 (partie réseau du rapport); parcours 1 et 8 |
| Liens | `docs/plateforme/reseau.md` (sections 4, 5, 16 et 17), ADR 0003 (aucune socket avant E03, ligne de commande), 0006 (enveloppe figée de la balise), 0007 (liaison), 0011 (installation et signature), 0015 (rapport) |

## Contexte

F02 (cahier 1.0): « Chaque Duo ouvert s'annonce sur le réseau local: l'autre ordinateur apparaît en 3 secondes au plus, salon ouvert ou non. Connexion par adresse IP en recours, adresse retenue. Le diagnostic teste la visibilité dans les deux sens, nomme la cause quand elle est détectable (réseau classé Public sous Windows, autorisation refusée, aucune connexion au réseau local), ouvre le bon réglage du système et guide pas à pas sinon. » Parcours 1: l'explication vient avant la fenêtre du système. CA-PF-079: aucune socket avant la validation de l'écran E03.

Faits relevés:

- macOS 15 et suivants (TN3179, révisée le 2026-10-06, lue le 2026-10-30): l'autorisation « Réseau local » est exigée pour une connexion TCP sortante vers le réseau local, tout envoi UDP, la connexion d'une socket UDP et la réception de diffusion ou de multicast; elle ne l'est pas pour écouter et accepter des connexions TCP, ni pour recevoir de l'UDP unicast. Le réseau local exclut les interfaces VPN. Aucune API ne dit si l'application a l'autorisation. Le système peut refuser la première opération avant la réponse de l'utilisateur. Connecter une socket UDP à une adresse locale fait apparaître l'alerte sans rien émettre. Apple conseille, pour une découverte maison par diffusion, de la faire sur toutes les interfaces qui diffusent, et de ne jamais supposer que `en0` est le Wi-Fi. L'autorisation suit l'application par sa signature, peu fiable avec une signature ad hoc, et dépend de l'UUID de l'exécutable principal (rendu propre à Duo par l'ADR 0011). `NSBonjourServices` ne sert qu'aux services Bonjour; aucun droit multicast n'est exigé sous macOS.
- Windows (à vérifier sur le PC, `architecture.md` section 7.3): la première écoute déclenche l'alerte du pare-feu; l'autoriser demande l'accord d'un administrateur; « Annuler » crée des règles de blocage silencieuses; un réseau « Public » bloque les connexions entrantes; installation par utilisateur, au même chemin d'une version à l'autre (ADR 0011). Les connexions sortantes ne sont pas bloquées par défaut.
- Essai jetable du 2026-10-30 (`reseau.md`, section 20): entre deux espaces de noms, un Duo qui démarre voit l'autre en 5 à 9 ms par requête et réponse directe; avec 30 % de pertes, en 2,8 s au pire; erreurs de connexion distinctes selon la cause (refus en 1 ms, hôte injoignable en 3 s, aucune réponse quand un pare-feu jette).

## Options

### 1. Mécanisme de découverte

| Option | Pour | Contre |
|---|---|---|
| A. Diffusion UDP dirigée sur chaque interface privée, annonces périodiques de chaque Duo et requêtes avec réponse directe (unicast), plus sondes TCP vers les adresses retenues du partenaire | aucune dépendance; identique sur les deux systèmes; suit le conseil de TN3179 pour une découverte maison; la réponse directe passe là où une diffusion se perd ou est bloquée en entrée; les adresses retenues marchent même sans autorisation « Réseau local » côté Mac | à écrire (petit); interfaces multiples à gérer |
| B. mDNS et DNS-SD (`bonjour-service`, JavaScript) | standard, conseillé par Apple | Windows a son propre répondeur mDNS sur le port 5353 (partage du port à éprouver), Bonjour absent par défaut sous Windows, `NSBonjourServices` à déclarer; même autorisation « Réseau local »; dépendance de plus pour le même service |
| C. Multicast IPv4 maison (groupe administré localement) | moins de bruit que la diffusion | inscription au groupe par interface, comportement inégal des box et des répéteurs Wi-Fi (surveillance IGMP), aucun avantage pour deux machines |
| D. Saisie d'adresse seule | rien à écrire | contraire à F02 et au pilier « zéro friction » |

### 2. Qui s'annonce

| Option | Pour | Contre |
|---|---|---|
| A. L'hôte seulement, pendant qu'un salon est ouvert | moins d'annonces | pas de présence hors salon, pas de comparaison des versions avant l'invitation: contraire à F02 1.0 et à H-34 |
| B. Chaque Duo ouvert, après l'accord du premier lancement | présence permanente, versions comparées dès que les machines se voient (ADR 0006) | une balise par seconde et par machine (quelques centaines d'octets) |

### 3. Ports

| Option | Pour | Contre |
|---|---|---|
| A. Port fixe 39420 en UDP et en TCP, deux replis TCP annoncés dans les balises | une diffusion n'est reçue que sur un port connu de tous; la connexion par adresse n'exige aucun port (H-05) | un autre programme pourrait occuper le port |
| B. Port TCP éphémère annoncé par la balise | jamais de conflit | connexion par adresse impossible sans taper de port; règle du pare-feu inchangée de toute façon (elle vise le programme) |

### 4. Moment des autorisations

| Option | Pour | Contre |
|---|---|---|
| A. À la première utilisation (premier salon) | rien à prévoir | la fenêtre du système surgit sans explication, au pire moment; contraire au parcours 1 et à CA-PF-079 |
| B. Volontairement, juste après l'écran d'explication E03 du premier lancement | l'explication précède la fenêtre; le joueur sait quoi répondre | aucun |

### 5. Règle du pare-feu de Windows (variante laissée par l'ADR 0011)

| Option | Pour | Contre |
|---|---|---|
| A. Alerte habituelle de Windows à la première écoute, préparée par E03 | fenêtre connue de Windows; aucune demande en plus | « Annuler » crée des règles de blocage; la case « Réseaux publics » peut prêter à confusion |
| B. Règle « Privé » créée par Duo avant l'écoute, par une demande d'élévation explicite (`powershell.exe`, éditeur vérifié Microsoft) | aucune règle de blocage possible; seul le profil Privé est ouvert | une demande d'élévation pour un motif peu clair au premier lancement; si elle est refusée, l'alerte de Windows vient quand même: deux demandes à la suite |
| C. Installation par machine qui crée la règle | aucune alerte | droits d'administrateur à chaque mise à jour; écartée par l'ADR 0011 |

### 6. Lecture de l'état des pare-feux pour le diagnostic

| Option | Pour | Contre |
|---|---|---|
| A. PowerShell (`Get-NetConnectionProfile`, `Get-NetFirewallApplicationFilter`, `Get-NetFirewallRule`, `Get-NetFirewallProfile`, Centre de sécurité) sous Windows; `socketfilterfw`, `networksetup`, `scutil` et un essai d'envoi sous macOS | objets indépendants de la langue du système (ADR 0011); outils présents sur les deux systèmes | une à trois secondes de PowerShell sur l'i3; lecture sans droits à vérifier |
| B. Analyse du texte de `netsh` | rapide | texte traduit selon la langue du système: le PC est en français, la CI en anglais |
| C. Module natif (COM `INetworkListManager`, API du pare-feu) | précis et rapide | module natif à construire pour Windows, contraire au principe d'une application sans `node_modules` natif |

## Décision

**1-A, 2-B, 3-A, 4-B, 5-A avec B en réparation, 6-A.** Détail dans `reseau.md`.

### 1. Découverte et présence

- Après la validation de E03 et tant que Duo est ouvert: socket UDP sur `0.0.0.0:39420` (`reuseAddr`, diffusion permise), écoute TCP sur `0.0.0.0:39420` (replis 39421 et 39422). IPv4 seulement.
- Interfaces retenues: adresses IPv4 non internes en 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 ou 169.254.0.0/16; relues toutes les 2 s (chaque seconde quand la liaison manque). Émission sur toutes, par diffusion dirigée (adresse de diffusion de chaque interface). Classement pour l'affichage et l'ordre des essais: interfaces où le partenaire a été vu, puis Wi-Fi et Ethernet physiques (`Get-NetAdapter` sous Windows, `networksetup` sous macOS), puis adaptateurs virtuels et VPN.
- Balise JSON de 1 200 octets au plus, dont l'enveloppe figée de l'ADR 0006 (`app`, `envelope`, `type`, `machine`, `appVersion`, `protocol`), puis instance, port TCP ouvert, profil, nom de l'ordinateur, état de la configuration, empreintes courtes des duos, adresses. Validée par schéma; 20 datagrammes par seconde et par source au plus.
- Cadences: balise chaque seconde (plus ou moins 100 ms); requêtes à 0, 250, 750 et 1 500 ms après le démarrage, après un changement d'interface et à l'ouverture de E04 ou E17, puis toutes les 5 s tant que le partenaire n'est pas relié; réponse directe aussitôt (0 à 50 ms); sondes TCP des adresses retenues toutes les 5 s tant que le partenaire n'est pas relié; `bye` envoyé trois fois à la fermeture.
- Une balise ne fait rien apparaître à l'écran: elle déclenche une tentative de liaison (ADR 0007). Le partenaire est présent quand la liaison est authentifiée. Une machine vue seulement par ses balises expire au bout de 5 s.
- Un protocole différent, lu dans l'enveloppe figée, suffit à afficher M-27 des deux côtés.
- Connexion par adresse: les trois ports essayés en parallèle, 5 s au plus; l'adresse qui a marché est retenue dans `reseau.json` et sondée ensuite à chaque démarrage. Messages selon la cause: Duo fermé à cette adresse (refus), personne à cette adresse (hôte injoignable), aucune réponse, pas Duo, protocole différent.
- Ligne de commande (ADR 0003, point 9): `--duo-port=<n>`, `--duo-peer=<adresse>:<port>` (répétable, pour les tests sur la boucle locale), `--duo-allow-loopback`.

### 2. Déclenchement des autorisations (écran E03)

- **Windows**: avant toute socket, lecture du profil du réseau (`Get-NetConnectionProfile`); s'il est Public, sous-écran « Ton réseau est réglé sur Public » d'abord. À « Continuer »: écoute TCP, qui déclenche l'alerte du pare-feu; puis lecture des règles qui visent `Duo.exe`. L'alerte arrive donc au premier lancement, à l'écran E03, et non au premier salon (l'ADR 0011, section 3.4, est à ajuster sur ce point).
- **macOS**: à « Continuer », écoute TCP et socket UDP (sans autorisation requise), puis socket UDP connectée à l'adresse de diffusion locale, qui fait apparaître l'alerte « Réseau local ». Réponse lue par un essai d'envoi au retour du focus sur la fenêtre de Duo, puis chaque seconde; « macOS bloque Duo » seulement après deux refus à 1 s d'écart, focus revenu.
- **`Info.plist`** (ingenieur-build): `NSLocalNetworkUsageDescription` avec le texte de l'UX (« Duo cherche l'autre ordinateur de votre duo sur le réseau de la maison, pour lancer vos parties. »); pas de `NSBonjourServices`; `NSAppSleepDisabled` à essayer sur le Mac (battements d'un Duo caché, ADR 0007).

### 3. Pare-feu de Windows

- Au premier lancement, l'alerte habituelle de Windows (option 5-A), préparée par E03.
- En cas de refus ou de règle absente, un bouton « Réparer » (proposition à ux-ui-designer) supprime les règles de blocage de Duo et crée une règle d'entrée « Privé » pour `%LOCALAPPDATA%\Programs\duo\Duo.exe`, par une demande d'élévation explicite (option 5-B, en réparation seulement). Même principe pour passer le réseau en Privé (`Set-NetConnectionProfile`). Les étapes à la main restent affichées en second.
- Commandes PowerShell lancées avec `-NoProfile -NonInteractive -EncodedCommand` (le chemin de Duo peut contenir espaces et accents), délai de 8 s, résultats en JSON, jamais le texte de `netsh`.

### 4. Diagnostic

- Vérifications locales lancées ensemble: réseau présent; profil Privé (Windows); règles du pare-feu et état de ses profils (Windows); pare-feu d'un autre éditeur déclaré au Centre de sécurité (Windows); autorisation « Réseau local » par essai d'envoi (macOS); coupe-feu par `socketfilterfw` (macOS); VPN probable, par une fonction pure sur la liste des interfaces (plus `scutil --nc list` sous macOS); ports obtenus. Chacune a trois issues: réussi, problème, à vérifier soi-même; résultats en moins de 10 s (CA-PF-119), en moins de 5 s pour la vérification propre au système (CA-PF-013 à 016).
- Visibilité dans les deux sens: si la liaison existe dans un sens, chaque machine sonde l'autre sens (connexion neuve vers `/duo/sonde`, datagrammes directs et diffusés) et lui rend compte par la liaison; un tableau de verdicts désigne le côté du blocage (M-32) et sa cause probable.
- Wi-Fi invités et isolation: jamais affirmés, car indiscernables d'un pare-feu qui jette les paquets; indices donnés quand l'adresse retenue du partenaire est dans un autre réseau, ou quand la box répond mais pas le partenaire. Le nom du Wi-Fi n'est pas lu.
- Réglages ouverts par une liste fermée d'adresses (`ms-settings:`, panneau du pare-feu, `x-apple.systempreferences:`), à vérifier sur les machines (`reseau.md`, section 16.3).
- Partie réseau du rapport pour le studio: `reseau.md`, section 17.5, avec le nettoyage de l'ADR 0015.

## Conséquences

- L'autre ordinateur apparaît en quelques millisecondes dans le cas ordinaire, et en moins de 3 s même avec de fortes pertes de diffusion.
- Trois chemins indépendants (balises, réponses directes, adresses retenues) se complètent: un PC dont le pare-feu bloque l'entrée voit quand même le Mac par les réponses à ses requêtes (si Windows les admet comme le veut son réglage par défaut, à vérifier), et un Mac privé d'autorisation reste joignable à son adresse retenue.
- La fenêtre du pare-feu de Windows et celle de macOS apparaissent au premier lancement, juste après leur explication.
- Le diagnostic nomme la cause dans les cas détectables (aucun réseau, réseau Public, règle de blocage, pare-feu d'un autre éditeur, autorisation « Réseau local », coupe-feu, VPN, blocage d'un seul côté) et donne des indices pour le reste (Wi-Fi invités, isolation, Duo fermé de l'autre côté).
- Coût: PowerShell sous Windows (une à trois secondes par lecture, hors du chemin critique, mise en cache 30 s); petit code de diffusion et de classement des interfaces, testable en unitaire.
- Écarts avec `architecture.md`: chaque Duo s'annonce et répond aux requêtes (au lieu de « l'invité interroge, l'hôte répond »); écoute permanente; alerte du pare-feu au premier lancement plutôt qu'au premier salon.

### À vérifier

- PC: alerte du pare-feu à la première écoute TCP (libellés, accord d'un administrateur), règles créées par « Annuler », alerte éventuelle à l'ouverture de la socket UDP; réponse directe à une requête admise par le pare-feu sans règle d'entrée, sur un réseau Public et malgré une règle de blocage de Duo; lecture des règles et du profil sans droits d'administrateur; durée de PowerShell sur l'i3; demande d'élévation de « Réparer ».
- Mac: alerte déclenchée par la socket UDP connectée; erreur renvoyée en cas de refus (`EHOSTUNREACH` attendue); prise en compte d'un changement dans Réglages Système sans relancer Duo; tenue de l'autorisation d'une version à la suivante (signature ad hoc, UUID réécrit, ADR 0011); lecture du coupe-feu sans droits; App Nap.
- Les deux: adresses des réglages à ouvrir; Wi-Fi invités ou isolation de la box du client, s'il y en a.
