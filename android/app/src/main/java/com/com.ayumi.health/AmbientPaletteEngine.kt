/*
 * Pure-Kotlin perceptual OKLab/OKLCH palette extractor (MMCQ quantization, diversity filtering,
 * and WCAG contrast harmonization) plus secret redaction helpers for AI Ambient theme artwork.
 * Kept free of Android framework dependencies so every quantization and redaction invariant
 * runs directly under standard JVM unit tests.
 */

package com.ayumi.health

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cbrt
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

data class OklabColor(
    val l: Double,
    val a: Double,
    val b: Double
)

data class OklchColor(
    val l: Double,
    val c: Double,
    val h: Double
)

data class ExtractedSwatch(
    val hex: String,
    val population: Int,
    val oklab: OklabColor,
    val oklch: OklchColor
)

data class AmbientBitmapPalette(
    val dominant: String,
    val primary: String,
    val secondary: String,
    val tertiary: String,
    val highlight: String,
    val shadowDark: String,
    val surfaceLightTint: String,
    val surfaceDarkTint: String,
    val swatches: List<ExtractedSwatch>,
    val isDarkArtwork: Boolean
)

private data class QuantBucket(
    val samples: List<PixelOklabSample>
) {
    val totalWeight: Double = samples.sumOf { it.weight }
    val totalCount: Int = samples.size

    fun axisSpread(): Pair<Int, Double> {
        var minL = 1.0
        var maxL = 0.0
        var minA = 1.0
        var maxA = -1.0
        var minB = 1.0
        var maxB = -1.0
        for (sample in samples) {
            if (sample.l < minL) minL = sample.l
            if (sample.l > maxL) maxL = sample.l
            if (sample.a < minA) minA = sample.a
            if (sample.a > maxA) maxA = sample.a
            if (sample.b < minB) minB = sample.b
            if (sample.b > maxB) maxB = sample.b
        }
        val spreadL = maxL - minL
        val spreadA = (maxA - minA) * 1.45
        val spreadB = (maxB - minB) * 1.45
        return when {
            spreadA >= spreadL && spreadA >= spreadB -> 1 to spreadA
            spreadB >= spreadL && spreadB >= spreadA -> 2 to spreadB
            else -> 0 to spreadL
        }
    }

    fun split(): Pair<QuantBucket, QuantBucket>? {
        if (samples.size < 2) return null
        val (axis, _) = axisSpread()
        val sorted = when (axis) {
            0 -> samples.sortedBy { it.l }
            1 -> samples.sortedBy { it.a }
            else -> samples.sortedBy { it.b }
        }
        val halfWeight = totalWeight * 0.5
        var running = 0.0
        var splitIdx = 1
        for (i in 0 until sorted.size - 1) {
            running += sorted[i].weight
            splitIdx = i + 1
            if (running >= halfWeight) break
        }
        return QuantBucket(sorted.subList(0, splitIdx)) to
            QuantBucket(sorted.subList(splitIdx, sorted.size))
    }

    fun meanSwatch(): ExtractedSwatch {
        var sumL = 0.0
        var sumA = 0.0
        var sumB = 0.0
        var weightTotal = 0.0
        for (sample in samples) {
            val w = sample.weight
            sumL += sample.l * w
            sumA += sample.a * w
            sumB += sample.b * w
            weightTotal += w
        }
        val safeW = max(weightTotal, 1e-6)
        val lab = OklabColor(sumL / safeW, sumA / safeW, sumB / safeW)
        val lch = AmbientPaletteEngine.oklabToOklch(lab)
        val hex = AmbientPaletteEngine.oklchToHex(lch)
        return ExtractedSwatch(
            hex = hex,
            population = totalCount,
            oklab = lab,
            oklch = lch
        )
    }
}

private data class PixelOklabSample(
    val l: Double,
    val a: Double,
    val b: Double,
    val chroma: Double,
    val weight: Double
)

object AmbientPaletteEngine {

    private fun srgbToLinear(channel255: Int): Double {
        val c = channel255.coerceIn(0, 255) / 255.0
        return if (c <= 0.04045) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
    }

