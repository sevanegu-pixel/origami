import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Numéro de fabrication GitHub : chaque version a un numéro plus grand, Android l'installe par-dessus l'ancienne.
val numero = (System.getenv("NUMERO") ?: "1").toInt()

android {
    namespace = "ch.origami.compta"
    compileSdk = 35

    defaultConfig {
        applicationId = "ch.origami.compta"
        minSdk = 24
        targetSdk = 35
        versionCode = numero
        versionName = "1.$numero"
    }

    // Clé recalculée à l'identique à chaque fabrication (cle.py, secret ANDROID_GRAINE) : même signature à chaque version.
    signingConfigs {
        create("release") {
            val f = rootProject.file("keystore.properties")
            if (f.exists()) {
                val p = Properties()
                p.load(FileInputStream(f))
                keyAlias = p["keyAlias"] as String
                keyPassword = p["password"] as String
                storeFile = file(p["storeFile"] as String)
                storePassword = p["password"] as String
                storeType = "pkcs12"
            }
        }
    }

    buildTypes {
        getByName("release") {
            // Pas de réduction du code : c'est elle qui avait fait planter la Boîte mail (version 5) au démarrage.
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
