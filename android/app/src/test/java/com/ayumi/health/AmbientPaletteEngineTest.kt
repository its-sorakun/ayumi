/**
 * AmbientPaletteEngineTest — JVM unit tests verifying OKLab MMCQ bitmap quantization,
 * diverse chromatic accent preservation across anime-style scenes, neutral fallback stability,
 * and sensitive API key redaction.
 */
package com.ayumi.health

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AmbientPaletteEngineTest {

    private fun makeArgb(r: Int, g: Int, b: Int): Int =
        (0xFF shl 24) or ((r and 0xFF) shl 16) or ((g and 0xFF) shl 8) or (b and 0xFF)

    @Test
    fun sunsetCherryBlossomScene_preservesVibrantFocalAccentsWithoutFixedHardcoding() {
        val pixels = IntArray(400) { idx ->
            when {
                idx < 220 -> makeArgb(98, 92, 168)   // Indigo dusk sky
                idx < 310 -> makeArgb(242, 146, 178) // Sakura pink blossoms
                idx < 365 -> makeArgb(245, 198, 122) // Warm horizon glow
                else -> makeArgb(42, 54, 72)         // Balcony timber shadow
            }
        }

        val palette = AmbientPaletteEngine.extractFromPixels(pixels)
        assertTrue(palette.primary.matches(Regex("^#[0-9A-F]{6}$")))
        assertTrue(palette.secondary.matches(Regex("^#[0-9A-F]{6}$")))
        assertTrue(palette.tertiary.matches(Regex("^#[0-9A-F]{6}$")))
        assertNotEquals(palette.primary, palette.secondary)
        assertNotEquals(palette.primary, palette.tertiary)

        // Ensure derived light/dark text contrasts cleanly with extracted surface tints.
        val lightSurfaceContrast = AmbientPaletteEngine.contrastRatio(palette.shadowDark, palette.surfaceLightTint)
        assertTrue("Expected light mode contrast >= 7.0, got $lightSurfaceContrast", lightSurfaceContrast >= 7.0)
    }

    @Test
    fun coastalAfternoonScene_extractsBlueTealPaletteDistinctFromSakura() {
        val coastalPixels = IntArray(400) { idx ->
            when {
                idx < 240 -> makeArgb(68, 152, 224)  // Clear azure sky
                idx < 340 -> makeArgb(44, 178, 168)  // Jade sea horizon
                else -> makeArgb(238, 212, 134)      // Golden sunlight crest
            }
        }
        val sakuraPixels = IntArray(400) { idx ->
            when {
                idx < 240 -> makeArgb(148, 102, 172)
                else -> makeArgb(240, 142, 176)
            }
        }

        val coastal = AmbientPaletteEngine.extractFromPixels(coastalPixels)
        val sakura = AmbientPaletteEngine.extractFromPixels(sakuraPixels)

        assertNotEquals(coastal.primary, sakura.primary)
        assertNotEquals(coastal.surfaceLightTint, sakura.surfaceLightTint)
    }

    @Test
    fun emptyOrExtremePixels_fallBackSafelyWithoutCrashing() {
        val empty = AmbientPaletteEngine.extractFromPixels(IntArray(0))
        val fallback = AmbientPaletteEngine.neutralFallbackPalette()
        assertEquals(fallback.primary, empty.primary)

        val pureBlack = IntArray(200) { makeArgb(0, 0, 0) }
        val blackResult = AmbientPaletteEngine.extractFromPixels(pureBlack)
        assertEquals(fallback.primary, blackResult.primary)

        val pureWhite = IntArray(200) { makeArgb(255, 255, 255) }
        val whiteResult = AmbientPaletteEngine.extractFromPixels(pureWhite)
        assertEquals(fallback.primary, whiteResult.primary)

        val deepNight = IntArray(200) { makeArgb(14, 18, 30) }
        val nightResult = AmbientPaletteEngine.extractFromPixels(deepNight)
        assertTrue(nightResult.isDarkArtwork)
        assertTrue(nightResult.primary.matches(Regex("^#[0-9A-F]{6}$")))
    }

    @Test
    fun redactSensitiveText_stripsGeminiAndOpenWeatherCredentials() {
        val leakedUrl =
            "https://api.openweathermap.org/data/2.5/weather?lat=10.1&lon=20.2&appid=owm_secret_987654&units=metric"
        val redactedUrl = AmbientPaletteEngine.redactSensitiveText(leakedUrl)
        assertFalse(redactedUrl.contains("owm_secret_987654"))
        assertTrue(redactedUrl.contains("appid=[REDACTED]"))

        val leakedHeader = "Request failed x-goog-api-key: AIzaSyDemoSecretKey1234567890ABCDEF from host"
        val redactedHeader = AmbientPaletteEngine.redactSensitiveText(leakedHeader)
        assertFalse(redactedHeader.contains("AIzaSyDemoSecretKey1234567890ABCDEF"))
        assertTrue(redactedHeader.contains("[REDACTED]"))
    }
}
