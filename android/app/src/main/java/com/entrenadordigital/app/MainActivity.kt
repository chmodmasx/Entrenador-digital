package com.entrenadordigital.app

import android.annotation.SuppressLint
import android.annotation.TargetApi
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.window.OnBackInvokedDispatcher
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : Activity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Match the native status bar to the dark-blue top band rendered by the
        // web UI. Android 15+ may draw the WebView behind a transparent status
        // bar; older versions still use this color directly.
        window.statusBarColor = Color.rgb(13, 52, 93)
        window.navigationBarColor = Color.rgb(3, 30, 84)

        // Keep status-bar icons light on devices that support switching icon
        // appearance. The theme also declares windowLightStatusBar=false.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(244, 247, 251))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.mediaPlaybackRequiresUserGesture = false

            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    return request.url.host != "appassets.androidplatform.net"
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onJsConfirm(
                    view: WebView?,
                    url: String?,
                    message: String?,
                    result: JsResult?
                ): Boolean {
                    if (result == null) return false

                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("Confirmar")
                        .setMessage(message ?: "¿Continuar?")
                        .setPositiveButton("Aceptar") { _, _ -> result.confirm() }
                        .setNegativeButton("Cancelar") { _, _ -> result.cancel() }
                        .setOnCancelListener { result.cancel() }
                        .show()

                    return true
                }
            }

            addJavascriptInterface(AndroidBridge(this@MainActivity), "Android")

            if (BuildConfig.DEBUG) {
                WebView.setWebContentsDebuggingEnabled(true)
            }
        }

        setContentView(webView)
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")

        // targetSdk 36 uses the modern back dispatcher on Android 13+. An
        // Activity.onBackPressed() override alone is not a reliable interception
        // point there, so register with the platform dispatcher as well.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerModernBackHandler()
        }
    }

    /**
     * Make the Android system Back action behave exactly like the visible back
     * action in the current web screen. This deliberately does not call finish()
     * when there is no in-app back target (for example on Home).
     */
    private fun dispatchBackToWeb() {
        if (!::webView.isInitialized) return

        webView.evaluateJavascript(
            """
            (function () {
              var button = document.querySelector('button[data-action="back"]');
              if (!button) button = document.querySelector('button[data-action="home"]');
              if (button) {
                button.click();
                return 'handled';
              }
              return 'noop';
            }());
            """.trimIndent(),
            null
        )
    }

    @TargetApi(Build.VERSION_CODES.TIRAMISU)
    private fun registerModernBackHandler() {
        onBackInvokedDispatcher.registerOnBackInvokedCallback(
            OnBackInvokedDispatcher.PRIORITY_DEFAULT
        ) {
            dispatchBackToWeb()
        }
    }

    @Deprecated("Legacy Android back path; Android 13+ uses OnBackInvokedDispatcher")
    override fun onBackPressed() {
        dispatchBackToWeb()
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("Android")
        webView.destroy()
        super.onDestroy()
    }

    fun setTrainingMode(enabled: Boolean) {
        if (enabled) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                )
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        }
    }

    private class AndroidBridge(private val activity: MainActivity) {
        @JavascriptInterface
        fun setTrainingMode(enabled: Boolean) {
            activity.runOnUiThread { activity.setTrainingMode(enabled) }
        }

        @JavascriptInterface
        fun vibrate(milliseconds: Int) {
            if (milliseconds <= 0) return
            val duration = milliseconds.coerceAtMost(1000).toLong()
            val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator

            @Suppress("DEPRECATION")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                vibrator.vibrate(duration)
            }
        }

        @JavascriptInterface
        fun getAppVersion(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun finishApp() {
            activity.runOnUiThread { activity.finish() }
        }
    }
}
