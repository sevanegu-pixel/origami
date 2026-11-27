package ch.origami.boitemail.veille

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Veille des nouveaux mails. Même règle que l'appli du Mac : on demande au moteur de chaque boîte « nouveauxMails » depuis
 * le dernier repère (historique Gmail) ; le premier passage pose seulement le repère ; les 60 derniers mails annoncés sont
 * retenus pour ne jamais annoncer deux fois le même.
 */
object Veille {
    private const val PREFS = "boite-mail-veille"
    private const val CANAL = "nouveaux-mails"
    private const val TRAVAIL = "veille-nouveaux-mails"
    private const val TOUT_DE_SUITE = "veille-maintenant"

    fun garderComptes(ctx: Context, liste: JSONArray) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // Les repères des boîtes retirées sont oubliés.
        val ids = (0 until liste.length()).map { liste.getJSONObject(it).getString("id") }.toSet()
        val reperes = lireReperes(ctx)
        val garder = JSONObject()
        reperes.keys().forEach { k -> if (k in ids) garder.put(k, reperes.get(k)) }
        p.edit().putString("comptes", liste.toString()).putString("reperes", garder.toString()).apply()
    }

    private fun lireComptes(ctx: Context): JSONArray =
        try { JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("comptes", "[]")) } catch (e: Exception) { JSONArray() }

    private fun lireReperes(ctx: Context): JSONObject =
        try { JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("reperes", "{}")) } catch (e: Exception) { JSONObject() }

    private fun garderReperes(ctx: Context, r: JSONObject) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("reperes", r.toString()).apply()
    }

    private fun contraintes() = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun programmer(ctx: Context) {
        val req = PeriodicWorkRequestBuilder<VeilleWorker>(15, TimeUnit.MINUTES).setConstraints(contraintes()).build()
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(TRAVAIL, ExistingPeriodicWorkPolicy.KEEP, req)
    }

    fun sonderMaintenant(ctx: Context) {
        val req = OneTimeWorkRequestBuilder<VeilleWorker>().setConstraints(contraintes()).build()
        WorkManager.getInstance(ctx).enqueueUniqueWork(TOUT_DE_SUITE, ExistingWorkPolicy.KEEP, req)
    }

    /** Un passage sur toutes les boîtes (appelé par la veille, jamais deux à la fois). */
    @Synchronized
    fun passage(ctx: Context) {
        val comptes = lireComptes(ctx)
        for (i in 0 until comptes.length()) {
            val c = comptes.getJSONObject(i)
            if (!c.optBoolean("actif", true)) continue
            try { sonderBoite(ctx, c) } catch (e: Exception) { /* boîte pas joignable : on réessaie au prochain passage */ }
        }
    }

    private fun sonderBoite(ctx: Context, c: JSONObject) {
        val id = c.getString("id")
        val reperes = lireReperes(ctx)
        val q = reperes.optJSONObject(id) ?: JSONObject()
        val avait = q.optString("h", "")
        val corps = JSONObject().put("f", "nouveauxMails").put("jeton", c.getString("jeton")).put("args", JSONArray().put(avait)).toString()
        val reponse = JSONObject(poster(c.getString("url"), corps))
        if (!reponse.optBoolean("ok", false)) return
        val r = reponse.optJSONObject("r") ?: return
        val h = r.optString("historyId", "")
        if (h.isNotEmpty()) q.put("h", h)
        val vus = q.optJSONArray("vus") ?: JSONArray()
        val dejaVus = (0 until vus.length()).map { vus.optString(it) }.toMutableList()
        val neufs = mutableListOf<JSONObject>()
        val mails = r.optJSONArray("mails") ?: JSONArray()
        if (avait.isNotEmpty()) for (k in 0 until mails.length()) {
            val m = mails.optJSONObject(k) ?: continue
            if (m.optString("id") !in dejaVus) neufs.add(m)
        }
        neufs.forEach { dejaVus.add(it.optString("id")) }
        q.put("vus", JSONArray(dejaVus.takeLast(60)))
        reperes.put(id, q)
        garderReperes(ctx, reperes)
        if (neufs.isEmpty()) return
        val nom = c.optString("nom", "Boîte mail")
        if (neufs.size > 3) annoncer(ctx, id.hashCode(), nom, "${neufs.size} nouveaux mails", null)
        else neufs.forEach { m ->
            annoncer(ctx, (id + m.optString("id")).hashCode(), nom + " · " + m.optString("de", "Nouveau mail"),
                m.optString("objet").ifBlank { m.optString("extrait") }, id)
        }
    }

    /** Porte du moteur : POST puis, comme Google renvoie ailleurs (302), lecture de la réponse à la nouvelle adresse. */
    private fun poster(adresse: String, corps: String): String {
        var co = URL(adresse).openConnection() as HttpURLConnection
        co.instanceFollowRedirects = false
        co.connectTimeout = 30000; co.readTimeout = 90000
        co.requestMethod = "POST"; co.doOutput = true
        co.setRequestProperty("Content-Type", "text/plain;charset=utf-8")
        OutputStreamWriter(co.outputStream, Charsets.UTF_8).use { it.write(corps) }
        var code = co.responseCode
        var tours = 0
        while (code in 300..399 && tours < 5) {
            val suite = co.getHeaderField("Location") ?: break
            co.disconnect()
            co = URL(URL(adresse), suite).openConnection() as HttpURLConnection
            co.instanceFollowRedirects = false
            co.connectTimeout = 30000; co.readTimeout = 90000
            code = co.responseCode
            tours++
        }
        if (code !in 200..299) { co.disconnect(); throw Exception("code $code") }
        val texte = co.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        co.disconnect()
        return texte
    }

    private fun annoncer(ctx: Context, numero: Int, titre: String, texte: String, compte: String?) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CANAL) == null) {
            nm.createNotificationChannel(NotificationChannel(CANAL, "Nouveaux mails", NotificationManager.IMPORTANCE_DEFAULT))
        }
        val ouvrir = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            if (compte != null) putExtra("boite", compte)
        }
        val pi = if (ouvrir != null) PendingIntent.getActivity(ctx, numero, ouvrir, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) else null
        val n = NotificationCompat.Builder(ctx, CANAL)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle(titre.take(120))
            .setContentText(texte.take(200))
            .setStyle(NotificationCompat.BigTextStyle().bigText(texte.take(400)))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(numero, n) } catch (e: SecurityException) { /* refusées */ }
    }
}

class VeilleWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        Veille.passage(applicationContext)
        return Result.success()
    }
}
