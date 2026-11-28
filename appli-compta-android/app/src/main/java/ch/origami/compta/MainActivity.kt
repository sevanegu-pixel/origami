package ch.origami.compta

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.util.Base64
import android.content.pm.PackageManager
import android.webkit.PermissionRequest
import androidx.core.content.ContextCompat
import android.app.Activity
import android.content.ClipData
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.File
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * Compta pour Android : la même Compta que l'appli web installée sur le téléphone (page sevanegu-pixel.github.io/origami/,
 * qui ouvre l'appli Google « accès PIN » et garde le jeton de l'appareil). Rien n'est changé dans la Compta elle-même.
 * Propre au téléphone : rien sous l'heure ni sous les boutons d'Android, ni sous le clavier ; bouton retour qui revient à
 * l'écran d'avant (la Compta pose la question si un formulaire est modifié) ; liens ouverts dans l'appli qui convient.
 */
class MainActivity : ComponentActivity() {

    companion object {
        const val ACCUEIL = "https://sevanegu-pixel.github.io/origami/index.html"
        const val HOTE = "sevanegu-pixel.github.io"
    }

    private lateinit var vue: WebView
    private lateinit var haut: View
    private lateinit var bas: View
    private var choix: ValueCallback<Array<Uri>>? = null
    private var photo: Uri? = null
    private var photoFichier: File? = null
    private var mort = false
    private var apresCamera: ((Boolean) -> Unit)? = null

