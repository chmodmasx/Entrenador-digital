package com.entrenadordigital.app

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.webkit.JavascriptInterface

class NativeBridge(
    private val activity: MainActivity,
    private val backupManager: BackupManager
) {
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
        activity.runOnUiThread { backupManager.beginSave(json, suggestedName) }
    }

    @JavascriptInterface
    fun openBackup() {
        activity.runOnUiThread { backupManager.beginOpen() }
    }

    @JavascriptInterface
    fun finishApp() {
        activity.runOnUiThread { activity.finish() }
    }
}
