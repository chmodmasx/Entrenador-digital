package com.entrenadordigital.app

import android.annotation.SuppressLint
import android.annotation.TargetApi
import android.app.Activity
import android.app.AlertDialog
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
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
import android.widget.Toast
import android.window.OnBackInvokedDispatcher
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var rootView: FrameLayout
    private lateinit var webView: WebView

    private val updateExecutor = Executors.newSingleThreadExecutor()
    private var activityResumed = false
    private var updateCheckScheduled = false
    private var isTrainingMode = false
    private var updateDialogShowing = false
    private var updateDownloadInProgress = false
    private var waitingForInstallPermission = false
    private var pendingAvailableUpdate: AvailableUpdate? = null
    private var pendingPermissionUpdate: AvailableUpdate? = null
    private var pendingInstallerFile: File? = null
    private var downloadDialog: AlertDialog? = null
    private var pendingBackupJson: String? = null

    private data class AvailableUpdate(
        val versionName: String,
        val downloadUrl: String,
        val assetName: String,
        val expectedSize: Long,
        val sha256: String?
    )

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val statusBlue = Color.rgb(13, 52, 93)
        val navigationBlue = Color.rgb(3, 30, 84)

        window.statusBarColor = statusBlue
        window.navigationBarColor = navigationBlue

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

        rootView.postDelayed({
            if (!updateCheckScheduled) {
                updateCheckScheduled = true
                checkForUpdatesInBackground()
            }
        }, UPDATE_CHECK_DELAY_MS)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerModernBackHandler()
        }
    }

    override fun onResume() {
        super.onResume()
        activityResumed = true

        if (waitingForInstallPermission) {
            waitingForInstallPermission = false
            val update = pendingPermissionUpdate
            pendingPermissionUpdate = null

            if (update != null && canInstallUnknownPackages()) {
                downloadUpdate(update)
            }
        }

        val file = pendingInstallerFile
        if (file != null) {
            pendingInstallerFile = null
            launchPackageInstaller(file)
        }

        maybeShowUpdateDialog()
    }

    override fun onPause() {
        activityResumed = false
        super.onPause()
    }

    @Deprecated("Storage Access Framework result handling for Android 5+")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (resultCode != RESULT_OK) {
            if (requestCode == REQUEST_SAVE_BACKUP) pendingBackupJson = null
            return
        }

        val uri = data?.data ?: return
        when (requestCode) {
            REQUEST_SAVE_BACKUP -> {
                val json = pendingBackupJson
                pendingBackupJson = null
                if (json == null) return

                runCatching {
                    contentResolver.openOutputStream(uri, "wt")?.bufferedWriter(Charsets.UTF_8)?.use { writer ->
                        writer.write(json)
                    } ?: throw IllegalStateException("No se pudo abrir el archivo de destino.")
                }.onSuccess {
                    Toast.makeText(this, "Copia de seguridad guardada", Toast.LENGTH_SHORT).show()
                }.onFailure {
                    showBackupError("No se pudo guardar la copia de seguridad.")
                }
            }

            REQUEST_OPEN_BACKUP -> {
                runCatching {
                    val raw = contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { reader ->
                        reader.readText()
                    } ?: throw IllegalStateException("No se pudo abrir la copia seleccionada.")

                    if (raw.length > MAX_BACKUP_CHARS) {
                        throw IllegalStateException("La copia seleccionada es demasiado grande.")
                    }
                    raw
                }.onSuccess { raw ->
                    deliverBackupToWeb(raw)
                }.onFailure {
                    showBackupError("No se pudo leer la copia de seguridad seleccionada.")
                }
            }
        }
    }

    private fun beginBackupSave(json: String, suggestedName: String) {
        if (json.isBlank() || json.length > MAX_BACKUP_CHARS) {
            showBackupError("No se pudo preparar la copia de seguridad.")
            return
        }

        pendingBackupJson = json
        val safeName = suggestedName
            .replace(Regex("[^A-Za-z0-9._ -]"), "-")
            .take(120)
            .ifBlank { "Entrenador-Digital-backup.json" }

        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, safeName)
        }

        runCatching {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, REQUEST_SAVE_BACKUP)
        }.onFailure {
            pendingBackupJson = null
            showBackupError("Android no pudo abrir el selector para guardar el archivo.")
        }
    }

    private fun beginBackupOpen() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/json", "text/plain"))
        }

        runCatching {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, REQUEST_OPEN_BACKUP)
        }.onFailure {
            showBackupError("Android no pudo abrir el selector de archivos.")
        }
    }

    private fun deliverBackupToWeb(raw: String) {
        if (!::webView.isInitialized) return
        val quoted = JSONObject.quote(raw)
        webView.evaluateJavascript(
            "window.__ENTRENADOR_IMPORT_BACKUP && window.__ENTRENADOR_IMPORT_BACKUP($quoted);",
            null
        )
    }

    private fun showBackupError(message: String) {
        if (isFinishing || (Build.VERSION.SDK_INT >= 17 && isDestroyed)) return
        AlertDialog.Builder(this)
            .setTitle("Copia de seguridad")
            .setMessage(message)
            .setPositiveButton("Aceptar", null)
            .show()
    }

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
        downloadDialog?.dismiss()
        downloadDialog = null
        updateExecutor.shutdownNow()
        webView.removeJavascriptInterface("Android")
        webView.destroy()
        super.onDestroy()
    }

    fun setTrainingMode(enabled: Boolean) {
        isTrainingMode = enabled

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

            maybeShowUpdateDialog()
        }

        if (::rootView.isInitialized) {
            rootView.requestApplyInsets()
        }
    }

    private fun checkForUpdatesInBackground() {
        updateExecutor.execute {
            val update = runCatching { fetchLatestRelease() }.getOrNull() ?: return@execute
            if (!isNewerVersion(update.versionName, BuildConfig.VERSION_NAME)) return@execute

            runOnUiThread {
                pendingAvailableUpdate = update
                maybeShowUpdateDialog()
            }
        }
    }

    private fun fetchLatestRelease(): AvailableUpdate? {
        val connection = (URL(LATEST_RELEASE_API).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 5_000
            readTimeout = 8_000
            setRequestProperty("Accept", "application/vnd.github+json")
            setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
            setRequestProperty("User-Agent", "Entrenador-Digital-Android/${BuildConfig.VERSION_NAME}")
        }

        return try {
            if (connection.responseCode != HttpURLConnection.HTTP_OK) return null

            val payload = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val release = JSONObject(payload)
            val versionName = normalizeVersion(release.optString("tag_name")) ?: return null
            val assets = release.optJSONArray("assets") ?: return null

            var selected: JSONObject? = null
            var selectedScore = Int.MIN_VALUE

            for (index in 0 until assets.length()) {
                val asset = assets.optJSONObject(index) ?: continue
                val name = asset.optString("name")
                if (!name.endsWith(".apk", ignoreCase = true)) continue

                var score = 0
                if (name.contains("Entrenador", ignoreCase = true)) score += 4
                if (name.contains("universal", ignoreCase = true)) score += 2
                if (name.contains("release", ignoreCase = true)) score += 1

                if (selected == null || score > selectedScore) {
                    selected = asset
                    selectedScore = score
                }
            }

            val asset = selected ?: return null
            val downloadUrl = asset.optString("browser_download_url")
            if (!downloadUrl.startsWith("https://github.com/")) return null

            val digest = asset.optString("digest")
                .takeIf { it.startsWith("sha256:", ignoreCase = true) }
                ?.substringAfter(':')
                ?.lowercase()

            AvailableUpdate(
                versionName = versionName,
                downloadUrl = downloadUrl,
                assetName = asset.optString("name", "actualizacion.apk"),
                expectedSize = asset.optLong("size", -1L),
                sha256 = digest
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun maybeShowUpdateDialog() {
        if (!activityResumed || isTrainingMode || updateDialogShowing || updateDownloadInProgress) return
        val update = pendingAvailableUpdate ?: return

        updateDialogShowing = true
        val dialog = AlertDialog.Builder(this)
            .setTitle("Actualización disponible")
            .setMessage(
                "Está disponible Entrenador Digital ${update.versionName}. " +
                    "¿Querés descargarla e instalarla ahora?"
            )
            .setNegativeButton("Más tarde") { _, _ ->
                pendingAvailableUpdate = null
            }
            .setPositiveButton("Actualizar") { _, _ ->
                pendingAvailableUpdate = null
                prepareUpdate(update)
            }
            .setOnCancelListener {
                pendingAvailableUpdate = null
            }
            .create()

        dialog.setOnDismissListener {
            updateDialogShowing = false
        }
        dialog.show()
    }

    private fun prepareUpdate(update: AvailableUpdate) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !canInstallUnknownPackages()) {
            pendingPermissionUpdate = update

            AlertDialog.Builder(this)
                .setTitle("Permitir actualizaciones")
                .setMessage(
                    "Android necesita que autorices a Entrenador Digital para instalar " +
                        "sus propias actualizaciones. Activá “Permitir desde esta fuente”."
                )
                .setNegativeButton("Cancelar") { _, _ ->
                    pendingPermissionUpdate = null
                    waitingForInstallPermission = false
                }
                .setPositiveButton("Abrir ajustes") { _, _ ->
                    waitingForInstallPermission = true
                    val intent = Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:$packageName")
                    )
                    runCatching { startActivity(intent) }.onFailure {
                        waitingForInstallPermission = false
                        pendingPermissionUpdate = null
                        showUpdateError("No se pudieron abrir los ajustes de instalación de Android.")
                    }
                }
                .show()
            return
        }

        downloadUpdate(update)
    }

    private fun canInstallUnknownPackages(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()
    }

    private fun downloadUpdate(update: AvailableUpdate) {
        if (updateDownloadInProgress) return
        updateDownloadInProgress = true

        downloadDialog = AlertDialog.Builder(this)
            .setTitle("Descargando actualización")
            .setMessage("Esperá un momento…")
            .setCancelable(false)
            .create()
            .also { it.show() }

        updateExecutor.execute {
            val result = runCatching { downloadAndValidateUpdate(update) }
            val file = result.getOrNull()
            val error = result.exceptionOrNull()?.message

            runOnUiThread {
                updateDownloadInProgress = false
                downloadDialog?.dismiss()
                downloadDialog = null

                if (file == null) {
                    showUpdateError(error ?: "No se pudo descargar la actualización.")
                    return@runOnUiThread
                }

                if (activityResumed) {
                    launchPackageInstaller(file)
                } else {
                    pendingInstallerFile = file
                }
            }
        }
    }

    private fun downloadAndValidateUpdate(update: AvailableUpdate): File {
        val updatesDir = File(cacheDir, "updates").apply { mkdirs() }
        val tempFile = File(updatesDir, "update.tmp")
        val finalFile = File(updatesDir, "update.apk")
        tempFile.delete()
        finalFile.delete()

        val digest = MessageDigest.getInstance("SHA-256")
        var totalBytes = 0L

        val connection = (URL(update.downloadUrl).openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = true
            connectTimeout = 10_000
            readTimeout = 30_000
            setRequestProperty("Accept", "application/octet-stream")
            setRequestProperty("User-Agent", "Entrenador-Digital-Android/${BuildConfig.VERSION_NAME}")
        }

        try {
            if (connection.responseCode !in 200..299) {
                throw IllegalStateException("GitHub respondió con HTTP ${connection.responseCode}.")
            }

            connection.inputStream.use { input ->
                tempFile.outputStream().buffered().use { output ->
                    val buffer = ByteArray(32 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        if (Thread.currentThread().isInterrupted) {
                            throw InterruptedException("Descarga cancelada")
                        }
                        output.write(buffer, 0, read)
                        digest.update(buffer, 0, read)
                        totalBytes += read
                    }
                }
            }
        } finally {
            connection.disconnect()
        }

        if (totalBytes <= 0L) {
            tempFile.delete()
            throw IllegalStateException("La descarga llegó vacía.")
        }

        if (update.expectedSize > 0L && totalBytes != update.expectedSize) {
            tempFile.delete()
            throw IllegalStateException("La descarga quedó incompleta.")
        }

        val downloadedSha256 = digest.digest().joinToString("") { "%02x".format(it) }
        if (update.sha256 != null && !downloadedSha256.equals(update.sha256, ignoreCase = true)) {
            tempFile.delete()
            throw IllegalStateException("La verificación de integridad de la actualización falló.")
        }

        if (!tempFile.renameTo(finalFile)) {
            tempFile.copyTo(finalFile, overwrite = true)
            tempFile.delete()
        }

        val validationError = validateDownloadedApk(finalFile, update)
        if (validationError != null) {
            finalFile.delete()
            throw IllegalStateException(validationError)
        }

        return finalFile
    }

    @Suppress("DEPRECATION")
    private fun validateDownloadedApk(file: File, update: AvailableUpdate): String? {
        val signingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }

        val downloaded = packageManager.getPackageArchiveInfo(file.absolutePath, signingFlags)
            ?: return "Android no pudo leer el APK descargado."
        val installed = packageManager.getPackageInfo(packageName, signingFlags)

        if (downloaded.packageName != packageName) {
            return "El APK descargado no pertenece a Entrenador Digital."
        }

        val downloadedCode = packageVersionCode(downloaded)
        val installedCode = packageVersionCode(installed)
        if (downloadedCode <= installedCode) {
            return "La actualización descargada no tiene un versionCode superior al instalado."
        }

        val downloadedVersion = normalizeVersion(downloaded.versionName ?: "")
        if (downloadedVersion != null && compareVersions(downloadedVersion, update.versionName) != 0) {
            return "La versión del APK no coincide con la release publicada."
        }

        val installedSigners = packageSignerDigests(installed)
        val downloadedSigners = packageSignerDigests(downloaded)
        if (installedSigners.isEmpty() || downloadedSigners.isEmpty() ||
            installedSigners.intersect(downloadedSigners).isEmpty()
        ) {
            return "La firma del APK no coincide con la instalación actual."
        }

        return null
    }

    @Suppress("DEPRECATION")
    private fun packageSignerDigests(info: PackageInfo): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = info.signingInfo ?: return emptySet()
            if (signingInfo.hasMultipleSigners()) {
                signingInfo.apkContentsSigners
            } else {
                signingInfo.signingCertificateHistory
            }
        } else {
            info.signatures ?: emptyArray()
        }

        return signatures.mapTo(mutableSetOf()) { signature ->
            MessageDigest.getInstance("SHA-256")
                .digest(signature.toByteArray())
                .joinToString("") { "%02x".format(it) }
        }
    }

    @Suppress("DEPRECATION")
    private fun packageVersionCode(info: PackageInfo): Long {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            info.versionCode.toLong()
        }
    }

    private fun launchPackageInstaller(file: File) {
        if (!file.isFile) {
            showUpdateError("El archivo de actualización ya no está disponible.")
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !canInstallUnknownPackages()) {
            showUpdateError("Android no autorizó la instalación desde Entrenador Digital.")
            return
        }

        val uri = Uri.Builder()
            .scheme("content")
            .authority("$packageName.updates")
            .appendPath("update.apk")
            .build()

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, APK_MIME_TYPE)
            clipData = ClipData.newRawUri("actualizacion", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        runCatching { startActivity(intent) }.onFailure {
            showUpdateError("Android no pudo abrir el instalador de paquetes.")
        }
    }

    private fun showUpdateError(message: String) {
        if (!activityResumed || isFinishing || (Build.VERSION.SDK_INT >= 17 && isDestroyed)) return

        AlertDialog.Builder(this)
            .setTitle("No se pudo actualizar")
            .setMessage(message)
            .setPositiveButton("Aceptar", null)
            .show()
    }

    private fun normalizeVersion(raw: String): String? {
        val clean = raw.trim()
            .removePrefix("v")
            .removePrefix("V")
            .substringBefore('-')
            .substringBefore('+')

        val parts = clean.split('.')
        if (parts.isEmpty() || parts.any { it.isEmpty() || it.toIntOrNull() == null }) return null
        return parts.joinToString(".") { it.toInt().toString() }
    }

    private fun isNewerVersion(candidate: String, current: String): Boolean {
        val normalizedCurrent = normalizeVersion(current) ?: return false
        return compareVersions(candidate, normalizedCurrent) > 0
    }

    private fun compareVersions(left: String, right: String): Int {
        val leftParts = left.split('.').map { it.toIntOrNull() ?: 0 }
        val rightParts = right.split('.').map { it.toIntOrNull() ?: 0 }
        val size = maxOf(leftParts.size, rightParts.size)

        for (index in 0 until size) {
            val a = leftParts.getOrElse(index) { 0 }
            val b = rightParts.getOrElse(index) { 0 }
            if (a != b) return a.compareTo(b)
        }

        return 0
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
        fun saveBackup(json: String, suggestedName: String) {
            activity.runOnUiThread { activity.beginBackupSave(json, suggestedName) }
        }

        @JavascriptInterface
        fun openBackup() {
            activity.runOnUiThread { activity.beginBackupOpen() }
        }

        @JavascriptInterface
        fun finishApp() {
            activity.runOnUiThread { activity.finish() }
        }
    }

    companion object {
        private const val LATEST_RELEASE_API =
            "https://api.github.com/repos/chmodmasx/Entrenador-digital/releases/latest"
        private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
        private const val UPDATE_CHECK_DELAY_MS = 1_200L
        private const val REQUEST_SAVE_BACKUP = 4101
        private const val REQUEST_OPEN_BACKUP = 4102
        private const val MAX_BACKUP_CHARS = 8_000_000
    }
}
