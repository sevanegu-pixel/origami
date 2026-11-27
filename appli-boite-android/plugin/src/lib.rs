//! Boîte mail pour Android. La coquille (www/index.html) confie ici la liste de ses boîtes (adresse du moteur, jeton, case
//! « notifications ») ; la partie Kotlin la garde dans l'appareil et demande à chaque moteur, toutes les 15 minutes environ
//! (minimum d'Android, même appli fermée) et à la demande quand l'appli est ouverte, les nouveaux mails ; elle les annonce.
//! Ailleurs qu'Android, les deux commandes ne font rien.
use serde_json::Value;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(target_os = "android")]
struct Veille<R: Runtime>(tauri::plugin::PluginHandle<R>);

#[tauri::command]
async fn configurer<R: Runtime>(app: tauri::AppHandle<R>, comptes: Value) -> Result<Value, String> {
    #[cfg(target_os = "android")]
    {
        let v = app.state::<Veille<R>>();
        return v.0.run_mobile_plugin::<Value>("configurer", serde_json::json!({ "comptes": comptes })).map_err(|e| e.to_string());
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, comptes);
        Ok(Value::Null)
    }
}

#[tauri::command]
async fn sonder<R: Runtime>(app: tauri::AppHandle<R>) -> Result<Value, String> {
    #[cfg(target_os = "android")]
    {
        let v = app.state::<Veille<R>>();
        return v.0.run_mobile_plugin::<Value>("sonder", serde_json::json!({})).map_err(|e| e.to_string());
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(Value::Null)
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("boite-android")
        .invoke_handler(tauri::generate_handler![configurer, sonder])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let h = api.register_android_plugin("ch.origami.boitemail.veille", "VeillePlugin")?;
                app.manage(Veille(h));
            }
            #[cfg(not(target_os = "android"))]
            let _ = (app, api);
            Ok(())
        })
        .build()
}
