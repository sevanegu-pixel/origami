# Médias rapatriés de Wix

Copie des originaux (pleine résolution) de tout ce que le site utilisait encore chez Wix, récupérés le 19 octobre 2026 avec `recuperer-wix.command` (lancé depuis le Mac de la compagnie, journal identique : 82 fichiers sur 82, tailles vérifiées).

- `images/` : les 74 images de `photos-a-recuperer.txt` + les 2 images d'attente (poster) des vidéos d'accueil (`…f000.jpg`). Nom = identifiant Wix sans le suffixe `~mv2`.
- `videos/` : les 2 boucles de l'accueil (La Petite Fille `4d47d3_984cf…`, Cabaret `4d47d3_15e46…`), en 1080p (le site Wix utilisait le 720p).
- `pdf/` : les 4 PDF liés depuis `content.py` et `build.py` (dossier de présentation, fiche technique rue, infos techniques et tarifs, PDF du Cabaret sur l'accueil).
- `correspondance.csv` : ancienne URL Wix → nouveau chemin (relatif au dossier `site/`), poids et dimensions.

Pour les images, le site appelait des versions redimensionnées par Wix
(`https://static.wixstatic.com/media/{id}/v1/fit/w_…,h_…,q_85,enc_auto/{id}`) : c'est l'`{id}` qu'il faut chercher dans la table.

⚠️ Ce sont les originaux (jusqu'à 24 Mo et 6000 px par photo, 541 Mo au total) : à ne pas servir tels quels aux visiteurs. Le site doit en produire des versions allégées pour le web.
