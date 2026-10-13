# Site de la Compagnie Origami

Générateur statique en Python 3, sans dépendance.

- `content.py` : tous les textes et données (spectacles, dates, artistes…)
- `build.py` : fabrique les pages dans `dist/`
- `style.css` : le design

En local : `python3 build.py`, puis ouvrir `dist/index.html`.

En ligne : Netlify reconstruit le site tout seul à chaque modification
envoyée sur la branche `site` (réglages dans `netlify.toml`).
Voir `docs/passation.md` pour l'historique du projet.