    private fun linearToSrgb255(linear: Double): Int {
        val clamped = linear.coerceIn(0.0, 1.0)
        val srgb = if (clamped <= 0.0031308) {
            12.92 * clamped
        } else {
            1.055 * clamped.pow(1.0 / 2.4) - 0.055
        }
        return (srgb * 255.0).roundToInt().coerceIn(0, 255)
    }

    fun argbToOklab(argb: Int): OklabColor {
        val r = srgbToLinear((argb ushr 16) and 0xFF)
        val g = srgbToLinear((argb ushr 8) and 0xFF)
        val b = srgbToLinear(argb and 0xFF)

        val l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        val m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        val s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

        return OklabColor(
            l = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
        )
    }

    fun oklabToOklch(lab: OklabColor): OklchColor {
        val c = hypot(lab.a, lab.b)
        val h = if (c < 1e-6) 0.0 else ((atan2(lab.b, lab.a) * 180.0 / PI) + 360.0) % 360.0
        return OklchColor(lab.l, c, h)
    }

    private fun oklchToLinearRgb(l: Double, c: Double, hDeg: Double): Triple<Double, Double, Double> {
        val rad = hDeg * PI / 180.0
        val a = c * cos(rad)
        val bLab = c * sin(rad)

        val l_ = l + 0.3963377774 * a + 0.2158037573 * bLab
        val m_ = l - 0.1055613458 * a - 0.0638541728 * bLab
        val s_ = l - 0.0894841775 * a - 1.2914855480 * bLab

        val lCube = l_ * l_ * l_
        val mCube = m_ * m_ * m_
        val sCube = s_ * s_ * s_

        return Triple(
            +4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube,
            -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube,
            -0.0041960863 * lCube - 0.7034186147 * mCube + 1.7076147010 * sCube
        )
    }

    private fun isInSrgbGamut(rgb: Triple<Double, Double, Double>): Boolean {
        val eps = 1e-4
        return rgb.first >= -eps && rgb.first <= 1.0 + eps &&
            rgb.second >= -eps && rgb.second <= 1.0 + eps &&
            rgb.third >= -eps && rgb.third <= 1.0 + eps
    }

    fun oklchToHex(lch: OklchColor): String {
        val clampedL = lch.l.coerceIn(0.0, 1.0)
        val clampedC = max(0.0, lch.c)
        val normH = ((lch.h % 360.0) + 360.0) % 360.0

        var rgb = oklchToLinearRgb(clampedL, clampedC, normH)
        if (!isInSrgbGamut(rgb) && clampedC > 0.0) {
            var low = 0.0
            var high = clampedC
            repeat(12) {
                val mid = (low + high) * 0.5
                if (isInSrgbGamut(oklchToLinearRgb(clampedL, mid, normH))) {
                    low = mid
                } else {
                    high = mid
                }
            }
            rgb = oklchToLinearRgb(clampedL, low, normH)
        }

        val r = linearToSrgb255(rgb.first)
        val g = linearToSrgb255(rgb.second)
        val b = linearToSrgb255(rgb.third)
        return String.format("#%02X%02X%02X", r, g, b)
    }

    fun oklabDistance(a: OklabColor, b: OklabColor): Double {
        val dl = a.l - b.l
        val da = a.a - b.a
        val db = a.b - b.b
        return sqrt(dl * dl + da * da + db * db)
    }

