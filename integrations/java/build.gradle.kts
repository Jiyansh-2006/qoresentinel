plugins {
    kotlin("jvm") version "2.3.0"
}

repositories { mavenCentral() }

dependencies {
    implementation("io.github.qorechain:qorechain-sdk:0.14.0")
    implementation("io.github.qorechain:qorechain-pqc:0.2.3")
    implementation("io.github.qorechain:qoresign:0.2.0")
    implementation("io.github.qorechain:qoreseal:0.1.0")
    implementation("io.github.qorechain:qorechain-rdk:0.9.0")
    implementation("io.github.qorechain:asset-kit:0.1.0")
}
