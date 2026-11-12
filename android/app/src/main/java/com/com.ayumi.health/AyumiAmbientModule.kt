/*
 * Native Android bridge exposing AI Ambient BYOK Keystore storage, HTTPS Gemini image/quote
 * requests, OpenWeatherMap current-weather/geocoding lookups, atomic local artwork caching,
 * OKLab MMCQ bitmap palette extraction, and low-privilege coarse location lookup.
 */

package com.ayumi.health

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.FileOutputStream
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class AyumiAmbientModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    private val ioExecutor = Executors.newCachedThreadPool()

    override fun getName(): String = "AyumiAmbient"

    private fun normalizeAlias(alias: String): String {
        return when (alias.trim()) {
            "gemini", "gemini_api_key" -> ALIAS_GEMINI
            "weather", "openweathermap", "openweather_api_key" -> ALIAS_OPENWEATHER
            else -> throw IllegalArgumentException("Unsupported secret alias: $alias")
        }
    }

    @ReactMethod
    fun setSecretKey(alias: String, plaintext: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val safeAlias = normalizeAlias(alias)
                SecureKeyStore.storeSecret(reactApplicationContext, safeAlias, plaintext)
                val map = Arguments.createMap()
                map.putBoolean("hasKey", true)
                map.putString("masked", SecureKeyStore.getMaskedSecret(reactApplicationContext, safeAlias))
                promise.resolve(map)
            } catch (ex: Exception) {
                promise.reject("KEYSTORE_WRITE_ERROR", AmbientPaletteEngine.redactSensitiveText(ex.message), ex)
            }
        }
    }

    @ReactMethod
    fun getAllKeyStatuses(promise: Promise) {
        ioExecutor.execute {
            try {
                val map = Arguments.createMap()
                val geminiMasked = SecureKeyStore.getMaskedSecret(reactApplicationContext, ALIAS_GEMINI)
                val weatherMasked = SecureKeyStore.getMaskedSecret(reactApplicationContext, ALIAS_OPENWEATHER)
                map.putBoolean("hasGeminiKey", geminiMasked.isNotEmpty())
                map.putString("geminiMasked", geminiMasked)
                map.putBoolean("hasWeatherKey", weatherMasked.isNotEmpty())
                map.putString("weatherMasked", weatherMasked)
                promise.resolve(map)
            } catch (ex: Exception) {
                promise.reject("KEYSTORE_READ_ERROR", AmbientPaletteEngine.redactSensitiveText(ex.message), ex)
            }
        }
    }

    @ReactMethod
    fun deleteSecretKey(alias: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val safeAlias = normalizeAlias(alias)
                SecureKeyStore.deleteSecret(reactApplicationContext, safeAlias)
                val map = Arguments.createMap()
                map.putBoolean("hasKey", false)
                map.putString("masked", "")
                promise.resolve(map)
            } catch (ex: Exception) {
                promise.reject("KEYSTORE_DELETE_ERROR", AmbientPaletteEngine.redactSensitiveText(ex.message), ex)
            }
        }
    }

    @ReactMethod
    fun validateGeminiKey(optionalOverrideKey: String?, promise: Promise) {
        ioExecutor.execute {
            try {
                val key = resolveCandidateKey(optionalOverrideKey, ALIAS_GEMINI)
                    ?: run {
                        promise.reject("NO_API_KEY", "Gemini API key is not configured.")
                        return@execute
                    }
                val endpoint = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1"
                val (code, body) = executeHttpsRequest(
                    urlString = endpoint,
                    method = "GET",
                    headers = mapOf("x-goog-api-key" to key),
                    jsonBody = null
                )
                if (code in 200..299) {
                    val result = Arguments.createMap()
                    result.putBoolean("valid", true)
                    result.putInt("statusCode", code)
                    promise.resolve(result)
                } else {
                    val errMsg = parseGoogleApiError(body, code)
                    promise.reject("GEMINI_KEY_INVALID", AmbientPaletteEngine.redactSensitiveText(errMsg))
                }
            } catch (ex: Exception) {
                promise.reject(
                    "GEMINI_KEY_CHECK_FAILED",
                    AmbientPaletteEngine.redactSensitiveText(ex.message ?: "Network error validating Gemini key")
                )
            }
        }
    }

    @ReactMethod
    fun validateWeatherKey(optionalOverrideKey: String?, cityOrTest: String?, promise: Promise) {
        ioExecutor.execute {
            try {
                val key = resolveCandidateKey(optionalOverrideKey, ALIAS_OPENWEATHER)
                    ?: run {
                        promise.reject("NO_API_KEY", "OpenWeatherMap API key is not configured.")
                        return@execute
                    }
                val encodedCity = URLEncoder.encode(
                    if (cityOrTest.isNullOrBlank()) "Tokyo" else cityOrTest.trim(),
                    StandardCharsets.UTF_8.name()
                )
                val endpoint =
                    "https://api.openweathermap.org/geo/1.0/direct?q=$encodedCity&limit=1&appid=${URLEncoder.encode(key, StandardCharsets.UTF_8.name())}"
                val (code, body) = executeHttpsRequest(
                    urlString = endpoint,
                    method = "GET",
                    headers = emptyMap(),
                    jsonBody = null
                )
                if (code in 200..299) {
                    val result = Arguments.createMap()
                    result.putBoolean("valid", true)
                    result.putInt("statusCode", code)
                    promise.resolve(result)
                } else {
                    val msg = parseOpenWeatherError(body, code)
                    promise.reject("WEATHER_KEY_INVALID", AmbientPaletteEngine.redactSensitiveText(msg))
                }
            } catch (ex: Exception) {
                promise.reject(
                    "WEATHER_KEY_CHECK_FAILED",
                    AmbientPaletteEngine.redactSensitiveText(ex.message ?: "Network error validating OpenWeatherMap key")
                )
            }
        }
    }

    @ReactMethod
    fun fetchCurrentWeather(
        hasCoords: Boolean,
        lat: Double,
        lon: Double,
        cityQuery: String?,
        promise: Promise
    ) {
        ioExecutor.execute {
            try {
                val key = SecureKeyStore.readSecret(reactApplicationContext, ALIAS_OPENWEATHER)
                    ?: run {
                        promise.reject("NO_WEATHER_KEY", "OpenWeatherMap API key is not configured.")
                        return@execute
                    }
                val encodedKey = URLEncoder.encode(key, StandardCharsets.UTF_8.name())

                var resolvedLat = lat
                var resolvedLon = lon
                var resolvedLocationLabel = ""

                if (!hasCoords) {
                    val query = cityQuery?.trim().orEmpty()
                    if (query.isEmpty()) {
                        promise.reject("NO_LOCATION", "Provide a manual city name or grant location permission.")
                        return@execute
                    }
                    val geoUrl =
                        "https://api.openweathermap.org/geo/1.0/direct?q=${URLEncoder.encode(query, StandardCharsets.UTF_8.name())}&limit=1&appid=$encodedKey"
                    val (geoCode, geoBody) = executeHttpsRequest(geoUrl, "GET", emptyMap(), null)
                    if (geoCode !in 200..299) {
                        promise.reject("GEOCODE_HTTP_ERROR", AmbientPaletteEngine.redactSensitiveText(parseOpenWeatherError(geoBody, geoCode)))
                        return@execute
                    }
                    val arr = JSONArray(geoBody)
                    if (arr.length() == 0) {
                        promise.reject("CITY_NOT_FOUND", "City not found. Check spelling or include country code.")
                        return@execute
                    }
                    val first = arr.getJSONObject(0)
                    resolvedLat = first.getDouble("lat")
                    resolvedLon = first.getDouble("lon")
                    val name = first.optString("name", query)
                    val country = first.optString("country", "")
                    resolvedLocationLabel = if (country.isNotEmpty()) "$name, $country" else name
                }

                val weatherUrl =
                    "https://api.openweathermap.org/data/2.5/weather?lat=$resolvedLat&lon=$resolvedLon&units=metric&appid=$encodedKey"
                val (code, body) = executeHttpsRequest(weatherUrl, "GET", emptyMap(), null)
                if (code !in 200..299) {
                    promise.reject("WEATHER_HTTP_ERROR", AmbientPaletteEngine.redactSensitiveText(parseOpenWeatherError(body, code)))
                    return@execute
                }

                val json = JSONObject(body)
                val mainObj = json.optJSONObject("main")
                val weatherArr = json.optJSONArray("weather")
                val weather0 = if (weatherArr != null && weatherArr.length() > 0) weatherArr.getJSONObject(0) else null
                val sysObj = json.optJSONObject("sys")

                val tempC = mainObj?.optDouble("temp", Double.NaN) ?: Double.NaN
                val conditionId = weather0?.optInt("id", 800) ?: 800
                val conditionMain = weather0?.optString("main", "Clear") ?: "Clear"
                val conditionDesc = weather0?.optString("description", "") ?: ""
                val iconCode = weather0?.optString("icon", "") ?: ""
                val dt = json.optLong("dt", System.currentTimeMillis() / 1000L)
                val sunrise = sysObj?.optLong("sunrise", 0L) ?: 0L
                val sunset = sysObj?.optLong("sunset", 0L) ?: 0L

                val isNightFromIcon = iconCode.endsWith("n")
                val isNightFromSun = sunrise > 0L && sunset > 0L && (dt < sunrise || dt > sunset)
                val isNight = if (iconCode.isNotEmpty()) isNightFromIcon else isNightFromSun

                val result = Arguments.createMap()
                if (!tempC.isNaN()) {
                    result.putDouble("temperatureC", tempC)
                }
                result.putInt("conditionId", conditionId)
                result.putString("conditionMain", conditionMain)
                result.putString("conditionDescription", conditionDesc)
                result.putString("iconCode", iconCode)
                result.putBoolean("isNight", isNight)
                result.putDouble("fetchedAtMs", System.currentTimeMillis().toDouble())
                result.putString("source", if (hasCoords) "gps" else "city")
                if (resolvedLocationLabel.isNotEmpty()) {
                    result.putString("cityLabel", resolvedLocationLabel)
                }
                promise.resolve(result)
            } catch (ex: Exception) {
                promise.reject(
                    "WEATHER_FETCH_FAILED",
                    AmbientPaletteEngine.redactSensitiveText(ex.message ?: "Failed fetching current weather")
                )
            }
        }
    }

    @ReactMethod
    fun generateQuote(prompt: String, modelCandidates: ReadableArray?, promise: Promise) {
        ioExecutor.execute {
            try {
                val key = SecureKeyStore.readSecret(reactApplicationContext, ALIAS_GEMINI)
                    ?: run {
                        promise.reject("NO_GEMINI_KEY", "Gemini API key is not configured.")
                        return@execute
                    }

                val models = resolveModelList(modelCandidates, DEFAULT_TEXT_MODELS)
                val payload = JSONObject().apply {
                    put("contents", JSONArray().apply {
                        put(JSONObject().apply {
                            put("parts", JSONArray().apply {
                                put(JSONObject().apply { put("text", prompt) })
                            })
                        })
                    })
                    put("generationConfig", JSONObject().apply {
                        put("temperature", 0.72)
                        put("maxOutputTokens", 48)
                    })
                }.toString()

                var lastErrorCode = 0
                var lastErrorMsg = "Unable to generate greeting quote."

                for (modelId in models) {
                    val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/$modelId:generateContent"
                    val (code, body) = executeHttpsRequest(
                        urlString = endpoint,
                        method = "POST",
                        headers = mapOf(
                            "x-goog-api-key" to key,
                            "Content-Type" to "application/json"
                        ),
                        jsonBody = payload
                    )
                    if (code in 200..299) {
                        val extracted = extractTextFromGeminiResponse(body)
                        if (!extracted.isNullOrBlank()) {
                            val result = Arguments.createMap()
                            result.putString("quote", extracted)
                            result.putString("modelUsed", modelId)
                            promise.resolve(result)
                            return@execute
                        }
                        lastErrorMsg = "Gemini returned an empty quote response."
                        break
                    }
                    lastErrorCode = code
                    lastErrorMsg = parseGoogleApiError(body, code)
                    // Retry next candidate only if model ID is unavailable on this account.
                    if (code != 404 && code != 400) break
                }

                promise.reject(
                    "GEMINI_QUOTE_ERROR_$lastErrorCode",
                    AmbientPaletteEngine.redactSensitiveText(lastErrorMsg)
                )
            } catch (ex: Exception) {
                promise.reject(
                    "GEMINI_QUOTE_FAILED",
                    AmbientPaletteEngine.redactSensitiveText(ex.message ?: "Quote generation failed")
                )
            }
        }
    }

    @ReactMethod
    fun generateArtwork(
        prompt: String,
        aspectRatio: String,
        imageSize: String,
        modelCandidates: ReadableArray?,
        promise: Promise
    ) {
        ioExecutor.execute {
            try {
                val key = SecureKeyStore.readSecret(reactApplicationContext, ALIAS_GEMINI)
                    ?: run {
                        promise.reject("NO_GEMINI_KEY", "Gemini API key is not configured.")
                        return@execute
                    }

                val models = resolveModelList(modelCandidates, DEFAULT_IMAGE_MODELS)
                var lastErrorCode = 0
                var lastErrorMsg = "Unable to generate ambient artwork."

                for (modelId in models) {
                    val includeSize = !modelId.contains("2.5-flash-image")
                    val imageConfig = JSONObject().apply {
                        put("aspectRatio", aspectRatio.ifBlank { "9:16" })
                        if (includeSize && imageSize.isNotBlank()) {
                            put("imageSize", imageSize)
                        }
                    }
                    val payload = JSONObject().apply {
                        put("contents", JSONArray().apply {
                            put(JSONObject().apply {
                                put("parts", JSONArray().apply {
                                    put(JSONObject().apply { put("text", prompt) })
                                })
                            })
                        })
                        put("generationConfig", JSONObject().apply {
                            put("responseModalities", JSONArray().apply { put("IMAGE") })
                            put("imageConfig", imageConfig)
                        })
                    }.toString()

                    val endpoint = "https://generativelanguage.googleapis.com/v1beta/models/$modelId:generateContent"
                    val (code, body) = executeHttpsRequest(
                        urlString = endpoint,
                        method = "POST",
                        headers = mapOf(
                            "x-goog-api-key" to key,
                            "Content-Type" to "application/json"
                        ),
                        jsonBody = payload,
                        readTimeoutMs = 90_000
                    )

                    if (code in 200..299) {
                        val imageData = extractImageFromGeminiResponse(body)
                        if (imageData == null) {
                            lastErrorMsg = "Gemini returned text instead of generated artwork."
                            continue
                        }
                        val decodedBytes = Base64.decode(imageData.base64, Base64.DEFAULT)
                        val cached = saveValidatedArtworkAndExtractPalette(
                            imageBytes = decodedBytes,
                            modelUsed = modelId
                        )
                        promise.resolve(cached)
                        return@execute
                    }

                    lastErrorCode = code
                    lastErrorMsg = parseGoogleApiError(body, code)
                    if (code != 404 && code != 400) break
                }

                promise.reject(
                    "GEMINI_IMAGE_ERROR_$lastErrorCode",
                    AmbientPaletteEngine.redactSensitiveText(lastErrorMsg)
                )
            } catch (ex: Exception) {
                promise.reject(
                    "GEMINI_IMAGE_FAILED",
                    AmbientPaletteEngine.redactSensitiveText(ex.message ?: "Artwork generation failed")
                )
            }
        }
    }

    @ReactMethod
    fun extractPaletteFromFile(pathOrUri: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = resolveLocalArtFile(pathOrUri)
                if (file == null || !file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Cached ambient artwork file does not exist.")
                    return@execute
                }
                val bitmap = decodeScaledBitmapFromFile(file, maxDimension = 256)
                    ?: run {
                        promise.reject("DECODE_ERROR", "Cached artwork file could not be decoded.")
                        return@execute
                    }
                try {
                    val palette = extractPaletteFromBitmap(bitmap)
                    promise.resolve(paletteToWritableMap(palette))
                } finally {
                    bitmap.recycle()
                }
            } catch (ex: Exception) {
                promise.reject("PALETTE_ERROR", ex.message ?: "Failed extracting artwork palette.")
            }
        }
    }

    @ReactMethod
    fun verifyCachedArtwork(pathOrUri: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = resolveLocalArtFile(pathOrUri)
                if (file == null || !file.exists() || file.length() <= 0L) {
                    promise.resolve(null)
                    return@execute
                }
                val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(file.absolutePath, opts)
                if (opts.outWidth <= 0 || opts.outHeight <= 0) {
                    promise.resolve(null)
                    return@execute
                }
                val map = Arguments.createMap()
                map.putString("path", file.absolutePath)
                map.putString("uri", "file://${file.absolutePath}")
                map.putInt("width", opts.outWidth)
                map.putInt("height", opts.outHeight)
                promise.resolve(map)
            } catch (ex: Exception) {
                promise.resolve(null)
            }
        }
    }

    @ReactMethod
    fun getApproximateLocation(promise: Promise) {
        val hasCoarse = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasFine = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasCoarse && !hasFine) {
            promise.reject("PERMISSION_DENIED", "Approximate location permission was not granted.")
            return
        }

        val lm = reactApplicationContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (lm == null) {
            promise.reject("LOCATION_UNAVAILABLE", "Android LocationManager is unavailable.")
            return
        }

        try {
            val providers = listOfNotNull(
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) LocationManager.FUSED_PROVIDER else null,
                LocationManager.NETWORK_PROVIDER,
                LocationManager.PASSIVE_PROVIDER,
                LocationManager.GPS_PROVIDER
            )

            val nowMs = System.currentTimeMillis()
            var freshest: Location? = null
            for (provider in providers) {
                if (!runCatching { lm.isProviderEnabled(provider) }.getOrDefault(false)) continue
                @Suppress("MissingPermission")
                val candidate = runCatching { lm.getLastKnownLocation(provider) }.getOrNull() ?: continue
                if (freshest == null || candidate.time > freshest.time) {
                    freshest = candidate
                }
            }

            // Accept recent cached coarse fix (< 3 hours) immediately without draining battery.
            if (freshest != null && (nowMs - freshest.time) < 3 * 60 * 60 * 1000L) {
                resolveLocationPromise(promise, freshest)
                return
            }

            val activeProvider = providers.firstOrNull { provider ->
                provider != LocationManager.PASSIVE_PROVIDER &&
                    runCatching { lm.isProviderEnabled(provider) }.getOrDefault(false)
            }
            if (activeProvider == null) {
                if (freshest != null) {
                    resolveLocationPromise(promise, freshest)
                } else {
                    promise.reject("LOCATION_DISABLED", "Device location providers are disabled.")
                }
                return
            }

            val settled = AtomicBoolean(false)
            val mainHandler = Handler(Looper.getMainLooper())
            val cancelSignal = CancellationSignal()

            mainHandler.postDelayed({
                if (settled.compareAndSet(false, true)) {
                    cancelSignal.cancel()
                    if (freshest != null) {
                        resolveLocationPromise(promise, freshest)
                    } else {
                        promise.reject("LOCATION_TIMEOUT", "Timed out waiting for coarse location fix.")
                    }
                }
            }, 7500L)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                @Suppress("MissingPermission")
                lm.getCurrentLocation(
                    activeProvider,
                    cancelSignal,
                    ContextCompat.getMainExecutor(reactApplicationContext)
                ) { location ->
                    if (settled.compareAndSet(false, true)) {
                        if (location != null) {
                            resolveLocationPromise(promise, location)
                        } else if (freshest != null) {
                            resolveLocationPromise(promise, freshest)
                        } else {
                            promise.reject("LOCATION_UNAVAILABLE", "No approximate location available.")
                        }
                    }
                }
            } else {
                @Suppress("DEPRECATION", "MissingPermission")
                lm.requestSingleUpdate(
                    activeProvider,
                    object : LocationListener {
                        override fun onLocationChanged(location: Location) {
                            if (settled.compareAndSet(false, true)) {
                                resolveLocationPromise(promise, location)
                            }
                        }

                        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                        override fun onProviderEnabled(provider: String) {}
                        override fun onProviderDisabled(provider: String) {}
                    },
                    Looper.getMainLooper()
                )
            }
        } catch (ex: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Location permission denied by system.")
        } catch (ex: Exception) {
            promise.reject("LOCATION_ERROR", ex.message ?: "Failed reading device location.")
        }
    }

    private fun resolveLocationPromise(promise: Promise, location: Location) {
        val map = Arguments.createMap()
        map.putDouble("lat", location.latitude)
        map.putDouble("lon", location.longitude)
        map.putDouble("timestampMs", location.time.toDouble())
        promise.resolve(map)
    }

    private fun resolveCandidateKey(overrideKey: String?, alias: String): String? {
        val trimmed = overrideKey?.trim().orEmpty()
        if (trimmed.isNotEmpty()) return trimmed
        return SecureKeyStore.readSecret(reactApplicationContext, alias)
    }

    private fun resolveModelList(input: ReadableArray?, defaults: List<String>): List<String> {
        if (input == null || input.size() == 0) return defaults
        val out = ArrayList<String>(input.size())
        for (i in 0 until input.size()) {
            val item = input.getString(i)?.trim().orEmpty()
            if (item.isNotEmpty()) out.add(item)
        }
        return if (out.isEmpty()) defaults else out
    }

    private fun saveValidatedArtworkAndExtractPalette(
        imageBytes: ByteArray,
        modelUsed: String
    ): WritableMap {
        val decodedRaw = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            ?: throw IllegalStateException("Generated payload is not a valid image.")

        val finalBitmap = scaleBitmapToMaxEdge(decodedRaw, maxHeight = 1920, maxWidth = 1080)
        if (finalBitmap !== decodedRaw) {
            decodedRaw.recycle()
        }

        val dir = File(reactApplicationContext.filesDir, "ambient_art")
        if (!dir.exists() && !dir.mkdirs()) {
            finalBitmap.recycle()
            throw IllegalStateException("Unable to create artwork cache directory.")
        }

        val timestamp = System.currentTimeMillis()
        val tmpFile = File(dir, "art_${timestamp}.tmp")
        val targetFile = File(dir, "art_${timestamp}.jpg")

        try {
            FileOutputStream(tmpFile).use { out ->
                val ok = finalBitmap.compress(Bitmap.CompressFormat.JPEG, 92, out)
                if (!ok) throw IllegalStateException("Failed encoding ambient artwork JPEG.")
                out.flush()
            }
            if (!tmpFile.renameTo(targetFile)) {
                tmpFile.copyTo(targetFile, overwrite = true)
                tmpFile.delete()
            }

            // Retain the 2 newest artwork files so dual-layer GPU crossfades never lose the outgoing layer mid-transition.
            val staleFiles = dir.listFiles { file ->
                file.isFile && (file.name.endsWith(".jpg") || file.name.endsWith(".png"))
            }?.sortedByDescending { it.lastModified() } ?: emptyList()
            for (index in 2 until staleFiles.size) {
                staleFiles[index].delete()
            }

            val extractedPalette = extractPaletteFromBitmap(finalBitmap)
            val result = Arguments.createMap()
            result.putString("path", targetFile.absolutePath)
            result.putString("uri", "file://${targetFile.absolutePath}")
            result.putInt("width", finalBitmap.width)
            result.putInt("height", finalBitmap.height)
            result.putDouble("generatedAtMs", timestamp.toDouble())
            result.putString("modelUsed", modelUsed)
            result.putMap("palette", paletteToWritableMap(extractedPalette))
            return result
        } finally {
            finalBitmap.recycle()
        }
    }

    private fun scaleBitmapToMaxEdge(bitmap: Bitmap, maxWidth: Int, maxHeight: Int): Bitmap {
        val w = bitmap.width
        val h = bitmap.height
        if (w <= maxWidth && h <= maxHeight) return bitmap
        val ratio = minOf(maxWidth.toFloat() / w.toFloat(), maxHeight.toFloat() / h.toFloat())
        val targetW = maxOf(1, (w * ratio).toInt())
        val targetH = maxOf(1, (h * ratio).toInt())
        return Bitmap.createScaledBitmap(bitmap, targetW, targetH, true)
    }

    private fun decodeScaledBitmapFromFile(file: File, maxDimension: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        val longest = maxOf(bounds.outWidth, bounds.outHeight)
        if (longest <= 0) return null
        var sample = 1
        while (longest / sample > maxDimension * 2) {
            sample *= 2
        }
        val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sample }
        return BitmapFactory.decodeFile(file.absolutePath, decodeOpts)
    }

    private fun extractPaletteFromBitmap(bitmap: Bitmap): AmbientBitmapPalette {
        val targetW = 96
        val targetH = maxOf(96, (96f * bitmap.height / maxOf(1, bitmap.width)).toInt().coerceAtMost(144))
        val scaled = Bitmap.createScaledBitmap(bitmap, targetW, targetH, true)
        return try {
            val pixels = IntArray(targetW * targetH)
            scaled.getPixels(pixels, 0, targetW, 0, 0, targetW, targetH)
            AmbientPaletteEngine.extractFromPixels(pixels)
        } finally {
            if (scaled !== bitmap) scaled.recycle()
        }
    }

    private fun paletteToWritableMap(palette: AmbientBitmapPalette): WritableMap {
        val map = Arguments.createMap()
        map.putString("dominant", palette.dominant)
        map.putString("primary", palette.primary)
        map.putString("secondary", palette.secondary)
        map.putString("tertiary", palette.tertiary)
        map.putString("highlight", palette.highlight)
        map.putString("shadowDark", palette.shadowDark)
        map.putString("surfaceLightTint", palette.surfaceLightTint)
        map.putString("surfaceDarkTint", palette.surfaceDarkTint)
        map.putBoolean("isDarkArtwork", palette.isDarkArtwork)
        val swatchesArr: WritableArray = Arguments.createArray()
        for (swatch in palette.swatches) {
            swatchesArr.pushString(swatch.hex)
        }
        map.putArray("swatches", swatchesArr)
        return map
    }

    private fun resolveLocalArtFile(pathOrUri: String): File? {
        val clean = pathOrUri.removePrefix("file://").trim()
        if (clean.isEmpty()) return null
        val file = File(clean)
        val artDir = File(reactApplicationContext.filesDir, "ambient_art").canonicalPath
        val targetCanonical = runCatching { file.canonicalPath }.getOrNull() ?: return null
        if (!targetCanonical.startsWith(artDir)) return null
        return file
    }

    private data class InlineImagePayload(val mimeType: String, val base64: String)

    private fun extractImageFromGeminiResponse(rawJson: String): InlineImagePayload? {
        val root = JSONObject(rawJson)
        val candidates = root.optJSONArray("candidates") ?: return null
        for (c in 0 until candidates.length()) {
            val candidate = candidates.optJSONObject(c) ?: continue
            val content = candidate.optJSONObject("content") ?: continue
            val parts = content.optJSONArray("parts") ?: continue
            for (p in 0 until parts.length()) {
                val part = parts.optJSONObject(p) ?: continue
                val inline = part.optJSONObject("inlineData") ?: part.optJSONObject("inline_data")
                if (inline != null) {
                    val data = inline.optString("data", "")
                    val mime = inline.optString("mimeType", inline.optString("mime_type", "image/png"))
                    if (data.isNotEmpty()) {
                        return InlineImagePayload(mime, data)
                    }
                }
            }
        }
        return null
    }

    private fun extractTextFromGeminiResponse(rawJson: String): String? {
        val root = JSONObject(rawJson)
        val candidates = root.optJSONArray("candidates") ?: return null
        for (c in 0 until candidates.length()) {
            val candidate = candidates.optJSONObject(c) ?: continue
            val content = candidate.optJSONObject("content") ?: continue
            val parts = content.optJSONArray("parts") ?: continue
            for (p in 0 until parts.length()) {
                val part = parts.optJSONObject(p) ?: continue
                val text = part.optString("text", "").trim()
                if (text.isNotEmpty()) {
                    return sanitizeQuoteText(text)
                }
            }
        }
        return null
    }

    private fun sanitizeQuoteText(raw: String): String {
        val singleLine = raw
            .replace(Regex("[\\r\\n]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
            .trim('"', '\'', '“', '”', '‘', '’')
        val withoutAuthor = singleLine.replace(Regex("\\s*[—–-]\\s*[A-Za-z .]{2,}$"), "").trim()
        return if (withoutAuthor.length > 76) {
            withoutAuthor.take(73).trimEnd() + "..."
        } else {
            withoutAuthor
        }
    }

    private fun parseGoogleApiError(body: String, httpCode: Int): String {
        val parsed = runCatching {
            JSONObject(body).optJSONObject("error")?.optString("message", "")
        }.getOrNull().orEmpty()
        return if (parsed.isNotEmpty()) "Gemini API ($httpCode): $parsed" else "Gemini API returned HTTP $httpCode"
    }

    private fun parseOpenWeatherError(body: String, httpCode: Int): String {
        val parsed = runCatching {
            JSONObject(body).optString("message", "")
        }.getOrNull().orEmpty()
        return if (parsed.isNotEmpty()) "OpenWeatherMap ($httpCode): $parsed" else "OpenWeatherMap returned HTTP $httpCode"
    }

    private fun executeHttpsRequest(
        urlString: String,
        method: String,
        headers: Map<String, String>,
        jsonBody: String?,
        readTimeoutMs: Int = 25_000
    ): Pair<Int, String> {
        val url = URL(urlString)
        require(url.protocol.equals("https", ignoreCase = true)) {
            "Non-HTTPS endpoints are prohibited for AI Ambient API calls."
        }
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = readTimeoutMs
            doInput = true
            useCaches = false
            for ((k, v) in headers) {
                setRequestProperty(k, v)
            }
            if (jsonBody != null) {
                doOutput = true
            }
        }

        return try {
            if (jsonBody != null) {
                conn.outputStream.use { os ->
                    os.write(jsonBody.toByteArray(StandardCharsets.UTF_8))
                }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val responseText = if (stream != null) {
                BufferedReader(InputStreamReader(stream, StandardCharsets.UTF_8)).use { it.readText() }
            } else {
                ""
            }
            code to responseText
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        private const val TAG = "AyumiAmbientModule"
        private const val ALIAS_GEMINI = "gemini"
        private const val ALIAS_OPENWEATHER = "openweathermap"
        private val DEFAULT_IMAGE_MODELS = listOf("gemini-3.1-flash-image-preview", "gemini-2.5-flash-image")
        private val DEFAULT_TEXT_MODELS = listOf("gemini-2.5-flash-lite", "gemini-2.5-flash")
    }
}