    fun relativeLuminance(hex: String): Double {
        val clean = hex.removePrefix("#")
        if (clean.length != 6) return 0.5
        val r = srgbToLinear(clean.substring(0, 2).toInt(16))
        val g = srgbToLinear(clean.substring(2, 4).toInt(16))
        val b = srgbToLinear(clean.substring(4, 6).toInt(16))
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    fun contrastRatio(hexA: String, hexB: String): Double {
        val lumA = relativeLuminance(hexA)
        val lumB = relativeLuminance(hexB)
        val lighter = max(lumA, lumB)
        val darker = min(lumA, lumB)
        return (lighter + 0.05) / (darker + 0.05)
    }

    /**
     * Quantizes sampled ARGB pixels in perceptual OKLab space using MMCQ (weighted by pixel
     * chroma so focal anime accents survive wide sky backgrounds), then selects harmonious,
     * well-separated Light/Dark UI tint & accent roles.
     */
    fun extractFromPixels(pixels: IntArray, targetBuckets: Int = 14): AmbientBitmapPalette {
        if (pixels.isEmpty()) {
            return neutralFallbackPalette()
        }

        val samples = ArrayList<PixelOklabSample>(pixels.size)
        var lumaSum = 0.0
        var count = 0
        for (pixel in pixels) {
            val alpha = (pixel ushr 24) and 0xFF
            if (alpha < 128) continue
            val lab = argbToOklab(pixel)
            lumaSum += lab.l
            count += 1
            // Filter near-pure black/white noise while preserving rich midtones and highlights.
            if (lab.l < 0.09 || lab.l > 0.96) continue
            val chroma = hypot(lab.a, lab.b)
            // Weight saturated regions moderately higher so blossoms, lights, and sunbeams survive.
            val weight = 1.0 + min(2.4, chroma * 14.0)
            samples.add(PixelOklabSample(lab.l, lab.a, lab.b, chroma, weight))
        }

        if (samples.isEmpty()) {
            return neutralFallbackPalette()
        }

        val meanArtworkL = lumaSum / max(count, 1)
        val isDarkArtwork = meanArtworkL < 0.46

        val buckets = ArrayList<QuantBucket>(targetBuckets)
        buckets.add(QuantBucket(samples))

        while (buckets.size < targetBuckets) {
            var bestIdx = -1
            var bestScore = -1.0
            for (i in buckets.indices) {
                val bucket = buckets[i]
                if (bucket.samples.size < 8) continue
                val (_, spread) = bucket.axisSpread()
                val score = spread * sqrt(bucket.totalWeight)
                if (score > bestScore) {
                    bestScore = score
                    bestIdx = i
                }
            }
            if (bestIdx < 0 || bestScore <= 1e-4) break
            val chosen = buckets.removeAt(bestIdx)
            val pair = chosen.split()
            if (pair == null) {
                buckets.add(chosen)
                break
            }
            buckets.add(pair.first)
            buckets.add(pair.second)
        }

        val rawSwatches = buckets
            .map { it.meanSwatch() }
            .sortedByDescending { swatch ->
                swatch.population * (0.45 + min(1.5, swatch.oklch.c * 9.0))
            }

        if (rawSwatches.isEmpty()) {
            return neutralFallbackPalette()
        }

        val dominant = rawSwatches.maxByOrNull { it.population } ?: rawSwatches.first()

        // Primary vivid accent: favors saturated colors with readable UI lightness window.
        val chromaticSorted = rawSwatches.sortedByDescending { swatch ->
            val lBonus = if (swatch.oklch.l in 0.36..0.78) 1.25 else 0.72
            swatch.oklch.c * lBonus * sqrt(swatch.population.toDouble())
        }
        val primaryRaw = chromaticSorted.firstOrNull { it.oklch.c >= 0.035 } ?: dominant
        val primary = tuneAccentForUi(primaryRaw.oklch, targetL = 0.56, minC = 0.11, maxC = 0.23)

        // Secondary accent: perceptually distinct from primary (OKLab deltaE >= 0.13).
        val secondarySwatch = chromaticSorted.firstOrNull { candidate ->
            candidate != primaryRaw &&
                oklabDistance(candidate.oklab, primaryRaw.oklab) >= 0.13 &&
                candidate.oklch.c >= 0.03
        }
        val secondary = if (secondarySwatch != null) {
            tuneAccentForUi(secondarySwatch.oklch, targetL = 0.62, minC = 0.10, maxC = 0.21)
        } else {
            // Harmonious analogous-warm/cool shift when artwork is monochromatic (e.g. blue twilight).
            val shiftedH = (primaryRaw.oklch.h + 44.0) % 360.0
            oklchToHex(OklchColor(0.62, max(0.11, primaryRaw.oklch.c), shiftedH))
        }

        // Tertiary accent: another distinct chromatic cluster or triadic complement.
        val tertiarySwatch = chromaticSorted.firstOrNull { candidate ->
            candidate != primaryRaw &&
                candidate != secondarySwatch &&
                oklabDistance(candidate.oklab, primaryRaw.oklab) >= 0.16 &&
                (secondarySwatch == null || oklabDistance(candidate.oklab, secondarySwatch.oklab) >= 0.12) &&
                candidate.oklch.c >= 0.03
        }
        val tertiary = if (tertiarySwatch != null) {
            tuneAccentForUi(tertiarySwatch.oklch, targetL = 0.60, minC = 0.10, maxC = 0.20)
        } else {
            val shiftedH = (primaryRaw.oklch.h + 210.0) % 360.0
            oklchToHex(OklchColor(0.60, max(0.10, primaryRaw.oklch.c * 0.85), shiftedH))
        }

        // Luminous warm/bright highlight for progress gradient peaks and glow layers.
        val brightSwatch = rawSwatches
            .filter { it.oklch.l >= 0.64 }
            .maxByOrNull { it.oklch.c * 3.0 + it.oklch.l }
            ?: primaryRaw
        val highlight = oklchToHex(
            OklchColor(
                l = brightSwatch.oklch.l.coerceIn(0.70, 0.84),
                c = brightSwatch.oklch.c.coerceIn(0.08, 0.18),
                h = brightSwatch.oklch.h
            )
        )

        // Deep shadow ink derived from darkest chromatic cluster for high-contrast light-mode ink & scrims.
        val darkSwatch = rawSwatches.minByOrNull { it.oklch.l } ?: dominant
        val shadowDark = oklchToHex(
            OklchColor(
                l = 0.20,
                c = min(0.045, darkSwatch.oklch.c),
                h = primaryRaw.oklch.h
            )
        )

        val surfaceLightTint = oklchToHex(
            OklchColor(
                l = 0.96,
                c = min(0.024, primaryRaw.oklch.c * 0.28),
                h = primaryRaw.oklch.h
            )
        )
        val surfaceDarkTint = oklchToHex(
            OklchColor(
                l = 0.18,
                c = min(0.032, primaryRaw.oklch.c * 0.34),
                h = primaryRaw.oklch.h
            )
        )

        return AmbientBitmapPalette(
            dominant = dominant.hex,
            primary = primary,
            secondary = secondary,
            tertiary = tertiary,
            highlight = highlight,
            shadowDark = shadowDark,
            surfaceLightTint = surfaceLightTint,
            surfaceDarkTint = surfaceDarkTint,
            swatches = rawSwatches.take(8),
            isDarkArtwork = isDarkArtwork
        )
    }

    private fun tuneAccentForUi(
        source: OklchColor,
        targetL: Double,
        minC: Double,
        maxC: Double
    ): String {
        val chroma = if (source.c < 0.015) 0.0 else source.c.coerceIn(minC, maxC)
        val lightness = source.l.coerceIn(targetL - 0.08, targetL + 0.08)
        return oklchToHex(OklchColor(lightness, chroma, source.h))
    }

    fun neutralFallbackPalette(): AmbientBitmapPalette = AmbientBitmapPalette(
        dominant = "#4F7896",
        primary = "#3D7399",
        secondary = "#5A8E8C",
        tertiary = "#B87C5C",
        highlight = "#8DBAD6",
        shadowDark = "#1C2936",
        surfaceLightTint = "#F2F6FA",
        surfaceDarkTint = "#19222C",
        swatches = emptyList(),
        isDarkArtwork = false
    )

    /**
     * Strips API keys and sensitive query/header values from diagnostic text or URLs so secrets
     * can never reach Android logs, Snackbar banners, or persisted error diagnostics.
     */
    fun redactSensitiveText(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        return raw
            .replace(Regex("([?&](?:key|appid)=)[^&\\s]+", RegexOption.IGNORE_CASE), "$1[REDACTED]")
            .replace(Regex("(x-goog-api-key\\s*[:=]\\s*)[^,\\s;]+", RegexOption.IGNORE_CASE), "$1[REDACTED]")
            .replace(Regex("AIza[0-9A-Za-z_-]{16,}"), "[REDACTED_GEMINI_KEY]")
    }
}

