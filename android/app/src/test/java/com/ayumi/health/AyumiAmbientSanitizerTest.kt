/*
 * Unit tests verifying API credential redaction in AyumiAmbientModule error sanitation.
 */

package com.ayumi.health

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AyumiAmbientSanitizerTest {

    @Test
    fun `redactSensitiveText scrubs openweathermap appid and bearer secrets`() {
        val rawUrl = "GET https://api.openweathermap.org/data/2.5/weather?lat=35.0&appid=owm_secret_abc123&units=metric"
        val cleanUrl = AyumiAmbientModule.redactSensitiveText(rawUrl)
        assertFalse(cleanUrl.contains("owm_secret_abc123"))
        assertTrue(cleanUrl.contains("appid=[REDACTED]"))

        val rawBearer = "Authorization: Bearer super_secret_token_99 failed"
        val cleanBearer = AyumiAmbientModule.redactSensitiveText(rawBearer)
        assertFalse(cleanBearer.contains("super_secret_token_99"))
        assertTrue(cleanBearer.contains("Bearer [REDACTED]"))
    }
}

