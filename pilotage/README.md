# Pilotage du site (application Google)

Une feuille Google avec un menu **Site Origami** qui modifie le site sans toucher au code.
Première fonction : **l'agenda des dates** de chaque spectacle.

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

## Pour les développeurs

- `Code.js` et `appsscript.json` sont la source ; la feuille en contient une copie.
- Avec [clasp](https://github.com/google/clasp) : `clasp login`, copier `.clasp.json.exemple`
  en `.clasp.json` avec l'identifiant du script (Paramètres du projet > ID), puis `clasp push`
  depuis ce dossier.
- Côté site, `site/content.py` charge `site/data/agenda.json` : ses dates remplacent celles
  écrites dans `SHOWS`, spectacle par spectacle.
