# Compta pour Android

Petite appli Android (Kotlin, sans Tauri) qui ouvre la **même page** que l'appli web Compta installée sur le téléphone :
`https://sevanegu-pixel.github.io/origami/index.html` (racine de ce dépôt), qui ouvre la Compta « accès PIN » et garde le jeton
de l'appareil. **La Compta (Apps Script) n'est pas modifiée**, ni la page d'accueil : tout ce qui suit n'existe que dans l'APK.

Fabriquée par `.github/workflows/appli-compta-android.yml` à chaque poussée dans ce dossier → version `appli-compta-android-N`,
fichier `Compta-Android.apk` (+ captures de l'essai sur téléphone virtuel).

| Fichier | Rôle |
| --- | --- |
| `app/src/main/java/ch/origami/compta/MainActivity.kt` | la fenêtre : bandes pour l'heure/batterie en haut et les boutons d'Android (ou le clavier) en bas, à la couleur de l'apparence ; bouton retour (historique de la page : la Compta y pose déjà sa « sentinelle » `google.script.history`, et demande avant de quitter un formulaire modifié ; à l'écran de départ, l'appli passe en arrière-plan sans se fermer) ; liens et fenêtres nouvelles (PDF, Drive, Gmail, téléphone, SMS, WhatsApp) ouverts dans l'appli qui convient ; photo ou fichier pour les justificatifs (appareil photo proposé) |
| `app/src/main/assets/cadre.js` | posé dans les cadres Google de la Compta (`*.googleusercontent.com`) : champs à remplir plus petits (14 px, 40 px de haut), barre des onglets et « + » cachés quand le clavier est ouvert, couleurs des barres envoyées à Android |
| `app/src/main/assets/coquille.js` | posé dans la page d'accueil : pas de bandeau « Installer Compta » dans l'appli |
| `cle.py` | copie de celle de la Boîte mail Android : même secret `ANDROID_GRAINE`, même clé de signature |

Pas de réduction du code (R8) : c'est elle qui avait fait planter la Boîte mail Android au démarrage (version 5).
Aucun nouveau droit Google, aucun service en plus. Pas sur téléphone : fenêtre « Détacher » (elle s'ouvre à la place de l'écran),
aperçu dans une autre fenêtre.
