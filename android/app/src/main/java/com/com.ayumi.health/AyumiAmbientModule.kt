/*
 * Native Android bridge exposing Keystore-encrypted OpenWeatherMap storage,
 * HTTPS OpenWeatherMap current-weather/geocoding lookups, free DummyJSON daily quote
 * fetching, and low-privilege coarse location resolution for Ambient Scenery.
 */

package com.ayumi.health

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
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
                promise.reject("KEYSTORE_WRITE_ERROR", redactSensitiveText(ex.message), ex)
            }
        }
    }

    @ReactMethod
    fun getAllKeyStatuses(promise: Promise) {
        ioExecutor.execute {
            try {
                val map = Arguments.createMap()
                val weatherMasked = SecureKeyStore.getMaskedSecret(reactApplicationContext, ALIAS_OPENWEATHER)
                map.putBoolean("hasWeatherKey", weatherMasked.isNotEmpty())
                map.putString("weatherMasked", weatherMasked)
                promise.resolve(map)
            } catch (ex: Exception) {
                promise.reject("KEYSTORE_READ_ERROR", redactSensitiveText(ex.message), ex)
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
                promise.reject("KEYSTORE_DELETE_ERROR", redactSensitiveText(ex.message), ex)
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
                val (code, body) = executeHttpsRequest(endpoint)
                if (code in 200..299) {
                    val result = Arguments.createMap()
                    result.putBoolean("valid", true)
                    result.putInt("statusCode", code)
                    promise.resolve(result)
                } else {
                    val msg = parseOpenWeatherError(body, code)
                    promise.reject("WEATHER_KEY_INVALID", redactSensitiveText(msg))
                }
            } catch (ex: Exception) {
                promise.reject(
                    "WEATHER_KEY_CHECK_FAILED",
                    redactSensitiveText(ex.message ?: "Network error validating OpenWeatherMap key")
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
                    val (geoCode, geoBody) = executeHttpsRequest(geoUrl)
                    if (geoCode !in 200..299) {
                        promise.reject("GEOCODE_HTTP_ERROR", redactSensitiveText(parseOpenWeatherError(geoBody, geoCode)))
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
                val (code, body) = executeHttpsRequest(weatherUrl)
                if (code !in 200..299) {
                    promise.reject("WEATHER_HTTP_ERROR", redactSensitiveText(parseOpenWeatherError(body, code)))
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
                    redactSensitiveText(ex.message ?: "Failed fetching current weather")
                )
            }
        }
    }

    @ReactMethod
    fun fetchDailyQuote(dailySeedId: Int, useRandom: Boolean, promise: Promise) {
        ioExecutor.execute {
            try {
                val safeId = dailySeedId.coerceIn(1, DAILY_QUOTE_POOL_SIZE)
                val endpoint = if (useRandom) {
                    "$DUMMYJSON_QUOTE_BASE/random"
                } else {
                    "$DUMMYJSON_QUOTE_BASE/$safeId"
                }
                val (code, body) = executeHttpsRequest(endpoint)
                if (code !in 200..299) {
                    promise.reject("QUOTE_HTTP_ERROR", "Quote API returned HTTP $code")
                    return@execute
                }
                val json = JSONObject(body)
                val quoteText = json.optString("quote", "").trim()
                if (quoteText.isEmpty()) {
                    promise.reject("QUOTE_EMPTY", "Quote API returned an empty quote")
                    return@execute
                }
                val author = json.optString("author", "").trim()
                val id = json.optInt("id", safeId)

                val result = Arguments.createMap()
                result.putInt("id", id)
                result.putString("quote", quoteText)
                result.putString("author", author)
                promise.resolve(result)
            } catch (ex: Exception) {
                promise.reject(
                    "QUOTE_FETCH_FAILED",
                    redactSensitiveText(ex.message ?: "Failed fetching daily quote")
                )
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

    private fun executeHttpsRequest(urlString: String): Pair<Int, String> {
        val connection = (URL(urlString).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
        }

        return try {
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else (connection.errorStream ?: connection.inputStream)
            val body = stream?.use { input ->
                BufferedReader(InputStreamReader(input, StandardCharsets.UTF_8)).readText()
            }.orEmpty()
            code to body
        } finally {
            connection.disconnect()
        }
    }

    private fun parseOpenWeatherError(rawBody: String, statusCode: Int): String {
        return runCatching {
            val message = JSONObject(rawBody).optString("message", "").trim()
            if (message.isNotEmpty()) "OpenWeatherMap ($statusCode): $message" else "OpenWeatherMap HTTP $statusCode"
        }.getOrElse {
            "OpenWeatherMap HTTP $statusCode"
        }
    }

    companion object {
        private const val ALIAS_OPENWEATHER = "openweathermap"
        private const val DUMMYJSON_QUOTE_BASE = "https://dummyjson.com/quotes"
        private const val DAILY_QUOTE_POOL_SIZE = 1454

        private val APPID_PARAM_REGEX = Regex("([?&](?:appid|key)=)[^&\\s]+", RegexOption.IGNORE_CASE)
        private val BEARER_REGEX = Regex("(Bearer\\s+)[A-Za-z0-9._-]+", RegexOption.IGNORE_CASE)

        /** Strips sensitive API key query parameters and bearer headers before surfacing errors. */
        @JvmStatic
        fun redactSensitiveText(input: String?): String {
            if (input.isNullOrBlank()) return ""
            var output = APPID_PARAM_REGEX.replace(input, "$1[REDACTED]")
            output = BEARER_REGEX.replace(output, "$1[REDACTED]")
            return output
        }
    }
}
