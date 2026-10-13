# Site de la Compagnie Origami

Générateur statique en Python 3, sans dépendance. Le site contient plusieurs
versions du design, côte à côte, avec un sélecteur « Version » en bas à gauche.

- `content.py` : tous les textes et données (spectacles, dates, artistes…), communs à toutes les versions
- `versions/<nom>/build.py` et `style.css` : le générateur et le design d'une version
  - `bancal` : direction « Bancal » (octobre 2026), version affichée par défaut
  - `wix` : copie fidèle de l'ancien site Wix
- `build.py` : fabrique toutes les versions dans `dist/<nom>/` (liste `VERSIONS` : la première est celle par défaut)

En local : `python3 build.py`, puis ouvrir `dist/bancal/index.html`.

En ligne : Netlify reconstruit le site tout seul à chaque modification
envoyée sur la branche `site` (réglages dans `netlify.toml`).
Voir `docs/passation.md` pour l'historique du projet.
