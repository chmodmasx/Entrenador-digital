import java.util.Base64

plugins {
    id("com.android.application")
}

val appVersionName = providers.gradleProperty("VERSION_NAME").orElse("0.1.0")
val appVersionCode = providers.gradleProperty("VERSION_CODE").map(String::toInt).orElse(1)

val releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
val releaseKeystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
val releaseKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")
val hasReleaseSigning = listOf(
    releaseKeystorePath,
    releaseKeystorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { !it.isNullOrBlank() }

android {
    namespace = "com.entrenadordigital.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.entrenadordigital.app"
        minSdk = 21
        targetSdk = 36
        versionCode = appVersionCode.get()
        versionName = appVersionName.get()
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        create("release") {
            if (hasReleaseSigning) {
                storeFile = file(releaseKeystorePath!!)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // 1.14.0 is deliberately pinned: 1.15.0 raised WebKit's minSdk to 23.
    implementation("androidx.webkit:webkit:1.14.0")
}

// The web build is produced first (npm run build). Android then copies that
// self-contained output into the APK assets before every Android build.
val syncWebAssets by tasks.registering(Copy::class) {
    from(rootProject.file("../web/dist"))
    into(layout.projectDirectory.dir("src/main/assets/www"))
}

// GitHub's source writer is text-only, so the approved binary NBS icon lives
// in the repository as base64. Decode it into the ordinary main resource tree
// before Android resource merging. This avoids generated SourceSet APIs and
// keeps compatibility with the current Android Gradle Plugin / Gradle 9.
val generateNbsBrandAssets by tasks.registering {
    val encodedIcon = layout.projectDirectory.file("src/main/brand/nbs_app_icon.webp.b64")
    val outputIcon = layout.projectDirectory.file("src/main/res/drawable-nodpi/ic_launcher_nbs.webp")

    inputs.file(encodedIcon)
    outputs.file(outputIcon)

    doLast {
        val destination = outputIcon.asFile
        destination.parentFile.mkdirs()
        val encoded = encodedIcon.asFile.readText().filterNot { it.isWhitespace() }
        destination.writeBytes(Base64.getDecoder().decode(encoded))
    }
}

tasks.named("preBuild").configure {
    dependsOn(syncWebAssets, generateNbsBrandAssets)
}

tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Resources") }.configureEach {
    dependsOn(generateNbsBrandAssets)
}
