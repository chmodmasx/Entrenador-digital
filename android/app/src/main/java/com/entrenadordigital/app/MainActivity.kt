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
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.FrameLayout
import android.window.OnBackInvokedDispatcher
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

class MainActivity : Activity() {
    private lateinit var rootView: FrameLayout
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val statusBlue = Color.rgb(13, 52, 93)
        val navigationBlue = Color.rgb(3, 30, 84)

        window.statusBarColor = statusBlue
        window.navigationBarColor = navigationBlue

        // Keep status-bar icons light. The theme also declares
        // windowLightStatusBar=false for devices where the theme controls it.
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

        // Android 15+ enforces edge-to-edge for modern target SDKs. Instead of
        // compensating individual web screens with CSS, keep the entire WebView
        // inside the visible status/navigation bar insets. This prevents any
        // scrolled card, header, modal or list from ever drawing under system UI.
        // The surrounding native container supplies the dark blue surface behind
        // the transparent system bars.
        rootView = FrameLayout(this).apply {
            setBackgroundColor(statusBlue)
            addView(
                webView,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )
        }

        rootView.setOnApplyWindowInsetsListener { _, insets ->
            val statusTop: Int
            val navigationBottom: Int

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                statusTop = insets.getInsets(WindowInsets.Type.statusBars()).top
                navigationBottom = insets.getInsets(WindowInsets.Type.navigationBars()).bottom
            } else {
                @Suppress("DEPRECATION")
                statusTop = insets.systemWindowInsetTop
                @Suppress("DEPRECATION")
                navigationBottom = insets.systemWindowInsetBottom
            }

            val params = webView.layoutParams as FrameLayout.LayoutParams
            if (params.topMargin != statusTop || params.bottomMargin != navigationBottom) {
                params.topMargin = statusTop
                params.bottomMargin = navigationBottom
                webView.layoutParams = params
            }

            insets
        }

        setContentView(rootView)
        rootView.requestApplyInsets()
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

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility =
                    window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
            }
        }

        if (::rootView.isInitialized) {
            rootView.requestApplyInsets()
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
