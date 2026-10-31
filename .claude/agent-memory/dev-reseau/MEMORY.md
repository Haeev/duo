# Carnet de dev-reseau

Apprentissages durables et vérifiés. Ni avancement ni secret.

## Conventions du studio pour le réseau

- Vocabulaire: « liaison » (connexion permanente entre les deux Duo, indépendante des rôles), « transfert » (seconde connexion pour les gros contenus), « balise » (annonce UDP), « requête » (demande de réponse directe), « clé du duo ». Hôte et invité ne sont que des rôles d'un salon.
- Port 39420 en UDP et en TCP (replis TCP 39421 et 39422). Détail et valeurs: `docs/plateforme/reseau.md`; décisions: ADR 0007 et 0008.
- ADR du studio: tableau d'en-tête (Statut, Date, Rédacteur, À relire par, Fonctions du cahier, Liens), Contexte, Options en tableaux, Décision, Conséquences, « À vérifier ». Index et règles dans `docs/plateforme/decisions/README.md`. Docs: pas d'espace avant « : » dans la prose; les libellés d'interface cités gardent leur forme (« Que faire ? »).
- D'autres membres écrivent en parallèle dans le même arbre de travail (ADR, `architecture.md`): relire leurs fichiers au début et à la fin, et revérifier les numéros de section cités (l'architecture a été renumérotée pendant une mission).

## Environnement cloud (vérifié le 2026-10-30)

- `ip`, `nft` et `tc` présents, root avec droits réseau; `ping` absent. Noyau sans netem ni fq_codel, mais avec TBF et HTB: `tc qdisc replace dev <veth côté pont> root tbf rate 40mbit burst 32kb latency 100ms` imite un point d'accès Wi-Fi (débit et file).
- Banc minimal: deux espaces de noms reliés par un pont (script dans le carnet de qa-testeur, ou `ip link add ... type bridge` puis deux paires veth). Horloge commune aux espaces de noms: délais d'un sens exacts avec `performance.timeOrigin + performance.now()`.
- Coupure « sur le trajet » sans perte d'adresse: `nft add rule inet <table> <chaîne input> iifname <veth> drop` des deux côtés, puis `flush chain`. Désactiver l'interface imite plutôt un Wi-Fi coupé sur une machine. Pertes aléatoires: `numgen random mod 100 < 2 drop`, à mettre dans les deux sens pour toucher aussi les accusés TCP.
- Playwright global: `NODE_PATH=$(npm root -g) node script.js`. Valider des schémas Mermaid: `npm install mermaid@11` dans le dossier temporaire, rendre chaque bloc avec `mermaid.render` dans Chromium, puis examiner les captures.
- Sources lisibles: TN3179 en Markdown (`https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy.md`), documentation d'Electron sur `raw.githubusercontent.com/electron/electron/v<version>/docs/...`.

## Mesures de référence (Linux, `ws` 8.22.0, 2026-10-30)

