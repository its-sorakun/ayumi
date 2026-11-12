/*
 * Android Keystore-backed AES-256-GCM secret storage for BYOK API credentials.
 * Uses framework KeyStore and javax.crypto primitives (avoiding deprecated EncryptedSharedPreferences)
 * while storing only IV-framed ciphertexts and exposed masked tails (`••••1234`).
 */

package com.ayumi.health

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object SecureKeyStore {

    private const val TAG = "AyumiSecureKeyStore"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val KEYSTORE_ALIAS = "ayumi_ambient_byok_aes_v1"
    private const val PREFS_NAME = "ayumi_ambient_encrypted_secrets"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128

    private val lock = Any()

    private fun getPrefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    @Throws(Exception::class)
    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)

        val existing = keyStore.getKey(KEYSTORE_ALIAS, null)
        if (existing is SecretKey) {
            return existing
        }

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    fun storeSecret(context: Context, alias: String, plaintext: String) {
        val trimmed = plaintext.trim()
        require(trimmed.isNotEmpty()) { "API key cannot be blank." }
        synchronized(lock) {
            val secretKey = getOrCreateSecretKey()
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey)
            val iv = cipher.iv
            val ciphertext = cipher.doFinal(trimmed.toByteArray(StandardCharsets.UTF_8))

            val payload = Base64.encodeToString(iv, Base64.NO_WRAP) +
                ":" +
                Base64.encodeToString(ciphertext, Base64.NO_WRAP)
            getPrefs(context).edit().putString(storageKey(alias), payload).apply()
        }
    }

    fun readSecret(context: Context, alias: String): String? {
        synchronized(lock) {
            val payload = getPrefs(context).getString(storageKey(alias), null) ?: return null
            val parts = payload.split(":")
            if (parts.size != 2) return null

            return try {
                val iv = Base64.decode(parts[0], Base64.NO_WRAP)
                val ciphertext = Base64.decode(parts[1], Base64.NO_WRAP)
                val secretKey = getOrCreateSecretKey()
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(GCM_TAG_BITS, iv))
                val plainBytes = cipher.doFinal(ciphertext)
                String(plainBytes, StandardCharsets.UTF_8)
            } catch (ex: Exception) {
                // Keystore key invalidation (e.g. lock-screen reset) invalidates ciphertext cleanly
                // without crashing the app; remove corrupted ciphertext so user can re-enter cleanly.
                Log.w(TAG, "Failed decrypting secret alias=$alias (${ex.javaClass.simpleName}); clearing stale entry.")
                getPrefs(context).edit().remove(storageKey(alias)).apply()
                null
            }
        }
    }

    fun deleteSecret(context: Context, alias: String) {
        synchronized(lock) {
            getPrefs(context).edit().remove(storageKey(alias)).apply()
        }
    }

    fun hasSecret(context: Context, alias: String): Boolean =
        !readSecret(context, alias).isNullOrEmpty()

    fun getMaskedSecret(context: Context, alias: String): String {
        val raw = readSecret(context, alias) ?: return ""
        return maskKeyForDisplay(raw)
    }

    fun maskKeyForDisplay(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return ""
        if (trimmed.length <= 4) return "••••"
        val tail = trimmed.takeLast(4)
        return "••••••••$tail"
    }

    private fun storageKey(alias: String): String = "secret_v1_$alias"
}

