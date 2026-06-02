# Sauve l'Empire

Application web multijoueur pour animer une partie de Sauve l'Empire.

Version actuelle : v6.23

## Lancer en local

```bash
npm start
```

Puis ouvrir :

```text
http://127.0.0.1:5203/
```

## Jouer avec des amis en ligne

Il faut deployer ce dossier sur un hebergeur Node.js, par exemple Render, Railway, Fly.io ou un VPS.

Commande de demarrage :

```bash
npm start
```

L'hebergeur doit fournir la variable `PORT`. L'app l'utilise automatiquement.

Une fois deployee, partage l'URL publique de la page maitre. Le lien joueur affiche dans l'app utilisera automatiquement cette meme URL publique.

## Vocal a distance

Le vocal utilise WebRTC. Pour que tous les joueurs s'entendent meme avec des box, VPN ou pare-feu compliques, configure un serveur TURN sur l'hebergeur.

Configuration recommandee avec Metered sur Render :

```text
METERED_APP_NAME=ton-nom-d-application-metered
METERED_SECRET_KEY=ta-cle-secrete-metered
```

Options utiles :

```text
METERED_TURN_REGION=global
METERED_TURN_EXPIRY_SECONDS=86400
METERED_TURN_LABEL=empire-sheriff-render
```

Alternative avec un identifiant TURN deja cree :

```text
METERED_APP_NAME=ton-nom-d-application-metered
METERED_TURN_API_KEY=ta-cle-api-turn
```

Alternative statique :

```text
TURN_URL=turn:ton-serveur-turn:3478
TURN_USERNAME=ton-utilisateur
TURN_CREDENTIAL=ton-mot-de-passe
```

Configuration complete manuelle :

```text
ICE_SERVERS_JSON=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:ton-serveur-turn:3478","username":"ton-utilisateur","credential":"ton-mot-de-passe"}]
```

Sans TURN, l'app garde le STUN public par defaut, mais certains joueurs peuvent ne pas s'entendre selon leur reseau.
