package ch.origami.boitemail.veille

import android.app.Activity
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import android.webkit.MimeTypeMap
import android.view.View
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
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

@InvokeArg
class EnregistrerArgs {
    var nom: String = ""
    var base64: String = ""
}

@InvokeArg
class OuvrirArgs {
    var uri: String = ""
}

/** Pont entre la coquille et la veille : la liste des boîtes est gardée dans l'appareil pour que la veille tourne appli fermée. */
@TauriPlugin
class VeillePlugin(private val activity: Activity) : Plugin(activity) {

    /** Android 15+ dessine l'appli sous la barre d'état (heure, batterie) et sous les boutons du bas : on laisse leur place,
     *  ainsi que celle du clavier quand il est ouvert, pour que rien de l'appli ne soit caché. */
    private var vue: WebView? = null

    /** Retour dans l'appli (après une autre appli, l'écran éteint…) : la boîte à l'écran relit ses mails tout de suite. */
    override fun onResume() {
        super.onResume()
        vue?.evaluateJavascript("(function(){try{window.__telReveil&&window.__telReveil()}catch(e){}})()", null)
    }

    override fun load(webView: WebView) {
        super.load(webView)
        vue = webView
        val contenu = activity.findViewById<View>(android.R.id.content) ?: return
        ViewCompat.setOnApplyWindowInsetsListener(contenu) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(contenu)

        // Bouton « retour » d'Android : l'appli revient à son écran précédent (volet, fenêtre d'écriture, mail ouvert…).
        // La page dit si elle a encore un écran où revenir ; sinon l'appli passe en arrière-plan sans se fermer (rien n'est perdu).
        // Un mail en cours d'écriture n'est jamais perdu : sa fermeture le garde en brouillon ou pose la question, comme le « × ».
        val act = activity as? ComponentActivity ?: return
        act.onBackPressedDispatcher.addCallback(act, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("(function(){try{return !!(window.__telRetour&&window.__telRetour())}catch(e){return false}})()") { r ->
                    if (r != "true") activity.moveTaskToBack(true)
                }
            }
        })
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

    /** Fichiers enregistrés pendant cette séance : seuls ceux-là peuvent être ouverts. */
    private val enregistres = mutableSetOf<String>()

    private fun typeDe(nom: String): String {
        val ext = nom.substringAfterLast('.', "").lowercase()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
    }

    /** Pièce jointe téléchargée : rangée dans « Téléchargements » du téléphone (Android choisit « nom (1) » si le nom est pris). */
    @Command
    fun enregistrer(invoke: Invoke) {
        try {
            val a = invoke.parseArgs(EnregistrerArgs::class.java)
            if (Build.VERSION.SDK_INT < 29) { invoke.reject("Enregistrer un fichier demande Android 10 ou plus récent."); return }
            val nom = a.nom.map { c -> if (c == '/' || c == '\\' || c == ':' || c.isISOControl()) '-' else c }.joinToString("").trim().trimStart('.').trim().take(180).ifBlank { "fichier" }
            val octets = Base64.decode(a.base64, Base64.DEFAULT)
            val res = activity.contentResolver
            val valeurs = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, nom)
                put(MediaStore.Downloads.MIME_TYPE, typeDe(nom))
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = res.insert(MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), valeurs)
                ?: throw Exception("« Téléchargements » n'est pas accessible")
            try {
                (res.openOutputStream(uri) ?: throw Exception("écriture impossible")).use { it.write(octets) }
                valeurs.clear(); valeurs.put(MediaStore.Downloads.IS_PENDING, 0)
                res.update(uri, valeurs, null, null)
            } catch (e: Exception) {
                try { res.delete(uri, null, null) } catch (x: Exception) { }
                throw e
            }
            var nomFinal = nom
            res.query(uri, arrayOf(MediaStore.Downloads.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) nomFinal = c.getString(0) ?: nom }
            enregistres.add(uri.toString())
            val r = JSObject(); r.put("uri", uri.toString()); r.put("nom", nomFinal); invoke.resolve(r)
        } catch (e: Exception) {
            invoke.reject(e.message ?: "enregistrer")
        }
    }

    /** Ouvre un fichier que l'appli vient d'enregistrer, avec l'appli du téléphone qui sait le lire. */
    @Command
    fun ouvrir(invoke: Invoke) {
        try {
            val a = invoke.parseArgs(OuvrirArgs::class.java)
            if (!enregistres.contains(a.uri)) { invoke.reject("fichier inconnu"); return }
            val uri = Uri.parse(a.uri)
            val type = activity.contentResolver.getType(uri) ?: "application/octet-stream"
            val i = Intent(Intent.ACTION_VIEW).setDataAndType(uri, type).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(i)
            invoke.resolve(JSObject())
        } catch (e: ActivityNotFoundException) {
            invoke.reject("Aucune appli du téléphone ne sait ouvrir ce fichier.")
        } catch (e: Exception) {
            invoke.reject(e.message ?: "ouvrir")
        }
    }

    /** Ouvre la liste des téléchargements du téléphone. */
    @Command
    fun telechargements(invoke: Invoke) {
        try {
            activity.startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            invoke.resolve(JSObject())
        } catch (e: Exception) {
            invoke.reject(e.message ?: "telechargements")
        }
    }

    @Command
    fun sonder(invoke: Invoke) {
        Veille.sonderMaintenant(activity.applicationContext)
        invoke.resolve(JSObject())
    }
}
