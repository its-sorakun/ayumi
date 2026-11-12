/**
 * Ambient Scenery settings card rendered inside Ayumi's Settings screen ONLY when
 * Ambient Scenery (`ai_ambient`) is selected or active.
 * Exposes Time-of-Day look presets (Auto + 7 phases), Weather look presets (Auto + 8 moods),
 * Seasonal vibes toggle + month/manual overrides, optional OpenWeatherMap BYOK Keystore
 * management, coarse location vs. manual city fallback, and manual quote/weather sync.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Button,
  Divider,
  HelperText,
  List,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';

import { useAyumiTheme } from '../index';
import { SettingsSectionGroup } from '../oxygenColorOsUI';
import { colorWithOpacity } from '../paletteUtils';
import { useAiAmbient } from './AiAmbientContext';
import { formatAmbientTemperature } from './ambientServices';
import {
  SEASONAL_VIBE_OPTIONS,
  TIME_OF_DAY_OPTIONS,
  WEATHER_LOOK_OPTIONS,
  type OptionMetadata,
} from './config';

interface AiAmbientSettingsSectionProps {
  readonly isActiveSession: boolean;
}

interface LookPickerRowProps<T extends string> {
  readonly title?: string;
  readonly options: readonly OptionMetadata<T>[];
  readonly selectedValue: T;
  readonly onSelect: (value: T) => void;
  readonly testID: string;
  readonly chipTestIdPrefix: string;
  readonly primaryColor: string;
  readonly primaryContainer: string;
  readonly onPrimaryContainer: string;
  readonly surfaceVariant: string;
  readonly onSurfaceVariant: string;
  readonly outlineVariant: string;
}

function LookPickerRow<T extends string>({
  title,
  options,
  selectedValue,
  onSelect,
  testID,
  chipTestIdPrefix,
  primaryColor,
  primaryContainer,
  onPrimaryContainer,
  surfaceVariant,
  onSurfaceVariant,
  outlineVariant,
}: LookPickerRowProps<T>): React.JSX.Element {
  return (
    <View style={styles.sectionBlock}>
      {title != null && (
        <Text variant="titleSmall" style={styles.sectionTitle}>
          {title}
        </Text>
      )}
      <View style={styles.chipWrap} testID={testID}>
        {options.map(option => {
          const selected = selectedValue === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              testID={`${chipTestIdPrefix}${option.value}`}
              activeOpacity={0.82}
              onPress={() => onSelect(option.value)}
              style={[
                styles.choiceChip,
                {
                  backgroundColor: selected
                    ? primaryContainer
                    : colorWithOpacity(surfaceVariant, 0.55),
                  borderColor: selected ? primaryColor : outlineVariant,
                },
              ]}>
              <Text
                style={[
                  styles.choiceChipLabel,
                  selected ? styles.choiceChipLabelSelected : styles.choiceChipLabelDefault,
                  { color: selected ? onPrimaryContainer : onSurfaceVariant },
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function renderSettingSwitch(
  value: boolean,
  onValueChange: (val: boolean) => void,
  testID?: string,
): () => React.ReactNode {
  return function SettingSwitchControl(): React.ReactNode {
    return (
      <Switch
        value={value}
        onValueChange={onValueChange}
        testID={testID}
      />
    );
  };
}

export function AiAmbientSettingsSection({
  isActiveSession,
}: AiAmbientSettingsSectionProps): React.JSX.Element {
  const { colors, surfaces, resolveCardSurface, resolveCardBorder } = useAyumiTheme();
  const {
    prefs,
    keyStatuses,
    weather,
    isRefreshingWeather,
    isRefreshingQuote,
    lastError,
    saveWeatherKey,
    deleteWeatherKey,
    testWeatherKey,
    setAutoRefreshWeather,
    setUseDeviceLocation,
    setManualCity,
    setTimeOverride,
    setWeatherOverride,
    setSeasonalEnabled,
    setSeasonalOverride,
    refreshWeatherNow,
    refreshAtmosphereNow,
  } = useAiAmbient();

  const [weatherInput, setWeatherInput] = useState('');
  const [cityDraft, setCityDraft] = useState(prefs.manualCity);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const groupedBg = resolveCardSurface(colors.surface);
  const groupedBorder =
    surfaces.ambientGradientStyle === 'ai_ambient_scenic'
      ? resolveCardBorder().borderColor
      : undefined;

  const isBusy = busyAction !== null || isRefreshingWeather || isRefreshingQuote;

  const handleToggleSeasonal = useCallback(
    (val: boolean) => setSeasonalEnabled(val),
    [setSeasonalEnabled],
  );
  const handleToggleLocation = useCallback(
    (val: boolean) => setUseDeviceLocation(val),
    [setUseDeviceLocation],
  );
  const handleToggleAutoWeather = useCallback(
    (val: boolean) => setAutoRefreshWeather(val),
    [setAutoRefreshWeather],
  );

  const handleSaveWeatherKey = async () => {
    setBusyAction('save_weather');
    setStatusMessage(null);
    try {
      await saveWeatherKey(weatherInput);
      setWeatherInput('');
      setStatusMessage('OpenWeatherMap API key encrypted in Android Keystore.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Unable to save Weather key.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestWeatherKey = async () => {
    setBusyAction('test_weather');
    setStatusMessage(null);
    try {
      const ok = await testWeatherKey(
        weatherInput.trim() || undefined,
        cityDraft.trim() || prefs.manualCity,
      );
      if (ok) {
        setStatusMessage('OpenWeatherMap API key verified.');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteWeatherKey = async () => {
    setBusyAction('del_weather');
    setStatusMessage(null);
    try {
      await deleteWeatherKey();
      setWeatherInput('');
      setStatusMessage('OpenWeatherMap API key removed from Android Keystore.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSyncWeatherOnly = async () => {
    if (cityDraft.trim() && cityDraft.trim() !== prefs.manualCity) {
      await setManualCity(cityDraft.trim());
    }
    const snap = await refreshWeatherNow(true);
    if (snap) {
      setStatusMessage(
        `Weather synced: ${formatAmbientTemperature(snap.temperatureC)} (${snap.conditionMain})`,
      );
    }
  };

  const handleRefreshAll = async () => {
    setStatusMessage(null);
    await refreshAtmosphereNow();
    setStatusMessage('Weather look & daily quote refreshed.');
  };

  if (!isActiveSession) {
    return (
      <SettingsSectionGroup
        grouped={surfaces.groupedSettingsCards}
        surfaces={surfaces}
        cardBackground={groupedBg}
        cardBorderColor={groupedBorder}>
        <List.Section>
          <List.Subheader>Ambient Scenery</List.Subheader>
          <Text style={[styles.hintBody, { color: colors.onSurfaceVariant }]}>
            Restart Ayumi to activate Ambient Scenery and customize time, weather, seasonal foliage,
            and live weather sync.
          </Text>
        </List.Section>
      </SettingsSectionGroup>
    );
  }

  return (
    <SettingsSectionGroup
      grouped={surfaces.groupedSettingsCards}
      surfaces={surfaces}
      cardBackground={groupedBg}
      cardBorderColor={groupedBorder}>
      <List.Section>
        <List.Subheader>Ambient Scenery Atmosphere</List.Subheader>

        <LookPickerRow
          title="Time-of-Day Look"
          options={TIME_OF_DAY_OPTIONS}
          selectedValue={prefs.timeOverride}
          onSelect={setTimeOverride}
          testID="ai-ambient-time-picker"
          chipTestIdPrefix="ai-ambient-time-"
          primaryColor={colors.primary}
          primaryContainer={colors.primaryContainer}
          onPrimaryContainer={colors.onPrimaryContainer}
          surfaceVariant={colors.surfaceVariant}
          onSurfaceVariant={colors.onSurfaceVariant}
          outlineVariant={colors.outlineVariant}
        />

        <Divider style={styles.innerDivider} />

        <LookPickerRow
          title="Weather Mood"
          options={WEATHER_LOOK_OPTIONS}
          selectedValue={prefs.weatherOverride}
          onSelect={setWeatherOverride}
          testID="ai-ambient-weather-picker"
          chipTestIdPrefix="ai-ambient-weather-look-"
          primaryColor={colors.primary}
          primaryContainer={colors.primaryContainer}
          onPrimaryContainer={colors.onPrimaryContainer}
          surfaceVariant={colors.surfaceVariant}
          onSurfaceVariant={colors.onSurfaceVariant}
          outlineVariant={colors.outlineVariant}
        />

        <Divider style={styles.innerDivider} />

        <List.Item
          title="Seasonal scenery vibes"
          description="Snow peaks (Dec–Jan), thaw (Feb), blossoms (Mar), monsoon greens (Apr–Sep rain), autumn (Oct–Nov)"
          descriptionNumberOfLines={3}
          right={renderSettingSwitch(
            prefs.seasonalEnabled,
            handleToggleSeasonal,
            'ai-ambient-seasonal-toggle',
          )}
        />

        {prefs.seasonalEnabled && (
          <LookPickerRow
            options={SEASONAL_VIBE_OPTIONS}
            selectedValue={prefs.seasonalOverride}
            onSelect={setSeasonalOverride}
            testID="ai-ambient-season-picker"
            chipTestIdPrefix="ai-ambient-season-"
            primaryColor={colors.primary}
            primaryContainer={colors.primaryContainer}
            onPrimaryContainer={colors.onPrimaryContainer}
            surfaceVariant={colors.surfaceVariant}
            onSurfaceVariant={colors.onSurfaceVariant}
            outlineVariant={colors.outlineVariant}
          />
        )}

        <Divider style={styles.innerDivider} />

        {/* OpenWeatherMap API Key (Keystore-backed optional live weather) */}
        <View style={styles.keyBlock}>
          <View style={styles.keyHeaderRow}>
            <Text variant="titleSmall" style={styles.keyTitle}>
              OpenWeatherMap API Key (Optional)
            </Text>
            <Text
              testID="ai-ambient-weather-status"
              style={[
                styles.keyBadge,
                { color: keyStatuses.hasWeatherKey ? colors.primary : colors.onSurfaceVariant },
              ]}>
              {keyStatuses.hasWeatherKey
                ? `Saved (${keyStatuses.weatherMasked})`
                : 'Not configured'}
            </Text>
          </View>
          <TextInput
            mode="outlined"
            dense
            secureTextEntry
            value={weatherInput}
            onChangeText={setWeatherInput}
            placeholder={keyStatuses.hasWeatherKey ? 'Enter new key to replace' : '32-char OpenWeather key'}
            autoCapitalize="none"
            autoCorrect={false}
            testID="ai-ambient-weather-input"
            style={styles.keyInput}
          />
          <View style={styles.keyButtonRow}>
            <Button
              mode="contained-tonal"
              compact
              onPress={handleSaveWeatherKey}
              disabled={!weatherInput.trim() || isBusy}
              testID="ai-ambient-weather-save">
              Save
            </Button>
            <Button
              mode="outlined"
              compact
              onPress={handleTestWeatherKey}
              disabled={(!weatherInput.trim() && !keyStatuses.hasWeatherKey) || isBusy}
              testID="ai-ambient-weather-test">
              Test
            </Button>
            {keyStatuses.hasWeatherKey && (
              <Button
                mode="text"
                compact
                textColor={colors.error}
                onPress={handleDeleteWeatherKey}
                disabled={isBusy}
                testID="ai-ambient-weather-clear">
                Clear
              </Button>
            )}
          </View>
        </View>

        <Divider style={styles.innerDivider} />

        <List.Item
          title="Use approximate location"
          description="Coarse location lookup only when Ambient Scenery is active"
          descriptionNumberOfLines={2}
          right={renderSettingSwitch(
            prefs.useDeviceLocation,
            handleToggleLocation,
            'ai-ambient-location-toggle',
          )}
        />

        <View style={styles.cityRow}>
          <TextInput
            mode="outlined"
            dense
            label="Fallback / Manual City"
            value={cityDraft}
            onChangeText={setCityDraft}
            onBlur={() => {
              if (cityDraft.trim()) {
                setManualCity(cityDraft.trim());
              }
            }}
            placeholder="e.g. Tokyo or London, GB"
            testID="ai-ambient-city-input"
            style={styles.cityInput}
          />
          <View style={styles.syncRow}>
            <Button
              mode="contained-tonal"
              compact
              onPress={handleSyncWeatherOnly}
              disabled={isBusy || !keyStatuses.hasWeatherKey}
              testID="ai-ambient-sync-weather-btn">
              Sync Weather
            </Button>
            {weather && (
              <Text style={[styles.cachedWeatherLabel, { color: colors.onSurfaceVariant }]}>
                Live: {formatAmbientTemperature(weather.temperatureC)} ({weather.conditionMain})
              </Text>
            )}
          </View>
        </View>

        <List.Item
          title="Auto-sync weather"
          description="Refreshes local weather every 30 min when resuming"
          right={renderSettingSwitch(prefs.autoRefreshWeather, handleToggleAutoWeather)}
        />

        <View style={styles.actionFooter}>
          <Button
            mode="contained"
            loading={isRefreshingWeather || isRefreshingQuote}
            disabled={isBusy}
            onPress={handleRefreshAll}
            testID="ai-ambient-regenerate-settings-btn">
            Refresh Weather & Quote Now
          </Button>
        </View>

        {(statusMessage != null || lastError != null) && (
          <HelperText
            type={lastError ? 'error' : 'info'}
            visible
            style={styles.feedbackText}>
            {lastError ?? statusMessage}
          </HelperText>
        )}

        <Text style={[styles.privacyNote, { color: colors.onSurfaceVariant }]}>
          Privacy: OpenWeatherMap keys are encrypted locally using Android Keystore (AES-256-GCM).
          Daily quotes are fetched from DummyJSON without tracking or generative-AI telemetry.
        </Text>
      </List.Section>
    </SettingsSectionGroup>
  );
}

const styles = StyleSheet.create({
  hintBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    lineHeight: 20,
  },
  sectionBlock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  choiceChipLabel: {
    fontSize: 12.5,
  },
  choiceChipLabelSelected: {
    fontWeight: '700',
  },
  choiceChipLabelDefault: {
    fontWeight: '500',
  },
  innerDivider: {
    marginVertical: 6,
    marginHorizontal: 16,
  },
  keyBlock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  keyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  keyTitle: {
    fontWeight: '700',
    flexShrink: 1,
  },
  keyBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  keyInput: {
    marginBottom: 8,
  },
  keyButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  cityInput: {
    marginBottom: 8,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  cachedWeatherLabel: {
    fontSize: 12.5,
    flexShrink: 1,
  },
  actionFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  feedbackText: {
    paddingHorizontal: 16,
  },
  privacyNote: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    fontSize: 12,
    lineHeight: 17,
  },
});
