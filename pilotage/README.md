# Pilotage du site (application Google)

Une feuille Google avec un menu **Site Origami** qui modifie le site sans toucher au code :
- **l'agenda des dates** de chaque spectacle (onglet « Agenda ») ;
- **les réservations du public** : une application (écran web) pour créer les événements et suivre
  les réservations, une page « Réservations » sur le site, un e-mail de confirmation automatique.

Comment ça marche : la feuille lit et écrit le fichier `site/data/agenda.json` sur GitHub
(branche `site`). À chaque publication, Netlify reconstruit le site tout seul.

## Installer (une seule fois)

1. Créer une feuille Google vide, par exemple « Pilotage du site Origami ».
2. Dans la feuille : **Extensions > Apps Script**.
   - Effacer le contenu de `Code.gs` et coller tout le fichier [`Code.js`](Code.js).
   - Roue dentée **Paramètres du projet** : cocher « Afficher le fichier manifeste appsscript.json »,
     puis revenir à l'éditeur, ouvrir `appsscript.json` et y coller [`appsscript.json`](appsscript.json).
   - Enregistrer (icône disquette), puis recharger la feuille : le menu **Site Origami** apparaît.
3. Créer un jeton GitHub (avec le compte qui possède le dépôt, `sevanegu-pixel`) :
   - Aller sur <https://github.com/settings/personal-access-tokens/new>
   - Nom : « Feuille pilotage site » · Expiration : 1 an
   - Resource owner : `sevanegu-pixel` · Repository access : **Only select repositories** > `origami`
   - Permissions > Repository permissions > **Contents : Read and write**
   - Générer, puis copier le jeton.
4. Dans la feuille : **Site Origami > Régler l'accès GitHub**, coller le jeton.
   Google demande d'autoriser le script la première fois (« Accéder à la feuille » et « Se connecter à un service externe ») : accepter.

Le jeton reste lié à votre compte Google (propriétés personnelles du script) : il n'est pas
visible dans la feuille, et une autre personne qui ouvre la feuille doit mettre son propre jeton.

## Utiliser

1. **Site Origami > Récupérer l'agenda du site** : l'onglet « Agenda » se remplit avec les dates en ligne.
2. Ajouter, corriger ou supprimer des lignes :
   - **Spectacle** : choisir dans la liste.
   - **Date** : la date de début (sert à trier).
   - **Texte affiché** : à laisser vide pour « 17 octobre 2026 » ; à remplir pour un texte
     particulier (« 18–19 juillet 2026 », « 28 juin – 21 juillet 2024 »…).
   - **Lieu** : tel qu'il doit apparaître sur le site.
3. **Site Origami > Publier l'agenda sur le site**. Le site est à jour une ou deux minutes plus tard.

Si une ligne est incomplète, rien n'est publié et la feuille dit quelle ligne corriger.
Si quelqu'un a modifié l'agenda entre-temps, la feuille le signale : récupérer à nouveau, puis republier.

## Réservations

Même principe que Wix Events : chaque événement a une date, un lieu, un tarif (texte) et un nombre
de places. Le public réserve sur la page `/reservations/` du site ; quand c'est plein, l'événement
affiche « Complet ». Le paiement se fait sur place.

### Mettre en route (une seule fois, après l'installation ci-dessus)

1. Dans **Extensions > Apps Script**, ajouter deux fichiers (bouton **+**) et y coller leur contenu :
   - un **Script** nommé `Reservations` : [`Reservations.js`](Reservations.js) ;
   - un **HTML** nommé `Admin` : [`Admin.html`](Admin.html).
   Recopier aussi la nouvelle version de [`Code.js`](Code.js) et de [`appsscript.json`](appsscript.json).
2. **Déployer > Nouveau déploiement**, type **Application web** : « Exécuter en tant que : moi »,
   « Qui a accès : tout le monde ». Autoriser (Google demande l'envoi d'e-mails en votre nom).
3. Dans la feuille : **Site Origami > Réservations : lien de l'appli**. La fenêtre donne :
   - l'**adresse pour le site** : à donner à Claude, qui la met dans `site/data/reservations.json` ;
   - votre **lien personnel** vers l'application : à garder pour vous (il ouvre la gestion sans mot de passe).
     En cas de doute, « Réservations : changer la clé du lien » le remplace.

Après une modification du code : **Déployer > Gérer les déploiements > modifier (crayon) >
Version : nouvelle version**, pour garder la même adresse.

### Dans l'application

- **Événements** : créer, modifier, dupliquer pour une autre date, passer en Ouvert, Fermé (affiché
  sans réservation), Brouillon ou Annulé (cachés du site). Nombre de places vide : illimité.
- Pour chaque événement : la liste des réservations, annuler une réservation (avec ou sans e-mail
  à la personne), ajouter une réservation reçue par téléphone, copier tous les e-mails.
- **E-mails** : le texte de la confirmation et de l'annulation, l'adresse qui reçoit une copie de
  chaque réservation, et un bouton pour s'envoyer un essai.

Les données sont dans les onglets « Événements » et « Réservations » de la feuille.
Gmail limite l'envoi à environ 100 e-mails par jour depuis un compte gratuit : au-delà, la réservation
est quand même enregistrée, mais l'e-mail ne part pas.

## Pour les développeurs

- `Code.js`, `Reservations.js`, `Admin.html` et `appsscript.json` sont la source ; la feuille en contient une copie.
- `Reservations.js` : `doGet` (`?api=evenements` pour le site, `?cle=` pour l'application), `doPost`
  (réservation), fonctions `admin*` appelées par `Admin.html`, chacune vérifie la clé.
- Avec [clasp](https://github.com/google/clasp) : `clasp login`, copier `.clasp.json.exemple`
  en `.clasp.json` avec l'identifiant du script (Paramètres du projet > ID), puis `clasp push`
  depuis ce dossier.
- Côté site, `site/content.py` charge `site/data/agenda.json` : ses dates remplacent celles
  écrites dans `SHOWS`, spectacle par spectacle.
- La page `site/reservations/index.html` est copiée par `build.py` dans `dist/reservations/`, avec
  l'adresse de `site/data/reservations.json` (vide : « Les réservations ouvrent bientôt »).
