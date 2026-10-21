plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.rotameter.pro"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.rotameter.pro"
        minSdk = 26
        targetSdk = 36
        versionCode = 13
        versionName = "0.13.0-beta"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildTypes { getByName("release") { isMinifyEnabled = false } }
}
dependencies { implementation("androidx.webkit:webkit:1.12.1"); implementation("androidx.core:core-ktx:1.15.0"); implementation("androidx.activity:activity-ktx:1.9.3") }
