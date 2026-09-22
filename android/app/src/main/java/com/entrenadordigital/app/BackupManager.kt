package com.entrenadordigital.app

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.webkit.WebView
import android.widget.Toast
import org.json.JSONObject

class BackupManager(
    private val activity: Activity,
    private val webViewProvider: () -> WebView?
) {
    private var pendingBackupJson: String? = null

    fun beginSave(json: String, suggestedName: String) {
        if (json.isBlank() || json.length > MAX_BACKUP_CHARS) {
            showError("No se pudo preparar la copia de seguridad.")
            return
        }
        pendingBackupJson = json
        val safeName = suggestedName.replace(Regex("[^A-Za-z0-9._ -]"), "-").take(120)
            .ifBlank { "Entrenador-Digital-backup.json" }

        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, safeName)
        }
        runCatching {
            @Suppress("DEPRECATION")
            activity.startActivityForResult(intent, REQUEST_SAVE_BACKUP)
        }.onFailure {
            pendingBackupJson = null
            showError("Android no pudo abrir el selector para guardar el archivo.")
        }
    }

    fun beginOpen() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/json", "text/plain"))
        }
        runCatching {
            @Suppress("DEPRECATION")
            activity.startActivityForResult(intent, REQUEST_OPEN_BACKUP)
        }.onFailure {
            showError("Android no pudo abrir el selector de archivos.")
        }
    }

    fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST_SAVE_BACKUP && requestCode != REQUEST_OPEN_BACKUP) return false
        if (resultCode != Activity.RESULT_OK) {
            if (requestCode == REQUEST_SAVE_BACKUP) pendingBackupJson = null
            return true
        }

        val uri = data?.data ?: return true
        when (requestCode) {
            REQUEST_SAVE_BACKUP -> {
                val json = pendingBackupJson
                pendingBackupJson = null
                if (json == null) return true
                runCatching {
                    activity.contentResolver.openOutputStream(uri, "wt")?.bufferedWriter(Charsets.UTF_8)?.use { it.write(json) }
                        ?: throw IllegalStateException("No se pudo abrir el archivo de destino.")
                }.onSuccess {
                    Toast.makeText(activity, "Copia de seguridad guardada", Toast.LENGTH_SHORT).show()
                }.onFailure {
                    showError("No se pudo guardar la copia de seguridad.")
                }
            }
            REQUEST_OPEN_BACKUP -> {
                runCatching {
                    val raw = activity.contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
                        ?: throw IllegalStateException("No se pudo abrir la copia seleccionada.")
                    if (raw.length > MAX_BACKUP_CHARS) throw IllegalStateException("La copia seleccionada es demasiado grande.")
                    raw
                }.onSuccess(::deliverToWeb)
                    .onFailure { showError("No se pudo leer la copia de seguridad seleccionada.") }
            }
        }
        return true
    }

    private fun deliverToWeb(raw: String) {
        val webView = webViewProvider() ?: return
        val quoted = JSONObject.quote(raw)
        webView.evaluateJavascript(
            "window.__ENTRENADOR_IMPORT_BACKUP && window.__ENTRENADOR_IMPORT_BACKUP($quoted);",
            null
        )
    }

    private fun showError(message: String) {
        if (activity.isFinishing || (android.os.Build.VERSION.SDK_INT >= 17 && activity.isDestroyed)) return
        AlertDialog.Builder(activity).setTitle("Copia de seguridad").setMessage(message)
            .setPositiveButton("Aceptar", null).show()
    }

    companion object {
        private const val REQUEST_SAVE_BACKUP = 4101
        private const val REQUEST_OPEN_BACKUP = 4102
        private const val MAX_BACKUP_CHARS = 8_000_000
    }
}
