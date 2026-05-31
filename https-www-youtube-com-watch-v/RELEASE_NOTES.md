# Release notes

## v6.10

- Separation des controles vocaux joueur.
- Ajout d'un bouton pour couper uniquement son micro tout en continuant d'entendre le vocal.
- Ajout d'un bouton sourdine totale qui coupe le micro et l'ecoute.
- Le joueur mute reste dans son vocal et peut toujours entendre les autres.

## v6.9

- Ajout des parties publiques visibles directement sur la page joueur.
- Ajout de la creation de partie publique ou privee depuis le lobby joueur.
- Ajout de la jonction par code pour les parties privees, avec message si le code est introuvable.
- Correction du chargement des images sur le serveur deploye.

## v6.8

- Le bloc Phase actuelle est uniformise pour les joueurs vivants : Discussion Saloon ou Duel en cours.
- La revelation de duel s'affiche dans un panneau a droite, sans remplacer la carte role du joueur.
- Les choix Tirer / Ne pas tirer restent modifiables jusqu'a la fin du duel.
- Le tir du sheriff reste instantane.
- Les boutons Tirer, Ne pas tirer et Tir du sheriff passent en style western avec icones integrees.
- Le theme visuel est assombri en noir/marron avec textures bois, fond western et touches saloon sur les ecrans existants.

## v6.7

- Les actions de duel sont regroupees au centre de la zone droite sur PC.
- Tir du sheriff reste au-dessus de Tirer / Ne pas tirer.

## v6.6

- Les joueurs hors duel voient maintenant "Duel en cours" quand leur representant est parti.
- Le bloc de vote affiche le saloon du joueur puis "Choisir qui va au duel".
- Le sous-texte redondant est retire du bloc Phase actuelle pendant la discussion.
- Sur PC, les actions Tirer / Ne pas tirer et Tir du sheriff passent dans la zone de droite.

## v6.5

- Reprise de la disposition desktop joueur pour eviter le layout mobile agrandi.
- Suppression du bloc message redondant en bas a gauche sur PC.
- Sur PC, les panneaux sont organises en zones : phase, role, timer, actions, vocal et contenu secondaire.

## v6.4

- Ajout d'une vraie disposition PC navigateur pour l'ecran joueur.
- Sur grand ecran, role, timer, vote/actions, message et vocal sont visibles en colonnes.
- Reduction du besoin de scroller avec la molette sur PC.
- La disposition mobile verticale reste conservee pour les petits ecrans.

## v6.3

- Les boutons Tirer / Ne pas tirer remontent juste sous la carte role pendant le duel.
- Le bouton Tir du sheriff est place avec les actions de duel.
- Le timer, le message et le vocal restent sous les actions.

## v6.2

- En discussion et pendant le vote, la carte role reste toujours visible.
- Le bloc vote est ajoute sous le message de discussion au lieu de remplacer la carte role.
- Le flow discussion suit : titre, role, timer, consigne, vote, vocal.

## v6.1

- Reprise plus stricte de l'ecran joueur de reference.
- Le role est affiche dans une vraie carte centrale "Ton role".
- Le role reste visible pendant la discussion et les autres phases.
- Suppression de l'onde micro decorative dans le bloc vocal.

## v6.0

- Refonte du flow visuel des ecrans joueurs pour coller a la planche de reference.
- La phase devient le titre principal de chaque ecran joueur.
- Les ecrans discussion, vote, duel, resultat et spectateur ont un ordre visuel dedie.
- Theme western sombre/or renforce sur les cartes, timers, boutons et panneaux.

## v5.9

- Unification visuelle vers un theme western sombre/or sur les ecrans de jeu.
- Ajout d'une vue spectateur pour les joueurs elimines.
- Les joueurs elimines voient les saloons, le duel, les elimines et les roles reveles.
- Les joueurs vivants gardent leur affichage normal et ne voient pas cette vue.

## v5.8

- Suppression de l'ambiance sonore de saloon.
- Conservation uniquement des effets sonores utiles : cloche et revolver.
- Le menu audio garde le volume du chat vocal et des effets sonores.

## v5.7

- Les duellistes restent dans le vocal Duel pendant toute la phase de revelation/resultat.
- Le retour vers les saloons se fait seulement apres la fin du resultat.

## v5.6

- Le vocal Preparation est reserve au lobby avant le lancement de la partie.
- Un joueur qui rejoint une partie deja lancee est place hors partie jusqu'a la prochaine manche.
- Les joueurs hors partie ne sont plus melanges avec les vocaux Preparation, Saloon ou Duel.

## v5.5

- Correction du vocal pendant un duel lance : les deux duellistes vont bien dans le vocal Duel.
- Les autres joueurs restent dans leur Saloon A ou Saloon B pendant le duel.
- La phase interne "idle" du duel ne renvoie plus les joueurs en Preparation par erreur.

## v5.4

- Ajout d'un bouton "Changer de partie" pour revenir au lobby si un joueur rejoint le mauvais code.
- Le bouton coupe le vocal local, retire le joueur de la partie courante et nettoie son code memorise.

## v5.3

- Clarification du vote de saloon : le vote choisit uniquement le representant qui part au duel.
- Seuls les deux joueurs designes basculent dans le vocal Duel.
- Tous les autres joueurs restent dans leur Saloon A ou Saloon B pendant le duel.
- Les messages joueurs indiquent simplement "Tu es designe" pour le duelliste.
- L'interface joueur evite de repeter le saloon dans plusieurs blocs.

## v5.2

