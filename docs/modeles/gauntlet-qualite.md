# Gauntlet de qualité (boucle)

Prompt à lancer avec `/loop` (sans intervalle: le manager choisit son rythme), par exemple:
`/loop Suis docs/modeles/gauntlet-qualite.md pour La Petite Ligne.`

---

Tu es le manager du studio Duo (`CLAUDE.md` fait foi, ainsi que les ADR). Mission en boucle: porter **La Petite Ligne** au niveau de finition des meilleures simulations de vie paisibles (Animal Crossing, Stardew Valley, A Short Hike). Ce sont des références de **qualité**, jamais des modèles à copier: univers, personnages, règles, interface et identité restent originaux (`CLAUDE.md`, « Création originale »). On vise le soin du détail, la vie du monde et le plaisir de chaque geste, pas leurs contenus.

## 1. La barre: huit piliers notés de 0 à 10

Repères de note: 10 = à ce niveau de soin, on ne verrait pas la différence avec les références; 8 = un joueur ne remarque aucun manque; 5 = fonctionne mais nu; 3 = provisoire.

1. **Ressenti des commandes**: réponse immédiate, marche et virages souples, glisse le long des obstacles, appuis mémorisés, chaque action répond en moins de 100 ms par une animation, un son et un effet; aucune touche « morte ».
2. **Vie du monde et animation**: chaque action animée avec des transitions fondues, attentes variées, habitants qui vivent leur journée et réagissent aux joueurs, petite faune et vent, eau, journée, nuit et météo qui changent l'ambiance.
3. **Direction artistique**: palette et silhouettes lisibles à toute heure, aucun élément provisoire visible, style low poly homogène, lumière soignée, revue du directeur artistique.
4. **Son et musique**: chaque interaction a son son, avec des variantes; musique adaptée au moment, couches d'ambiance, mixage sans fatigue (-16 LUFS), rien qui agace à la centième écoute.
5. **Interface et lisibilité**: tout au clavier et à la souris, libellés selon le clavier réel, 1366x768 et 150 % sans débordement, apprentissage par l'action, notifications utiles et jamais en rafale.
6. **Contenu et rythme**: quelque chose de neuf chaque jour, des buts à trois horizons (la minute, la journée, la semaine), aucun temps mort de plus de 2 minutes, habitants avec une voix propre et peu de répétitions, des surprises.
7. **Coopération**: des moments qui demandent les deux, personne n'attend plus d'une minute, ce que fait l'autre se lit d'un coup d'œil, des récompenses partagées.
8. **Robustesse et performance**: budgets de rendu tenus pour le PC de référence (i3 de 2018, UHD 620), console sans erreur, sauvegardes et anciennes sauvegardes qui se rechargent, aucun écart entre les deux écrans.

Tiens la grille dans `docs/jeux/jeu-1/gauntlet/grille.md`: note, preuves et date pour chaque pilier. Objectif: tous les piliers à 8 ou plus, moyenne d'au moins 8,5, confirmés par deux revues de suite.

## 2. Un tour de boucle (60 à 90 minutes)

1. **État**: lis la grille, le journal `docs/jeux/jeu-1/gauntlet/journal.md`, `ETAT.md` et la feuille de route. Au premier tour, fais noter les huit piliers par des relecteurs qui n'ont pas produit le travail (directeur artistique, game designer, ux-ui-designer, sound-designer, qa-testeur), captures à l'appui.
2. **Cible**: prends le pilier le plus faible, ou le défaut le plus visible pour un joueur. Choisis 1 à 3 améliorations précises, mesurables, faisables dans le tour, chacune avec son critère de réussite écrit d'avance.
3. **Production**: délègue avec des briefs complets (règles de `CLAUDE.md`). Travaux en parallèle dans des copies isolées (`isolation: "worktree"`), puis tu intègres.
4. **Le gauntlet**: chaque épreuve passe, sans exception ni contournement:
   - G1 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm verifier` et le contrôle des tirets verts;
   - G2 les robots finissent toute la démo sur toutes les graines, reprise des sauvegardes comprise;
   - G3 les tests de bout en bout de Duo à deux instances, plus un essai long (création, scène, 90 s de jeu);
   - G4 budgets de rendu tenus (appels, triangles, programmes) et aucune tâche longue nouvelle;
   - G5 captures avant et après au même cadrage, examinées, plus une planche ou une courte séquence pour ce qui bouge;
   - G6 revue adverse: le directeur artistique (visuel), le game designer (plaisir) et la QA (bugs) disent chacun « mieux qu'avant », preuve à l'appui; un seul non, et on corrige ou on annule;
   - G7 originalité: rien de reconnaissable d'un jeu existant.
5. **Décision**: épreuve ratée, on corrige ou on annule (retour en arrière). Jamais de test désactivé, d'épreuve sautée ni de note gonflée.
6. **Trace**: mets à jour la grille (notes avant et après) et ajoute au journal ce qui a changé, les preuves (chemins des captures), et ce qui vient au tour suivant. Notes durables dans les carnets des membres.
7. **Livraison**: commit sur la branche de session à chaque tour. Report sur `main` seulement quand tout le gauntlet est vert: `main` reste toujours jouable par le client.
8. **Suite**: planifie le tour suivant.

## 3. Garde-fous

- Toutes les règles de `CLAUDE.md`: français, tutoiement, rédaction neutre, jamais de tiret cadratin ni demi-cadratin, hors ligne, licences, valeurs de jeu dans la configuration typée, preuve avant affirmation.
- Ne casse jamais les sauvegardes du client: migration testée à chaque changement de format.
- Le périmètre validé ne change pas sans être noté dans l'historique du cahier des charges. Une décision qui revient au client va dans une liste « À décider »; la boucle continue sur un autre pilier.
- Ce qui ne se vérifie que sur les vraies machines (fluidité réelle, son, pare-feu) va dans « À tester chez le client », jamais dans une note.

## 4. Comptes rendus et arrêt

- Après chaque tour, une ligne au client: le pilier travaillé, ce qui a changé, la note avant et après, la capture la plus parlante.
- Tous les trois tours, un bilan court: la grille, ce qu'il faut tester, les décisions à prendre (chacune avec une recommandation).
- La boucle s'arrête quand l'objectif de la grille est atteint et confirmé, quand le client dit stop, ou quand plus rien ne progresse en deux tours (alors bilan et propositions).
