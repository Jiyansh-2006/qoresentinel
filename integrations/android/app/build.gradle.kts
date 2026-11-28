plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "io.github.qoresentinel.qorechain"
    compileSdk = 35
    defaultConfig { applicationId = "io.github.qoresentinel.qorechain"; minSdk = 24; targetSdk = 35 }
}

dependencies {
    implementation("io.github.qorechain:qoresign-android:0.2.0")
    implementation("io.github.qorechain:qoreseal-android:0.1.0")
}