- Correction de la separation vocale : les connexions audio se font uniquement avec les joueurs declares dans le meme vocal cote serveur.
- Le vocal Duel ne se melange plus avec les saloons si un joueur change de phase ou recharge sa page.
- Les joueurs hors duel ne voient plus le detail du resultat quand quelqu'un est tue.
- Les duellistes gardent le detail de leur duel, les autres voient seulement un message neutre.

## v5.1

- Lobby ameliore : l'organisateur voit le statut micro de chaque joueur.
- L'organisateur peut kicker un joueur avant le lancement.
- Le lancement est bloque si des micros sont manquants, avec la liste des joueurs concernes.
- Ajout du bouton "Lancer quand meme" pour forcer le lancement.
- Reconnexion conserve le code de partie et l'identite du joueur.
- Fin de partie : les roles de tous les joueurs sont affiches.
- Ajout des sons generes : cloche debut/fin de discussion et revolver pour les duellistes.
- Ajout d'une ambiance sonore de saloon.
- Ajout d'un menu audio avec volumes separes : vocal, ambiance, effets.
- Vote de saloon ameliore avec barre de progression et compteur par candidat.

## v5.0

- Ajout du mode jeu avec code de partie.
- Un joueur peut creer une partie et obtenir un code a partager.
- Les autres joueurs peuvent rejoindre avec leur pseudo et le code de partie.
- Chaque code possede sa propre partie : joueurs, roles, saloons, votes, timers et vocaux sont separes.
- Le premier joueur de chaque code reste organisateur et configure la partie depuis son interface.

## v4.9

- Ajout du vocal Preparation avant le lancement de la partie.
- Avant les roles, tous les joueurs peuvent activer leur micro et se retrouver dans le vocal Preparation.
- Au lancement, l'app dispatch automatiquement les joueurs vers Saloon A ou Saloon B.
- Le duel ne demarre plus si les duellistes n'ont pas tous les deux le micro actif dans le vocal Duel.
- Si un duelliste coupe son micro ou ne l'active pas, l'app attend au lieu de lancer le decompte.

## v4.8

- Correction du blocage possible apres le vote de saloon.
- Apres le vote, l'app lance une courte phase "rejoignez le vocal Duel", puis demarre le timer automatiquement.
- Le duel final utilise la meme securite et ne peut plus rester bloque en attente du vocal.
- Le timer joueur affiche maintenant le bon decompte pendant l'attente du duel et pendant le resultat.

## v4.7

- Ajout du vote de saloon pendant la discussion.
- Chaque joueur voit uniquement les membres vivants de son saloon et vote pour le duelliste.
- A la fin du timer de discussion, l'app choisit automatiquement le plus vote.
- En cas d'egalite, l'app tire au hasard entre les joueurs a egalite.
- Le bouton "Je vais au duel" est remplace par l'interface de vote.

## v4.6

- L'ecran joueur gagne de la place : le titre "Ecran joueur" est retire.
- L'illustration du role est maintenant fondue directement dans la carte d'identite du joueur.
- Le premier joueur connecte dispose d'une vraie configuration de partie depuis son interface joueur : timers, nombre de hors-la-loi et liste des joueurs.
- Apres le lancement, l'organisateur revient sur son interface joueur normale.
- En fin de partie, l'organisateur garde un bouton pour recommencer une nouvelle partie.

## v4.5

- Le premier joueur connecte devient organisateur et peut preparer/lancer la partie depuis l'ecran joueur.
- Bouton unique "Preparer et lancer" : distribution des roles, saloons aleatoires et demarrage de la discussion.
- Suppression du timer temps mort.
- Fin de partie : tous les joueurs basculent vers le vocal Fin de partie.
- Page test joueurs protegee par le code admin.

## v4.4

- Ajout de la regle de duel final.
- Les hors-la-loi gagnent seulement en majorite stricte face au camp Empire.
- A 1 contre 1 avec un hors-la-loi, l'app prepare automatiquement un duel final.
- Le duel final envoie les deux derniers joueurs dans le vocal Duel, meme s'ils etaient dans le meme saloon.

## v4.3

- Refonte des couleurs globales autour du logo : noir, or, cuir brun et papier western.
- Panneaux principaux et regles en style papier western marron.
- Boutons recolores selon la palette du logo.
- Timer joueur rendu beaucoup plus visible.
- Illustration Citoyen retravaillee.
- Texte de duel sans tir clarifie : les roles sont reveles a la fin du timer, pas au moment du choix.

## v4.2

- En cas de duel sans tir, chaque duelliste voit temporairement la carte de son adversaire pendant le timer de resultat.
- La revelation reste privee aux deux joueurs du duel.

## v4.1

- Redesign dark/fondu de l'ecran joueur.
- Remplacement des icones de role par des bannieres stylisees non realistes.
- Role Sheriff : grande etoile doree.
- Role Hors-la-loi : groupe de silhouettes sombres.
- Role Citoyen : personnage beige stylise.

## v4.0

- Renommage du jeu en **Sauve l'Empire**.
- Ajout du logo principal sur les interfaces maitre, joueur et test.
- Passage a un numero de version simple affiche dans l'app.
- Ajout de ce fichier pour suivre les upgrades et corrections.

## v3.0

- Partie test possible a partir de 3 joueurs.
- Avertissement quand l'experience est lancee a moins de 5 joueurs.
- Interface joueur simplifiee autour du role, de la phase et de l'action a faire.

## v2.0

- Vocal integre avec salons automatiques : Saloon A, Saloon B, Duel, Elimines.
- Bouton micro actif / micro coupe.
- Demarrage automatique du duel quand les deux duellistes sont dans le vocal Duel.
- Correction du pouvoir du sheriff.

## v1.0

- Base multijoueur avec maitre de partie, pages joueurs et test local.
- Distribution aleatoire des roles et des saloons.
- Timers de discussion, duel, resultat et temps mort.
