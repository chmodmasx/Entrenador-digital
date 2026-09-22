package com.entrenadordigital.app

import android.app.Activity
import android.app.AlertDialog
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

class UpdateManager(private val activity: Activity) {
    private val executor = Executors.newSingleThreadExecutor()
    private var activityResumed = false
    private var trainingMode = false
    private var updateDialogShowing = false
    private var updateDownloadInProgress = false
    private var waitingForInstallPermission = false
    private var pendingAvailableUpdate: AvailableUpdate? = null
    private var pendingPermissionUpdate: AvailableUpdate? = null
    private var pendingInstallerFile: File? = null
    private var downloadDialog: AlertDialog? = null
    private var manualCheckDialog: AlertDialog? = null
    private var manualCheckInProgress = false

    private data class AvailableUpdate(
        val versionName: String,
        val downloadUrl: String,
        val assetName: String,
        val expectedSize: Long,
        val sha256: String?
    )

    fun onResume() {
        activityResumed = true

        if (waitingForInstallPermission) {
            waitingForInstallPermission = false
            val update = pendingPermissionUpdate
            pendingPermissionUpdate = null
            if (update != null && canInstallUnknownPackages()) downloadUpdate(update)
        }

        pendingInstallerFile?.let { file ->
            pendingInstallerFile = null
            launchPackageInstaller(file)
        }
        maybeShowUpdateDialog()
    }

    fun onPause() {
        activityResumed = false
    }

    fun setTrainingMode(enabled: Boolean) {
        trainingMode = enabled
        if (!enabled) maybeShowUpdateDialog()
    }

    fun shutdown() {
        downloadDialog?.dismiss()
        downloadDialog = null
        manualCheckDialog?.dismiss()
        manualCheckDialog = null
        executor.shutdownNow()
    }

    fun checkForUpdatesInBackground() {
        executor.execute {
            val update = runCatching { fetchLatestRelease() }.getOrNull() ?: return@execute
            if (!isNewerVersion(update.versionName, BuildConfig.VERSION_NAME)) return@execute
            activity.runOnUiThread {
                pendingAvailableUpdate = update
                maybeShowUpdateDialog()
            }
        }
    }

