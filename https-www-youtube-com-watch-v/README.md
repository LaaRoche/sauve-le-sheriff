# Sauve l'Empire

Application web multijoueur pour animer une partie de Sauve l'Empire.

Version actuelle : v4.7

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
