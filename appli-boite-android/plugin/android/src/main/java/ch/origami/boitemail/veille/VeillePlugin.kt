package ch.origami.boitemail.veille

import android.app.Activity
import android.view.View
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray
import org.json.JSONObject

@InvokeArg
class CompteArg {
    var id: String = ""
    var nom: String = ""
    var url: String = ""
    var jeton: String = ""
    var actif: Boolean = true
}

@InvokeArg
class ConfigurerArgs {
    var comptes: Array<CompteArg> = arrayOf()
}

/** Pont entre la coquille et la veille : la liste des boîtes est gardée dans l'appareil pour que la veille tourne appli fermée. */
@TauriPlugin
class VeillePlugin(private val activity: Activity) : Plugin(activity) {

    /** Android 15+ dessine l'appli sous la barre d'état (heure, batterie) et sous les boutons du bas : on laisse leur place,
     *  ainsi que celle du clavier quand il est ouvert, pour que rien de l'appli ne soit caché. */
    override fun load(webView: WebView) {
        super.load(webView)
        val contenu = activity.findViewById<View>(android.R.id.content) ?: return
        ViewCompat.setOnApplyWindowInsetsListener(contenu) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(contenu)
    }

    @Command
    fun configurer(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(ConfigurerArgs::class.java)
            val liste = JSONArray()
            for (c in args.comptes) {
                if (c.id.isBlank() || !c.url.startsWith("https://") || c.jeton.isBlank()) continue
                liste.put(JSONObject().put("id", c.id).put("nom", c.nom).put("url", c.url).put("jeton", c.jeton).put("actif", c.actif))
            }
            Veille.garderComptes(activity.applicationContext, liste)
            Veille.programmer(activity.applicationContext)
            val r = JSObject(); r.put("comptes", liste.length()); invoke.resolve(r)
        } catch (e: Exception) {
            invoke.reject(e.message ?: "configurer")
        }
    }

    @Command
    fun sonder(invoke: Invoke) {
        Veille.sonderMaintenant(activity.applicationContext)
        invoke.resolve(JSObject())
    }
}
