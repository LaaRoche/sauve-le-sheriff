# Release notes

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