- Découverte requête plus réponse directe entre deux espaces de noms: 5 à 9 ms; avec 30 % de pertes en réception, 2,8 s au pire (requêtes à 0, 300, 1 000 ms et balise chaque seconde).
- Vivacité, perte à 2 s de silence: une coupure de 500 ms laisse au plus 1,43 s de silence (battement de 500 ms). Une coupure d'1 s déclenche la perte à cause du recul des réémissions TCP (200, 400, 800 ms), sauf avec une reconnexion anticipée dès 1 s de silence sur une connexion neuve (essai toutes les 250 ms): alors aucune perte, relais pris 30 à 270 ms après le retour du lien. Un battement à 250 ms n'apporte rien. Coupure franche: perte déclarée 1 995 à 2 047 ms après, liaison rétablie 48 à 72 ms après le retour.
- Piège d'essai: relancer aussi sur l'événement `close` du socket, pas seulement sur le silence, sinon 2 s perdues quand l'autre côté a fermé.
- 2 % de pertes réelles en TCP: flux à 30 Hz, 99,9e centile 592 ms, maximum 625 ms; flux à 60 Hz, 218 et 236 ms. Plus le flux est clairsemé, pires sont les à-coups (moins d'accusés en double, réémission par délai).
- Gros transfert sur la même connexion WebSocket que les messages de jeu: 240 ms de retard médian (le tampon d'envoi de TCP ne se double pas); connexion à part: 7 ms; à part et régulée à 2 Mio/s: 6 ms au 95e centile.
- Erreurs de `net.connect` sous Linux: personne à l'adresse, `EHOSTUNREACH` en 3 s; port fermé, `ECONNREFUSED` en 1 ms; paquets jetés, aucune réponse. Envoi UDP sur interface désactivée: `ENETUNREACH`, socket intacte.
- `ws` appelle `setNoDelay()` sur chaque socket. `node:crypto` a X25519 (`diffieHellman`), `hkdfSync`; `node:perf_hooks` a `monitorEventLoopDelay`; `dgram` accepte `reusePort` sous Node 22.

## Paquet `@duo/liaison` (vérifié le 2026-10-31)

- Node 22.22 exécute le TypeScript tel quel si les imports portent `.ts`: `allowImportingTsExtensions` et `erasableSyntaxOnly` dans le tsconfig (ni propriétés de paramètres de constructeur, ni `enum`). Un script `.mjs` du dossier temporaire peut importer `packages/liaison/src/x.ts` par son chemin: les dépendances se résolvent depuis le paquet. Le paquet doit être regroupé par electron-vite (`externalizeDepsPlugin({ exclude: ['@duo/liaison'] })`), `ws` restant externe.
- `ws` 8.22: codes de fermeture admis 1000 à 1003, 1007 à 1014 et 3000 à 4999; la fermeture propre attend 30 s une réponse, d'où `terminate()` après 1 s. Le client n'envoie pas d'`Origin` sans option. Une socket sans écouteur `message` perd ses trames: abonner dès l'ouverture et garder une file jusqu'aux gestionnaires.
- Piège: un plafond de débit compté à l'arrivée jette la rafale légitime d'une reprise (entrées perdues). Plafond strict à l'envoi, seau à jetons à grande rafale (30 s) à la réception.
- Piège: au passage en régime actif, réarmer tout de suite le battement (sinon la cadence de repos de 2 s court jusqu'au tour suivant, silence d'1 s, reconnexion anticipée inutile) et compter le silence depuis le début du régime actif.
- Banc simulé: un processus « tué » doit se taire (ses minuteurs tournent encore sur l'horloge commune) et laisser une machine sans écoute (refus net). `stop()` attend les adieux UDP espacés de 50 ms: en temps simulé, avancer l'horloge avant d'attendre la promesse.
- Mesures du banc simulé: pause demandée par l'invité en R1, médiane 56 ms, 95e centile 90 ms, maximum 285 ms (200 essais); coupure franche en partie, pause des deux côtés 2 045 ms après; découverte en R1, 278 à 514 ms. Deux processus sur la boucle locale: découverte une vingtaine de millisecondes après le second démarrage, décompte et départ alignés à 1 ms.
- Copie isolée (worktree): l'outil Bash refuse les commandes composées qui mentionnent git, `--exclude-dir=.git` ou un `cd` hors de la copie. Une commande git par appel; pour les tirets, `pnpm verifier` ou un grep sur les dossiers voulus.

## Systèmes (faits lus, à confirmer sur les machines du client)

- macOS, TN3179: autorisation « Réseau local » exigée pour TCP sortant vers le LAN, tout envoi UDP, la connexion d'une socket UDP, la réception de diffusion; pas pour écouter et accepter en TCP ni recevoir de l'UDP unicast. Interfaces VPN hors du « réseau local ». Aucune API pour lire l'état; première opération parfois refusée avant la réponse; connecter une socket UDP à une adresse locale déclenche l'alerte sans trafic. Ne jamais supposer `en0` = Wi-Fi.
- Conséquence utile: un Mac sans autorisation accepte encore la liaison ouverte par le PC vers son adresse retenue; un PC dont le pare-feu bloque l'entrée peut encore appeler le Mac. Toujours laisser la liaison s'établir dans un sens ou dans l'autre.
- Windows: lire pare-feu et profil par objets PowerShell (`Get-NetConnectionProfile`, `Get-NetFirewallApplicationFilter`, `Get-NetFirewallRule`, `Get-NetFirewallProfile`, `root/SecurityCenter2 FirewallProduct`), jamais le texte de `netsh` (langue). Passer les commandes par `-EncodedCommand` (chemins accentués). Duo s'installe dans `%LOCALAPPDATA%\Programs\duo\Duo.exe` (ADR 0011).
