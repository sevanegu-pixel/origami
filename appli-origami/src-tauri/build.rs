// Les commandes de la coquille (installateur, liens transmis, barre des menus) ne sont permises qu'aux pages
// nommées dans capabilities/ : la page Origami en ligne, et la page de démarrage de la coquille.
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "applis_mac",
        "installer_appli",
        "relancer_origami",
        "ouvrir_appli",
        "lire_liaison",
        "montrer_dans_finder",
        "desinstaller_appli",
        "barre_alertes",
        "demarrage_auto",
        "pont_google",
        "pont_annuler",
        "fenetre_privee",
        "fichiers_dossier",
        "fichiers_choisir_dossier",
        "fichiers_dossier_defaut",
        "fichiers_etat",
        "fichiers_ecrire",
        "fichiers_lire",
        "fichiers_ouvrir",
        "fichiers_montrer",
        "fichiers_retirer",
        "fichiers_deplacer",
        "fichiers_copier",
    ])))
    .expect("préparation de l'appli");
}
