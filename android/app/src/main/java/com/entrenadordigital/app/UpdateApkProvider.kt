package com.entrenadordigital.app

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

class UpdateApkProvider : ContentProvider() {
    override fun onCreate(): Boolean = true

    private fun updateFile(uri: Uri): File {
        if (uri.path != "/update.apk") {
            throw FileNotFoundException("Unknown update path")
        }

        val appContext = context ?: throw FileNotFoundException("Provider unavailable")
        val file = File(File(appContext.cacheDir, "updates"), "update.apk")
        if (!file.isFile) {
            throw FileNotFoundException("Update APK not found")
        }
        return file
    }

    override fun getType(uri: Uri): String = "application/vnd.android.package-archive"

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        if (mode != "r") throw FileNotFoundException("Read-only provider")
        return ParcelFileDescriptor.open(updateFile(uri), ParcelFileDescriptor.MODE_READ_ONLY)
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?
    ): Cursor {
        val file = updateFile(uri)
        val columns = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        val cursor = MatrixCursor(columns, 1)
        val row = cursor.newRow()

        columns.forEach { column ->
            when (column) {
                OpenableColumns.DISPLAY_NAME -> row.add("Entrenador-Digital-actualizacion.apk")
                OpenableColumns.SIZE -> row.add(file.length())
                else -> row.add(null)
            }
        }

        return cursor
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? =
        throw UnsupportedOperationException("Read-only provider")

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?
    ): Int = throw UnsupportedOperationException("Read-only provider")

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int =
        throw UnsupportedOperationException("Read-only provider")
}
