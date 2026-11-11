/*
 * Exposes public Android dynamic system palette resources (API 31+ tonal families,
 * API 34+ semantic roles, API 35+ error tonal scale, and diagnostic WallpaperManager
 * wallpaper colors) to React Native without touching hidden or OEM-private APIs.
 */

package com.ayumi.health

import android.app.WallpaperManager
import android.content.Context
import android.content.res.Resources
import android.os.Build
import android.util.Log
import androidx.annotation.ColorRes
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

class SystemPaletteModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AyumiSystemPalette"

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getExtendedSystemPalette(): WritableMap? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return null
        }

        val res = reactApplicationContext.resources
        val result = Arguments.createMap()
        result.putInt("sdkInt", Build.VERSION.SDK_INT)

        val accent1 = resolveTonalList(res, ACCENT1_RES_IDS, "system_accent1")
        val accent2 = resolveTonalList(res, ACCENT2_RES_IDS, "system_accent2")
        val accent3 = resolveTonalList(res, ACCENT3_RES_IDS, "system_accent3")
        val neutral1 = resolveTonalList(res, NEUTRAL1_RES_IDS, "system_neutral1")
        val neutral2 = resolveTonalList(res, NEUTRAL2_RES_IDS, "system_neutral2")

        // Write freshly built WritableArrays without ever reading them back after putArray
        // transfers ownership to the parent WritableMap.
        result.putArray("system_accent1", toWritableArray(accent1))
        result.putArray("system_accent2", toWritableArray(accent2))
        result.putArray("system_accent3", toWritableArray(accent3))
        result.putArray("system_neutral1", toWritableArray(neutral1))
        result.putArray("system_neutral2", toWritableArray(neutral2))

        var errorScaleSample: String? = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            val errorScale = resolveErrorList(res)
            errorScaleSample = errorScale.getOrNull(8) ?: errorScale.getOrNull(6)
            result.putArray("system_error", toWritableArray(errorScale))
        }

        var semanticErrorLight: String? = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val semantic = resolveSemanticTokens(res)
            semanticErrorLight = semantic["errorLight"]
            result.putMap("semantic", toWritableMap(semantic))
        }

        val wallpaperInfo = resolveWallpaperDiagnostics(reactApplicationContext)
        if (wallpaperInfo != null) {
            result.putMap("wallpaper", wallpaperInfo)
        }

        Log.i(
            TAG,
            "sdk=${Build.VERSION.SDK_INT} oem=${Build.MANUFACTURER}/${Build.MODEL} " +
                "a1[600]=${accent1.getOrNull(8)} a2[600]=${accent2.getOrNull(8)} a3[600]=${accent3.getOrNull(8)} " +
                "errLight=$semanticErrorLight err600=$errorScaleSample"
        )

        return result
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private fun resolveTonalList(
        res: Resources,
        colorIds: IntArray,
        familyName: String
    ): List<String> = colorIds.map { colorResId ->
        resolveColorHexOrNull(res, colorResId, familyName) ?: "#000000"
    }

    private fun toWritableArray(values: List<String>): WritableArray {
        val list = Arguments.createArray()
        for (value in values) {
            list.pushString(value)
        }
        return list
    }

    private fun toWritableMap(entries: Map<String, String>): WritableMap {
        val map = Arguments.createMap()
        for ((key, value) in entries) {
            map.putString(key, value)
        }
        return map
    }

    @RequiresApi(Build.VERSION_CODES.VANILLA_ICE_CREAM)
    private fun resolveErrorList(res: Resources): List<String> {
        val errorIds = intArrayOf(
            android.R.color.system_error_0,
            android.R.color.system_error_10,
            android.R.color.system_error_50,
            android.R.color.system_error_100,
            android.R.color.system_error_200,
            android.R.color.system_error_300,
            android.R.color.system_error_400,
            android.R.color.system_error_500,
            android.R.color.system_error_600,
            android.R.color.system_error_700,
            android.R.color.system_error_800,
            android.R.color.system_error_900,
            android.R.color.system_error_1000
        )
        return resolveTonalList(res, errorIds, "system_error")
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private fun resolveSemanticTokens(res: Resources): Map<String, String> {
        val map = LinkedHashMap<String, String>()
        val entries: Array<Pair<String, Int>> = arrayOf(
            "primaryLight" to android.R.color.system_primary_light,
            "primaryDark" to android.R.color.system_primary_dark,
            "primaryContainerLight" to android.R.color.system_primary_container_light,
            "primaryContainerDark" to android.R.color.system_primary_container_dark,
            "primaryFixed" to android.R.color.system_primary_fixed,
            "primaryFixedDim" to android.R.color.system_primary_fixed_dim,
            "secondaryLight" to android.R.color.system_secondary_light,
            "secondaryDark" to android.R.color.system_secondary_dark,
            "secondaryContainerLight" to android.R.color.system_secondary_container_light,
            "secondaryContainerDark" to android.R.color.system_secondary_container_dark,
            "secondaryFixed" to android.R.color.system_secondary_fixed,
            "secondaryFixedDim" to android.R.color.system_secondary_fixed_dim,
            "tertiaryLight" to android.R.color.system_tertiary_light,
            "tertiaryDark" to android.R.color.system_tertiary_dark,
            "tertiaryContainerLight" to android.R.color.system_tertiary_container_light,
            "tertiaryContainerDark" to android.R.color.system_tertiary_container_dark,
            "tertiaryFixed" to android.R.color.system_tertiary_fixed,
            "tertiaryFixedDim" to android.R.color.system_tertiary_fixed_dim,
            "errorLight" to android.R.color.system_error_light,
            "errorDark" to android.R.color.system_error_dark,
            "errorContainerLight" to android.R.color.system_error_container_light,
            "errorContainerDark" to android.R.color.system_error_container_dark,
            "surfaceLight" to android.R.color.system_surface_light,
            "surfaceDark" to android.R.color.system_surface_dark,
            "surfaceBrightLight" to android.R.color.system_surface_bright_light,
            "surfaceBrightDark" to android.R.color.system_surface_bright_dark,
            "surfaceDimLight" to android.R.color.system_surface_dim_light,
            "surfaceDimDark" to android.R.color.system_surface_dim_dark,
            "surfaceContainerLowestLight" to android.R.color.system_surface_container_lowest_light,
            "surfaceContainerLowestDark" to android.R.color.system_surface_container_lowest_dark,
            "surfaceContainerLowLight" to android.R.color.system_surface_container_low_light,
            "surfaceContainerLowDark" to android.R.color.system_surface_container_low_dark,
            "surfaceContainerLight" to android.R.color.system_surface_container_light,
            "surfaceContainerDark" to android.R.color.system_surface_container_dark,
            "surfaceContainerHighLight" to android.R.color.system_surface_container_high_light,
            "surfaceContainerHighDark" to android.R.color.system_surface_container_high_dark,
            "surfaceContainerHighestLight" to android.R.color.system_surface_container_highest_light,
            "surfaceContainerHighestDark" to android.R.color.system_surface_container_highest_dark,
            "outlineLight" to android.R.color.system_outline_light,
            "outlineDark" to android.R.color.system_outline_dark,
            "outlineVariantLight" to android.R.color.system_outline_variant_light,
            "outlineVariantDark" to android.R.color.system_outline_variant_dark,
            "paletteKeyPrimaryLight" to android.R.color.system_palette_key_color_primary_light,
            "paletteKeySecondaryLight" to android.R.color.system_palette_key_color_secondary_light,
            "paletteKeyTertiaryLight" to android.R.color.system_palette_key_color_tertiary_light,
            "paletteKeyNeutralLight" to android.R.color.system_palette_key_color_neutral_light
        )

        for ((key, colorResId) in entries) {
            val hex = resolveColorHexOrNull(res, colorResId, key)
            if (hex != null) {
                map[key] = hex
            }
        }
        return map
    }

    private fun resolveWallpaperDiagnostics(context: Context): WritableMap? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) {
            return null
        }
        val map = Arguments.createMap()
        return try {
            val wallpaperManager = WallpaperManager.getInstance(context)
            val colors = wallpaperManager.getWallpaperColors(WallpaperManager.FLAG_SYSTEM)
            if (colors != null) {
                map.putString("primaryHex", colorIntToHex(colors.primaryColor.toArgb()))
                colors.secondaryColor?.let { map.putString("secondaryHex", colorIntToHex(it.toArgb())) }
                colors.tertiaryColor?.let { map.putString("tertiaryHex", colorIntToHex(it.toArgb())) }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    map.putInt("colorHints", colors.colorHints)
                }
            }
            map
        } catch (ex: SecurityException) {
            Log.w(TAG, "WallpaperManager.getWallpaperColors denied: ${ex.message}")
            map.putString("error", "SecurityException")
            map
        }
    }

    private fun resolveColorHexOrNull(
        res: Resources,
        @ColorRes colorResId: Int,
        label: String
    ): String? {
        return try {
            colorIntToHex(res.getColor(colorResId, null))
        } catch (ex: Resources.NotFoundException) {
            Log.w(TAG, "Missing public system color resource $label ($colorResId): ${ex.message}")
            null
        }
    }

    private fun colorIntToHex(argb: Int): String = String.format("#%06X", 0xFFFFFF and argb)

    companion object {
        private const val TAG = "AyumiSystemPalette"

        @RequiresApi(Build.VERSION_CODES.S)
        private val ACCENT1_RES_IDS = intArrayOf(
            android.R.color.system_accent1_0,
            android.R.color.system_accent1_10,
            android.R.color.system_accent1_50,
            android.R.color.system_accent1_100,
            android.R.color.system_accent1_200,
            android.R.color.system_accent1_300,
            android.R.color.system_accent1_400,
            android.R.color.system_accent1_500,
            android.R.color.system_accent1_600,
            android.R.color.system_accent1_700,
            android.R.color.system_accent1_800,
            android.R.color.system_accent1_900,
            android.R.color.system_accent1_1000
        )

        @RequiresApi(Build.VERSION_CODES.S)
        private val ACCENT2_RES_IDS = intArrayOf(
            android.R.color.system_accent2_0,
            android.R.color.system_accent2_10,
            android.R.color.system_accent2_50,
            android.R.color.system_accent2_100,
            android.R.color.system_accent2_200,
            android.R.color.system_accent2_300,
            android.R.color.system_accent2_400,
            android.R.color.system_accent2_500,
            android.R.color.system_accent2_600,
            android.R.color.system_accent2_700,
            android.R.color.system_accent2_800,
            android.R.color.system_accent2_900,
            android.R.color.system_accent2_1000
        )

        @RequiresApi(Build.VERSION_CODES.S)
        private val ACCENT3_RES_IDS = intArrayOf(
            android.R.color.system_accent3_0,
            android.R.color.system_accent3_10,
            android.R.color.system_accent3_50,
            android.R.color.system_accent3_100,
            android.R.color.system_accent3_200,
            android.R.color.system_accent3_300,
            android.R.color.system_accent3_400,
            android.R.color.system_accent3_500,
            android.R.color.system_accent3_600,
            android.R.color.system_accent3_700,
            android.R.color.system_accent3_800,
            android.R.color.system_accent3_900,
            android.R.color.system_accent3_1000
        )

        @RequiresApi(Build.VERSION_CODES.S)
        private val NEUTRAL1_RES_IDS = intArrayOf(
            android.R.color.system_neutral1_0,
            android.R.color.system_neutral1_10,
            android.R.color.system_neutral1_50,
            android.R.color.system_neutral1_100,
            android.R.color.system_neutral1_200,
            android.R.color.system_neutral1_300,
            android.R.color.system_neutral1_400,
            android.R.color.system_neutral1_500,
            android.R.color.system_neutral1_600,
            android.R.color.system_neutral1_700,
            android.R.color.system_neutral1_800,
            android.R.color.system_neutral1_900,
            android.R.color.system_neutral1_1000
        )

        @RequiresApi(Build.VERSION_CODES.S)
        private val NEUTRAL2_RES_IDS = intArrayOf(
            android.R.color.system_neutral2_0,
            android.R.color.system_neutral2_10,
            android.R.color.system_neutral2_50,
            android.R.color.system_neutral2_100,
            android.R.color.system_neutral2_200,
            android.R.color.system_neutral2_300,
            android.R.color.system_neutral2_400,
            android.R.color.system_neutral2_500,
            android.R.color.system_neutral2_600,
            android.R.color.system_neutral2_700,
            android.R.color.system_neutral2_800,
            android.R.color.system_neutral2_900,
            android.R.color.system_neutral2_1000
        )
    }
}

