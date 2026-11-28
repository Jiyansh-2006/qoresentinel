package io.github.qoresentinel.qorechain

import android.app.Activity
import android.os.Bundle

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The host app should request explicit consent before invoking signing or encryption.
    }
}