    fun checkForUpdatesManually() {
        if (manualCheckInProgress) return
        manualCheckInProgress = true

        manualCheckDialog = AlertDialog.Builder(activity)
            .setTitle("Buscando actualizaciones")
            .setMessage("Consultando la última versión disponible…")
            .setCancelable(false)
            .create()
            .also { it.show() }

        executor.execute {
            val result = runCatching { fetchLatestRelease() }
            activity.runOnUiThread {
                manualCheckInProgress = false
                manualCheckDialog?.dismiss()
                manualCheckDialog = null

                if (!activityResumed || activity.isFinishing ||
                    (Build.VERSION.SDK_INT >= 17 && activity.isDestroyed)
                ) return@runOnUiThread

                val update = result.getOrNull()
                if (update == null) {
                    val detail = result.exceptionOrNull()?.message
                    showUpdateCheckError(detail ?: "No se pudo obtener una release válida desde GitHub.")
                    return@runOnUiThread
                }

                if (isNewerVersion(update.versionName, BuildConfig.VERSION_NAME)) {
                    pendingAvailableUpdate = update
                    maybeShowUpdateDialog()
                    return@runOnUiThread
                }

                AlertDialog.Builder(activity)
                    .setTitle("Sin actualizaciones")
                    .setMessage("Ya tenés la última versión de Entrenador Digital (${BuildConfig.VERSION_NAME}).")
                    .setPositiveButton("Aceptar", null)
                    .show()
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
            val release = org.json.JSONObject(payload)
            val versionName = normalizeVersion(release.optString("tag_name")) ?: return null
            val assets = release.optJSONArray("assets") ?: return null

            var selected: org.json.JSONObject? = null
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
        if (!activityResumed || trainingMode || updateDialogShowing || updateDownloadInProgress) return
        if (activity.isFinishing || (Build.VERSION.SDK_INT >= 17 && activity.isDestroyed)) return
        val update = pendingAvailableUpdate ?: return

        updateDialogShowing = true
        val dialog = AlertDialog.Builder(activity)
            .setTitle("Actualización disponible")
            .setMessage("Está disponible Entrenador Digital ${update.versionName}. ¿Querés descargarla e instalarla ahora?")
            .setNegativeButton("Más tarde") { _, _ -> pendingAvailableUpdate = null }
            .setPositiveButton("Actualizar") { _, _ ->
                pendingAvailableUpdate = null
                prepareUpdate(update)
            }
            .setOnCancelListener { pendingAvailableUpdate = null }
            .create()

        dialog.setOnDismissListener { updateDialogShowing = false }
        dialog.show()
    }

    private fun prepareUpdate(update: AvailableUpdate) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !canInstallUnknownPackages()) {
            pendingPermissionUpdate = update
            AlertDialog.Builder(activity)
                .setTitle("Permitir actualizaciones")
                .setMessage("Android necesita que autorices a Entrenador Digital para instalar sus propias actualizaciones. Activá “Permitir desde esta fuente”.")
                .setNegativeButton("Cancelar") { _, _ ->
                    pendingPermissionUpdate = null
                    waitingForInstallPermission = false
                }
                .setPositiveButton("Abrir ajustes") { _, _ ->
                    waitingForInstallPermission = true
                    val intent = Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:${activity.packageName}")
                    )
                    runCatching { activity.startActivity(intent) }.onFailure {
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
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.packageManager.canRequestPackageInstalls()
    }

    private fun downloadUpdate(update: AvailableUpdate) {
        if (updateDownloadInProgress) return
        updateDownloadInProgress = true

        downloadDialog = AlertDialog.Builder(activity)
            .setTitle("Descargando actualización")
            .setMessage("Esperá un momento…")
            .setCancelable(false)
            .create()
            .also { it.show() }

        executor.execute {
            val result = runCatching { downloadAndValidateUpdate(update) }
            val file = result.getOrNull()
            val error = result.exceptionOrNull()?.message

            activity.runOnUiThread {
                updateDownloadInProgress = false
                downloadDialog?.dismiss()
                downloadDialog = null

                if (file == null) {
                    showUpdateError(error ?: "No se pudo descargar la actualización.")
                    return@runOnUiThread
                }
                if (activityResumed) launchPackageInstaller(file) else pendingInstallerFile = file
            }
        }
    }

    private fun downloadAndValidateUpdate(update: AvailableUpdate): File {
        val updatesDir = File(activity.cacheDir, "updates").apply { mkdirs() }
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
                        if (Thread.currentThread().isInterrupted) throw InterruptedException("Descarga cancelada")
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

        validateDownloadedApk(finalFile, update)?.let { error ->
            finalFile.delete()
            throw IllegalStateException(error)
        }
        return finalFile
    }

    @Suppress("DEPRECATION")
    private fun validateDownloadedApk(file: File, update: AvailableUpdate): String? {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES
        else PackageManager.GET_SIGNATURES

        val downloaded = activity.packageManager.getPackageArchiveInfo(file.absolutePath, flags)
            ?: return "Android no pudo leer el APK descargado."
        val installed = activity.packageManager.getPackageInfo(activity.packageName, flags)

        if (downloaded.packageName != activity.packageName) return "El APK descargado no pertenece a Entrenador Digital."
        if (packageVersionCode(downloaded) <= packageVersionCode(installed)) {
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
            if (signingInfo.hasMultipleSigners()) signingInfo.apkContentsSigners else signingInfo.signingCertificateHistory
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
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()
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
            .authority("${activity.packageName}.updates")
            .appendPath("update.apk")
            .build()

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, APK_MIME_TYPE)
            clipData = ClipData.newRawUri("actualizacion", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { activity.startActivity(intent) }
            .onFailure { showUpdateError("Android no pudo abrir el instalador de paquetes.") }
    }

    private fun showUpdateError(message: String) {
        if (!activityResumed || activity.isFinishing || (Build.VERSION.SDK_INT >= 17 && activity.isDestroyed)) return
        AlertDialog.Builder(activity).setTitle("No se pudo actualizar").setMessage(message)
            .setPositiveButton("Aceptar", null).show()
    }

    private fun showUpdateCheckError(message: String) {
        if (!activityResumed || activity.isFinishing || (Build.VERSION.SDK_INT >= 17 && activity.isDestroyed)) return
        AlertDialog.Builder(activity)
            .setTitle("No se pudo buscar actualizaciones")
            .setMessage(message)
            .setPositiveButton("Aceptar", null)
            .show()
    }

    private fun normalizeVersion(raw: String): String? {
        val clean = raw.trim().removePrefix("v").removePrefix("V").substringBefore('-').substringBefore('+')
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

    companion object {
        private const val LATEST_RELEASE_API =
            "https://api.github.com/repos/chmodmasx/Entrenador-digital/releases/latest"
        private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
    }
}
