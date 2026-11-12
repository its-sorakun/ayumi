/**
 * Dedicated Settings UI section for AI Ambient BYOK credentials, location fallback,
 * Colour Source selection (System palette vs Generated artwork palette), manual
 * regeneration trigger, and honest BYOK privacy disclosures.
 */

import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Divider, RadioButton, Switch, Text, TextInput, useTheme } from 'react-native-paper';

import { useAyumiTheme } from '../index';
import { useAiAmbient } from './AiAmbientContext';
import type { AiAmbientColourSource } from './ambientPalette';

interface AiAmbientSettingsSectionProps {
  readonly isActiveSession: boolean;
}

export function AiAmbientSettingsSection({
  isActiveSession,
}: AiAmbientSettingsSectionProps): React.JSX.Element {
  const theme = useTheme();
  const { surfaces, resolveCardSurface, resolveCardBorder } = useAyumiTheme();
  const {
    prefs,
    keyStatuses,
    weather,
    isGeneratingArtwork,
    isRefreshingWeather,
    statusMessage,
    lastError,
    setColourSource,
    setManualCity,
    setUseDeviceLocation,
    setAutoRefreshEnabled,
    saveGeminiKey,
    deleteGeminiKey,
    testGeminiKey,
    saveWeatherKey,
    deleteWeatherKey,
    testWeatherKey,
    requestLocationAccess,
    refreshWeatherNow,
    regenerateArtworkAndQuote,
    clearDiagnostics,
  } = useAiAmbient();

  const [geminiDraft, setGeminiDraft] = useState('');
  const [weatherDraft, setWeatherDraft] = useState('');
  const [cityDraft, setCityDraft] = useState(prefs.manualCity);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingWeather, setTestingWeather] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  const handleSaveGemini = async () => {
    const clean = geminiDraft.trim();
    if (!clean) return;
    await saveGeminiKey(clean);
    setGeminiDraft('');
    setLocalFeedback('Gemini API key encrypted in Android Keystore.');
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    setLocalFeedback(null);
    clearDiagnostics();
    try {
      const msg = await testGeminiKey(geminiDraft.trim() || undefined);
      setLocalFeedback(msg);
    } catch (err) {
      setLocalFeedback(err instanceof Error ? err.message : 'Gemini test failed.');
    } finally {
      setTestingGemini(false);
    }
  };

  const handleSaveWeatherKey = async () => {
    const clean = weatherDraft.trim();
    if (!clean) return;
    await saveWeatherKey(clean);
    setWeatherDraft('');
    setLocalFeedback('OpenWeatherMap API key encrypted in Android Keystore.');
  };

  const handleTestWeather = async () => {
    setTestingWeather(true);
    setLocalFeedback(null);
    clearDiagnostics();
    try {
      const msg = await testWeatherKey(weatherDraft.trim() || undefined);
      setLocalFeedback(msg);
    } catch (err) {
      setLocalFeedback(err instanceof Error ? err.message : 'Weather API test failed.');
    } finally {
      setTestingWeather(false);
    }
  };

  const handleToggleDeviceLocation = async (next: boolean) => {
    if (next) {
      await requestLocationAccess();
    }
    await setUseDeviceLocation(next);
  };

  const handleSaveCity = async () => {
    await setManualCity(cityDraft);
    setLocalFeedback(
      cityDraft.trim() ? `Manual city saved: ${cityDraft.trim()}` : 'Manual city cleared.',
    );
  };

  const baseSurface = theme.dark ? theme.colors.elevation.level1 : theme.colors.surface;
  const cardSurface = resolveCardSurface(baseSurface);
  const cardBorder = resolveCardBorder();
  const mutedColor = theme.colors.onSurfaceVariant;

  return (
    <View
      testID="ai-ambient-settings-section"
      style={[
        styles.sectionCard,
        {
          backgroundColor: cardSurface,
          borderRadius: surfaces.sectionCardRadius,
          elevation: surfaces.cardElevation,
          shadowOpacity: surfaces.cardShadowOpacity,
          borderWidth: cardBorder.borderWidth,
          borderColor: cardBorder.borderColor,
        },
      ]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
        AI Ambient Configuration
      </Text>
      <Text style={[styles.sectionSub, { color: mutedColor }]}>
        {isActiveSession
          ? 'Live AI Ambient scenery, short quotes, and adaptive palettes.'
          : 'Configured for next AI Ambient launch. Switch Theme above & restart to activate.'}
      </Text>

      {/* Colour Source Mode */}
      <Text style={[styles.subLabel, { color: theme.colors.onSurface }]}>Colour Source</Text>
      <RadioButton.Group
        value={prefs.colourSource}
        onValueChange={val => setColourSource(val as AiAmbientColourSource)}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setColourSource('artwork')}
          style={styles.radioRow}>
          <View style={styles.radioTextCol}>
            <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
              Generated artwork palette
            </Text>
            <Text style={[styles.rowDesc, { color: mutedColor }]}>
              Extracts balanced harmonious hues locally from cached scenery
            </Text>
          </View>
          <RadioButton value="artwork" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setColourSource('system')}
          style={styles.radioRow}>
          <View style={styles.radioTextCol}>
            <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
              System palette
            </Text>
            <Text style={[styles.rowDesc, { color: mutedColor }]}>
              Uses Android Material You wallpaper palette colors
            </Text>
          </View>
          <RadioButton value="system" />
        </TouchableOpacity>
      </RadioButton.Group>

      <Divider style={styles.divider} />

      {/* Gemini BYOK */}
      <Text style={[styles.subLabel, { color: theme.colors.onSurface }]}>
        Gemini API Key (Image + Quote)
      </Text>
      <Text style={[styles.keyStatusText, { color: mutedColor }]} testID="gemini-key-status">
        {keyStatuses.hasGeminiKey ? `Stored: ${keyStatuses.geminiMasked}` : 'Not configured'}
      </Text>
      <TextInput
        mode="outlined"
        dense
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={geminiDraft}
        onChangeText={setGeminiDraft}
        placeholder={keyStatuses.hasGeminiKey ? 'Enter new key to replace' : 'Paste Gemini API key'}
        style={styles.keyInput}
        testID="gemini-key-input"
      />
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={handleSaveGemini}
          disabled={!geminiDraft.trim()}
          testID="gemini-key-save"
          style={[
            styles.chipButton,
            {
              backgroundColor: geminiDraft.trim()
                ? theme.colors.primaryContainer
                : theme.colors.surfaceVariant,
            },
          ]}>
          <Text style={[styles.chipLabel, { color: theme.colors.onPrimaryContainer }]}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleTestGemini}
          disabled={testingGemini || (!keyStatuses.hasGeminiKey && !geminiDraft.trim())}
          testID="gemini-key-test"
          style={[styles.chipButton, { backgroundColor: theme.colors.secondaryContainer }]}>
          {testingGemini ? (
            <ActivityIndicator size={14} color={theme.colors.onSecondaryContainer} />
          ) : (
            <Text style={[styles.chipLabel, { color: theme.colors.onSecondaryContainer }]}>
              Test Key
            </Text>
          )}
        </TouchableOpacity>
        {keyStatuses.hasGeminiKey && (
          <TouchableOpacity
            onPress={() => deleteGeminiKey()}
            testID="gemini-key-clear"
            style={[styles.chipButton, { backgroundColor: theme.colors.errorContainer }]}>
            <Text style={[styles.chipLabel, { color: theme.colors.onErrorContainer }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <Divider style={styles.divider} />

      {/* OpenWeatherMap BYOK */}
      <Text style={[styles.subLabel, { color: theme.colors.onSurface }]}>
        OpenWeatherMap API Key (Current Weather)
      </Text>
      <Text style={[styles.keyStatusText, { color: mutedColor }]} testID="weather-key-status">
        {keyStatuses.hasWeatherKey ? `Stored: ${keyStatuses.weatherMasked}` : 'Not configured'}
      </Text>
      <TextInput
        mode="outlined"
        dense
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={weatherDraft}
        onChangeText={setWeatherDraft}
        placeholder={
          keyStatuses.hasWeatherKey ? 'Enter new key to replace' : 'Paste OpenWeatherMap API key'
        }
        style={styles.keyInput}
        testID="weather-key-input"
      />
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={handleSaveWeatherKey}
          disabled={!weatherDraft.trim()}
          testID="weather-key-save"
          style={[
            styles.chipButton,
            {
              backgroundColor: weatherDraft.trim()
                ? theme.colors.primaryContainer
                : theme.colors.surfaceVariant,
            },
          ]}>
          <Text style={[styles.chipLabel, { color: theme.colors.onPrimaryContainer }]}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleTestWeather}
          disabled={testingWeather || (!keyStatuses.hasWeatherKey && !weatherDraft.trim())}
          testID="weather-key-test"
          style={[styles.chipButton, { backgroundColor: theme.colors.secondaryContainer }]}>
          {testingWeather ? (
            <ActivityIndicator size={14} color={theme.colors.onSecondaryContainer} />
          ) : (
            <Text style={[styles.chipLabel, { color: theme.colors.onSecondaryContainer }]}>
              Test Key
            </Text>
          )}
        </TouchableOpacity>
        {keyStatuses.hasWeatherKey && (
          <TouchableOpacity
            onPress={() => deleteWeatherKey()}
            testID="weather-key-clear"
            style={[styles.chipButton, { backgroundColor: theme.colors.errorContainer }]}>
            <Text style={[styles.chipLabel, { color: theme.colors.onErrorContainer }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <Divider style={styles.divider} />

      {/* Location & Weather Sync */}
      <View style={styles.switchRow}>
        <View style={styles.radioTextCol}>
          <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
            Use approximate location
          </Text>
          <Text style={[styles.rowDesc, { color: mutedColor }]}>
            Coarse city-level weather lookup (`ACCESS_COARSE_LOCATION`)
          </Text>
        </View>
        <Switch value={prefs.useDeviceLocation} onValueChange={handleToggleDeviceLocation} />
      </View>

      <TextInput
        mode="outlined"
        dense
        value={cityDraft}
        onChangeText={setCityDraft}
        onBlur={handleSaveCity}
        placeholder="Manual city fallback (e.g. Kyoto, JP)"
        style={[styles.keyInput, { marginTop: 8 }]}
        testID="ambient-manual-city-input"
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => refreshWeatherNow(false)}
          disabled={isRefreshingWeather || !keyStatuses.hasWeatherKey}
          style={[styles.chipButton, { backgroundColor: theme.colors.secondaryContainer }]}>
          {isRefreshingWeather ? (
            <ActivityIndicator size={14} color={theme.colors.onSecondaryContainer} />
          ) : (
            <Text style={[styles.chipLabel, { color: theme.colors.onSecondaryContainer }]}>
              Sync Weather
            </Text>
          )}
        </TouchableOpacity>
        {weather != null && (
          <Text style={[styles.weatherCacheLabel, { color: mutedColor }]}>
            Cached: {Math.round(weather.temperatureC)}°C ({weather.conditionMain})
          </Text>
        )}
      </View>

      <Divider style={styles.divider} />

      {/* Auto-refresh & Manual Artwork Trigger */}
      <View style={styles.switchRow}>
        <View style={styles.radioTextCol}>
          <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
            Auto-refresh scenery
          </Text>
          <Text style={[styles.rowDesc, { color: mutedColor }]}>
            Regenerates only when time-of-day or weather shifts significantly
          </Text>
        </View>
        <Switch value={prefs.autoRefreshEnabled} onValueChange={setAutoRefreshEnabled} />
      </View>

      <TouchableOpacity
        activeOpacity={0.82}
        disabled={isGeneratingArtwork || !keyStatuses.hasGeminiKey}
        onPress={() => regenerateArtworkAndQuote()}
        testID="ambient-regenerate-settings-btn"
        style={[
          styles.primaryBtn,
          {
            backgroundColor: keyStatuses.hasGeminiKey
              ? theme.colors.primary
              : theme.colors.surfaceVariant,
          },
        ]}>
        {isGeneratingArtwork ? (
          <ActivityIndicator size={16} color={theme.colors.onPrimary} />
        ) : (
          <Text style={[styles.primaryBtnText, { color: theme.colors.onPrimary }]}>
            Regenerate Artwork & Quote Now
          </Text>
        )}
      </TouchableOpacity>

      {(localFeedback || statusMessage || lastError) && (
        <Text
          style={[
            styles.feedbackText,
            { color: lastError ? theme.colors.error : theme.colors.primary },
          ]}>
          {lastError || localFeedback || statusMessage}
        </Text>
      )}

      <Text style={[styles.privacyNotice, { color: mutedColor }]}>
        Security & Privacy: Both API keys are encrypted locally using Android Keystore (AES-256-GCM)
        and never written to plaintext storage. Gemini receives only coarse weather category,
        temperature range, time-of-day, and palette direction — never GPS coordinates, user names,
        or personal health metrics.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12.5,
    marginTop: 2,
    marginBottom: 10,
  },
  subLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 4,
  },
  keyStatusText: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  keyInput: {
    height: 42,
    marginBottom: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  radioTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 12,
    marginTop: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  divider: {
    marginVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  chipButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  weatherCacheLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  primaryBtn: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 9,
  },
  privacyNotice: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 12,
  },
});
