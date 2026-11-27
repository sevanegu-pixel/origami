# Boîte mail pour Android

L'appli Android est fabriquée à partir du code de l'appli Mac (`appli-boite/`), **sans le modifier** : le workflow
`.github/workflows/appli-boite-android.yml` prend `appli-boite/` (branche `claude/project-thread-lsq98w` par défaut, sinon `main`),
puis `preparer.mjs` le copie dans un dossier de fabrication et y pose ce qui est propre au téléphone. Si un texte attendu du code Mac
a changé, la fabrication s'arrête en le nommant (« RETOUCHE IMPOSSIBLE ») : adapter `preparer.mjs`.

| Fichier | Rôle |
| --- | --- |
| `preparer.mjs` | copie et retouches (coquille, Rust, Cargo, réglages Android) |
| `telephone/coquille.css`, `coquille.js` | barre des comptes fine ; une « case » `http://bN.localhost/<compte>/` par boîte (une mémoire par boîte, comme `boite://<compte>/` sur le Mac) ; veille confiée à Android |
| `telephone/ecran.css`, `ecran.js` | affichage téléphone à la Gmail, posé dans l'écran gardé de chaque boîte par la « cale » ; mêmes fonctions qu'avant |
| `plugin/` | module `tauri-plugin-boite-android` : veille Kotlin (WorkManager, toutes les 15 min, même appli fermée) qui demande `nouveauxMails` à chaque moteur et annonce les nouveaux mails |
| `signature.mjs` | signature de l'APK (secrets `ANDROID_KEYSTORE_B64` et `ANDROID_KEY_PASSWORD` ; sans eux, clé d'essai jetable) |

Aucun nouveau droit Google, aucun service en plus : la veille appelle la même porte (`doPost`, jeton d'appareil) que l'appli Mac.
Pas encore sur le téléphone : imprimer, fenêtres séparées (l'écriture reste dans la boîte), fenêtre privée de navigateur.