    // Permission « appareil photo » d'Android, demandée la première fois qu'elle sert (scanner, photo d'un justificatif).
    private val permissionCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        val a = apresCamera
        apresCamera = null
        a?.invoke(ok)
    }

    private fun cameraPermise(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun avecCamera(suite: (Boolean) -> Unit) {
        if (cameraPermise()) { suite(true); return }
        apresCamera?.invoke(false)
        apresCamera = suite
        try { permissionCamera.launch(Manifest.permission.CAMERA) } catch (e: Exception) { apresCamera = null; suite(false) }
    }

    private val choisirFichier = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        var res: Array<Uri>? = null
        if (r.resultCode == Activity.RESULT_OK) {
            val d = r.data
            val clip = d?.clipData
            res = when {
                clip != null && clip.itemCount > 0 -> Array(clip.itemCount) { clip.getItemAt(it).uri }
                d?.data != null -> arrayOf(d.data!!)
                photo != null && (photoFichier?.length() ?: 0L) > 0L -> arrayOf(photo!!)
                else -> null
            }
        }
        choix?.onReceiveValue(res)
        choix = null
        photo = null
        photoFichier = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Une bande en haut (place de l'heure et de la batterie), la Compta, une bande en bas (place des boutons d'Android ou du clavier).
        val racine = LinearLayout(this)
        racine.orientation = LinearLayout.VERTICAL
        haut = View(this)
        bas = View(this)
        vue = WebView(this)
        racine.addView(haut, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0))
        racine.addView(vue, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        racine.addView(bas, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0))
        mettreCouleurs(Color.rgb(7, 7, 7), Color.rgb(7, 7, 7))
        setContentView(racine)

        ViewCompat.setOnApplyWindowInsetsListener(racine) { v, insets ->
            val b = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
            )
            v.setPadding(b.left, 0, b.right, 0)
            haut.layoutParams = (haut.layoutParams as LinearLayout.LayoutParams).also { it.height = b.top }
            bas.layoutParams = (bas.layoutParams as LinearLayout.LayoutParams).also { it.height = b.bottom }
            WindowInsetsCompat.CONSUMED
        }

        val s = vue.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.databaseEnabled = true
        s.mediaPlaybackRequiresUserGesture = false
        s.setSupportMultipleWindows(true)
        s.javaScriptCanOpenWindowsAutomatically = true
        s.userAgentString = s.userAgentString + " ComptaAndroid/" + BuildConfigNumero.texte(this)

        vue.addJavascriptInterface(Pont(), "ComptaTel")
        poserScripts()

        vue.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                val web = u.scheme == "https" || u.scheme == "http"
                if (request.isForMainFrame) {
                    if (web && u.host == HOTE && (u.path ?: "").startsWith("/origami/")) return false
                    ouvrirAilleurs(u)
                    return true
                }
                if (web) return false
                ouvrirAilleurs(u)   // tel:, sms:, mailto:… dans un cadre
                return true
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                mort = true
                recreate()   // la page a planté (mémoire) : on la rouvre au lieu de fermer l'appli
                return true
            }
        }

        // Téléchargement d'une adresse web (pas une adresse blob:, que cadre.js confie à enregistrer) : ouvert dans l'appli qui convient.
        vue.setDownloadListener { url, _, _, _, _ ->
            val u = Uri.parse(url)
            if (u.scheme == "https" || u.scheme == "http") ouvrirAilleurs(u)
        }

        vue.webChromeClient = object : WebChromeClient() {
            // Fenêtre nouvelle (PDF, Drive, Gmail, WhatsApp, téléphone…) : ouverte dans l'appli qui convient.
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                val temp = WebView(this@MainActivity)
                var fait = false
                fun traiter(url: String?): Boolean {
                    if (fait || url == null || url == "about:blank" || url.isEmpty()) return false
                    fait = true
                    val u = Uri.parse(url)
                    if ((u.scheme == "https") && u.host == HOTE && (u.path ?: "").startsWith("/origami/")) vue.loadUrl(url)
                    else ouvrirAilleurs(u)
                    temp.post { temp.stopLoading(); temp.destroy() }
                    return true
                }
                temp.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean = traiter(r.url.toString()) || true
                    override fun onPageStarted(v: WebView, url: String?, favicon: android.graphics.Bitmap?) { traiter(url) }
                }
                val transport = resultMsg.obj as WebView.WebViewTransport
                transport.webView = temp
                resultMsg.sendToTarget()
                return true
            }

            // Justificatif : photo ou fichier du téléphone.
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                choix?.onReceiveValue(null)
                choix = cb
                val types = params.acceptTypes.joinToString(",")
                val image = types.isBlank() || types.contains("image")
                // L'appareil photo n'est proposé qu'avec la permission d'Android (demandée une fois) ; sinon fichiers et galerie.
                if (image && !cameraPermise()) { avecCamera { ok -> lancerChoix(params, ok) }; return true }
                return lancerChoix(params, image)
            }

            // Scanner de la Compta (caméra en direct dans la page) : permis seulement aux cadres Google de la Compta.
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val hote = request.origin?.host ?: ""
                    val google = hote.endsWith(".googleusercontent.com") || hote == "script.google.com"
                    if (!google || !request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) { request.deny(); return@runOnUiThread }
                    avecCamera { ok -> if (ok) request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else request.deny() }
                }
            }
        }

        // Bouton retour d'Android : la Compta revient à l'écran d'avant (ou ferme la fenêtre ouverte) ; si un formulaire est
        // modifié, elle pose la question avant. À l'écran de départ, l'appli passe en arrière-plan sans se fermer.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (vue.canGoBack()) vue.goBack() else moveTaskToBack(true)
            }
        })

        if (savedInstanceState == null || vue.restoreState(savedInstanceState) == null) vue.loadUrl(ACCUEIL)
    }

    private fun lancerChoix(params: WebChromeClient.FileChooserParams, image: Boolean): Boolean {
                return try {
                    val chooser = Intent.createChooser(params.createIntent(), "Photo ou fichier")
                    if (image && cameraPermise()) {
                        // Prendre la photo du justificatif tout de suite, comme dans Chrome.
                        try {
                            val dossier = File(cacheDir, "photos").apply { mkdirs() }
                            dossier.listFiles()?.forEach { if (System.currentTimeMillis() - it.lastModified() > 86400000L) it.delete() }
                            val f = File(dossier, "justificatif-" + System.currentTimeMillis() + ".jpg")
                            val u = FileProvider.getUriForFile(this@MainActivity, "$packageName.photos", f)
                            val cam = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                            cam.putExtra(MediaStore.EXTRA_OUTPUT, u)
                            cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            cam.clipData = ClipData.newRawUri("photo", u)
                            if (cam.resolveActivity(packageManager) != null) {
                                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cam))
                                photo = u
                                photoFichier = f
                            }
                        } catch (e: Exception) { photo = null; photoFichier = null }
                    }
                    choisirFichier.launch(chooser)
                    true
                } catch (e: Exception) {
                    choix?.onReceiveValue(null)
                    choix = null
                    false
                }
    }


    /** Android 10+ : dossier « Téléchargements » du téléphone. Avant : dossier Téléchargements propre à l'appli. */
    private fun ecrireTelechargement(nom: String, type: String, octets: ByteArray): Uri? {
        if (Build.VERSION.SDK_INT >= 29) {
            val v = ContentValues()
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, nom)
            v.put(MediaStore.MediaColumns.MIME_TYPE, type)
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            v.put(MediaStore.MediaColumns.IS_PENDING, 1)
            val r = contentResolver
            val u = r.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v) ?: return null
            r.openOutputStream(u)?.use { it.write(octets) } ?: return null
            v.clear()
            v.put(MediaStore.MediaColumns.IS_PENDING, 0)
            r.update(u, v, null, null)
            return u
        }
        val dossier = File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: File(filesDir, "telechargements"), "").apply { mkdirs() }
        val f = File(dossier, nom)
        f.writeBytes(octets)
        return FileProvider.getUriForFile(this, "$packageName.photos", f)
    }

    private fun poserScripts() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        try {
            val cadre = assets.open("cadre.js").bufferedReader().use { it.readText() }
            val coquille = assets.open("coquille.js").bufferedReader().use { it.readText() }
            WebViewCompat.addDocumentStartJavaScript(vue, cadre, setOf("https://*.googleusercontent.com"))
            WebViewCompat.addDocumentStartJavaScript(vue, coquille, setOf("https://$HOTE"))
        } catch (e: Exception) {
            // sans ces retouches, la Compta marche quand même
        }
    }

    private fun ouvrirAilleurs(u: Uri) {
        val i = when (u.scheme) {
            "tel" -> Intent(Intent.ACTION_DIAL, u)
            "mailto", "sms", "smsto" -> Intent(Intent.ACTION_SENDTO, u)
            "intent" -> try { Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME) } catch (e: Exception) { null }
            "http", "https" -> Intent(Intent.ACTION_VIEW, u)
            else -> Intent(Intent.ACTION_VIEW, u)
        } ?: return
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { startActivity(i) } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "Aucune appli du téléphone ne sait ouvrir ce lien.", Toast.LENGTH_LONG).show()
        }
    }

    private fun mettreCouleurs(h: Int, b: Int) {
        haut.setBackgroundColor(h)
        bas.setBackgroundColor(b)
        window.decorView.setBackgroundColor(h)
        val c = WindowInsetsControllerCompat(window, window.decorView)
        c.isAppearanceLightStatusBars = clair(h)
        c.isAppearanceLightNavigationBars = clair(b)
    }

    private fun clair(c: Int): Boolean =
        (0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c)) > 150

    private fun lireCouleur(t: String): Int? {
        val m = Regex("""rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)""").find(t) ?: return null
        val (r, g, bl) = m.destructured
        return Color.rgb(r.toInt().coerceIn(0, 255), g.toInt().coerceIn(0, 255), bl.toInt().coerceIn(0, 255))
    }

    /** Appelé par cadre.js : couleurs de la barre du haut et de celle du bas de la Compta (selon l'apparence choisie). */
    inner class Pont {
        @JavascriptInterface
        fun couleurs(h: String, b: String) {
            val ch = lireCouleur(h) ?: return
            val cb = lireCouleur(b) ?: ch
            runOnUiThread { mettreCouleurs(ch, cb) }
        }

        /** « Télécharger le PDF » de la Compta (cadre.js) : le fichier est enregistré dans Téléchargements, puis proposé à l'ouverture. */
        @JavascriptInterface
        fun enregistrer(nom: String, type: String, b64: String) {
            val propre = nom.replace(Regex("""[\\/:*?"<>|\u0000-\u001f]"""), "_").trim().take(120).ifEmpty { "document.pdf" }
            val genre = if (Regex("""^[a-z]+/[a-z0-9.+-]+$""").matches(type)) type else "application/octet-stream"
            val octets = try { Base64.decode(b64, Base64.DEFAULT) } catch (e: Exception) { null }
            if (octets == null || octets.isEmpty() || octets.size > 40_000_000) {
                runOnUiThread { Toast.makeText(this@MainActivity, "Le fichier n'a pas pu être enregistré.", Toast.LENGTH_LONG).show() }
                return
            }
            val uri = try { ecrireTelechargement(propre, genre, octets) } catch (e: Exception) { null }
            runOnUiThread {
                if (uri == null) { Toast.makeText(this@MainActivity, "Le fichier n'a pas pu être enregistré.", Toast.LENGTH_LONG).show(); return@runOnUiThread }
                Toast.makeText(this@MainActivity, "« $propre » est dans Téléchargements.", Toast.LENGTH_LONG).show()
                val voir = Intent(Intent.ACTION_VIEW).setDataAndType(uri, genre)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                try { startActivity(Intent.createChooser(voir, propre).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) {}
            }
        }

        /** L'appli Boîte mail Android est-elle installée (elle reçoit les adresses boitemail://) ? */
        @JavascriptInterface
        fun boiteInstallee(): Boolean = try {
            packageManager.queryIntentActivities(Intent(Intent.ACTION_VIEW, Uri.parse("boitemail://ouvrir")), 0).isNotEmpty()
        } catch (e: Exception) { false }

        /** « Ouvrir dans Boîte mail » : seulement un brouillon (boitemail://brouillon?…), rien d'autre. */
        @JavascriptInterface
        fun ouvrirBoite(url: String): Boolean {
            if (url.length > 2000 || !Regex("""^boitemail://brouillon\?(boite=[A-Za-z0-9._%+-]{3,400}&)?conversation=[A-Za-z0-9_-]{6,40}&fenetre=seule$""").matches(url)) return false
            if (!boiteInstallee()) return false
            val i = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            runOnUiThread {
                try { startActivity(i) } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "La Boîte mail ne s'est pas ouverte.", Toast.LENGTH_LONG).show()
                }
            }
            return true
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (!mort) try { vue.saveState(outState) } catch (e: Exception) {}
    }

    override fun onDestroy() {
        try { vue.destroy() } catch (e: Exception) {}
        super.onDestroy()
    }
}

object BuildConfigNumero {
    fun texte(a: ComponentActivity): String = try {
        a.packageManager.getPackageInfo(a.packageName, 0).versionName ?: "?"
    } catch (e: Exception) { "?" }
}
