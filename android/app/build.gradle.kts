plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appVersionName = providers.gradleProperty("VERSION_NAME").orElse("0.1.0")
val appVersionCode = providers.gradleProperty("VERSION_CODE").map(String::toInt).orElse(1)

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

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // 1.14.0 is deliberately pinned: 1.15.0 raised WebKit's minSdk to 23.
    implementation("androidx.webkit:webkit:1.14.0")
}

val syncWebAssets by tasks.registering(Copy::class) {
    dependsOn(":prepareWebAssets")
    from(rootProject.file("../web/dist"))
    into(layout.projectDirectory.dir("src/main/assets/www"))
}

tasks.named("preBuild").configure {
    dependsOn(syncWebAssets)
}
