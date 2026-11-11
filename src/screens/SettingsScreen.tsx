/**
 * SettingsScreen — user preferences, goals, and hardware configuration.
 *
 * Implements the third destination of Ayumi's horizontal pager:
 *  - Theme appearance mode (System Auto, Light, Dark)
 *  - Data source provider selection (Health Connect or hardware sensor)
 *  - Physical metrics for BMR formula calculations
 *  - Daily goals configuration (Steps, Distance, Water)
 *  - Consistent Material 3 typography header and safe-area insets adaptation
 *  - Keyboard-aware scrolling with dock clearance
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, ToastAndroid, Platform } from 'react-native';
import {
  Text,
  useTheme,
  RadioButton,
  List,
  Divider,
  TextInput,
  Snackbar,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../contexts/SettingsContext';
import {
  AYUMI_THEME_OPTIONS,
  AyumiThemeId,
  OxygenAmbientBackdrop,
  OxygenSettingsIconId,
  OxygenSettingsRowIcon,
  SettingsSectionGroup,
  ThemeOptionCard,
  useAyumiTheme,
} from '../themes';

export interface SettingsScreenProps {
  readonly hideDock?: boolean;
}

function DefaultEmojiIcon({ emoji }: { readonly emoji: string }): React.JSX.Element {
  return <Text>{emoji}</Text>;
}

function makeSettingLeading(
  isOxygenIcons: boolean,
  fallbackEmoji: string,
  oxygenId: OxygenSettingsIconId,
  accentColor: string,
  badgeFgColor?: string,
) {
  return (props: { color?: string; style?: object }) =>
    isOxygenIcons ? (
      <OxygenSettingsRowIcon
        icon={oxygenId}
        accentColor={accentColor}
        badgeFgColor={badgeFgColor}
      />
    ) : (
      <List.Icon {...props} icon={() => <DefaultEmojiIcon emoji={fallbackEmoji} />} />
    );
}

export function SettingsScreen({ hideDock = false }: SettingsScreenProps = {}): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    themeId: activeSessionThemeId,
    colors,
    isDark,
    surfaces,
    typography,
    metricAccents,
  } = useAyumiTheme();
  const isOxygenIcons = surfaces.iconFamily === 'oxygen_lucide';

  const renderSettingIcon = (
    fallbackEmoji: string,
    oxygenId: OxygenSettingsIconId,
    accentColor: string,
    badgeFgColor?: string,
  ) => makeSettingLeading(isOxygenIcons, fallbackEmoji, oxygenId, accentColor, badgeFgColor);
  const {
    theme: currentTheme, visualTheme, provider: currentProvider, stepGoal, distanceGoal,
    gender, weight, height, age, customWaterGoal,
    setTheme, setVisualTheme, setProvider, setStepGoal, setDistanceGoal,
    setGender, setWeight, setHeight, setAge, setCustomWaterGoal
  } = useSettings();

  const [restartBannerVisible, setRestartBannerVisible] = useState(false);

  const handleSelectVisualTheme = async (nextThemeId: AyumiThemeId) => {
    if (nextThemeId === visualTheme) {
      return;
    }

    await setVisualTheme(nextThemeId);

    if (nextThemeId !== activeSessionThemeId) {
      if (Platform.OS === 'android') {
        ToastAndroid.show(
          'Restart Ayumi to apply the new theme.',
          ToastAndroid.SHORT,
        );
      }
      setRestartBannerVisible(true);
    } else {
      setRestartBannerVisible(false);
    }
  };

  const [stepInput, setStepInput] = useState(stepGoal.toString());
  const [distanceInput, setDistanceInput] = useState(distanceGoal.toString());
  const [waterInput, setWaterInput] = useState(customWaterGoal ? customWaterGoal.toString() : '');
  const [weightInput, setWeightInput] = useState(weight ? weight.toString() : '');
  const [heightInput, setHeightInput] = useState(height ? height.toString() : '');
  const [ageInput, setAgeInput] = useState(age ? age.toString() : '');

  const handleSaveStepGoal = () => {
    const val = parseInt(stepInput, 10);
    if (!isNaN(val) && val > 0) {
      setStepGoal(val);
    } else {
      setStepInput(stepGoal.toString());
    }
  };

  const handleSaveDistanceGoal = () => {
    const val = parseInt(distanceInput, 10);
    if (!isNaN(val) && val > 0) {
      setDistanceGoal(val);
    } else {
      setDistanceInput(distanceGoal.toString());
    }
  };

  const handleSaveWaterGoal = () => {
    const val = parseInt(waterInput, 10);
    if (!isNaN(val) && val > 0) {
      setCustomWaterGoal(val);
    } else {
      setWaterInput('');
      setCustomWaterGoal(null);
    }
  };

  const handleSaveWeight = () => {
    const val = parseFloat(weightInput);
    if (!isNaN(val) && val > 0) setWeight(val);
    else { setWeightInput(weight ? weight.toString() : ''); setWeight(null); }
  };

  const handleSaveHeight = () => {
    const val = parseFloat(heightInput);
    if (!isNaN(val) && val > 0) setHeight(val);
    else { setHeightInput(height ? height.toString() : ''); setHeight(null); }
  };

  const handleSaveAge = () => {
    const val = parseInt(ageInput, 10);
    if (!isNaN(val) && val > 0) setAge(val);
    else { setAgeInput(age ? age.toString() : ''); setAge(null); }
  };

  return (
    <View style={[styles.screenWrapper, { backgroundColor: theme.colors.background }]}>
      <OxygenAmbientBackdrop
        enabled={surfaces.ambientGradientStyle === 'dynamic_glow'}
        primaryHex={colors.primary}
        secondaryHex={colors.secondary}
        isDark={isDark}
        testID="settings-ambient-backdrop"
      />
      <ScrollView
        style={[
          styles.container,
          {
            backgroundColor:
              surfaces.ambientGradientStyle === 'dynamic_glow'
                ? 'transparent'
                : theme.colors.background,
          },
        ]}
        contentContainerStyle={{
          paddingTop: insets.top + 6,
          paddingBottom: insets.bottom + (hideDock ? 96 : 140),
        }}
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header: Settings Title & Subtitle matching active theme typography */}
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.screenTitleText,
              {
                color: theme.colors.onSurface,
                fontSize: typography.screenTitleSize,
                fontWeight: typography.screenTitleWeight,
                letterSpacing: typography.screenTitleTracking,
              },
            ]}
          >
            Settings
          </Text>
          <Text
            style={[
              styles.screenSubtitleText,
              {
                color: theme.colors.onSurfaceVariant,
                fontSize: typography.screenSubtitleSize,
              },
            ]}
          >
            Preferences, goals and hardware configuration
          </Text>
        </View>

        <SettingsSectionGroup grouped={surfaces.groupedSettingsCards} surfaces={surfaces}>
          <List.Section style={surfaces.groupedSettingsCards ? styles.groupedListSection : undefined}>
            <List.Subheader>Appearance</List.Subheader>
            <RadioButton.Group onValueChange={value => setTheme(value as any)} value={currentTheme}>
              <List.Item
                title="System Auto"
                description="Follow device theme"
                left={renderSettingIcon('⚙️', 'theme', theme.colors.primary, theme.colors.onPrimary)}
                right={props => <RadioButton {...props} value="auto" />}
                onPress={() => setTheme('auto')}
              />
              {surfaces.groupedSettingsCards && <Divider style={styles.rowDivider} />}
              <List.Item
                title="Light Mode"
                left={renderSettingIcon(
                  '☀️',
                  'sun',
                  metricAccents.totalCalories.badgeBg ?? metricAccents.totalCalories.color,
                  metricAccents.totalCalories.onBadge,
                )}
                right={props => <RadioButton {...props} value="light" />}
                onPress={() => setTheme('light')}
              />
              {surfaces.groupedSettingsCards && <Divider style={styles.rowDivider} />}
              <List.Item
                title="Dark Mode"
                left={renderSettingIcon(
                  '🌙',
                  'moon',
                  metricAccents.activeTime.badgeBg ?? metricAccents.activeTime.color,
                  metricAccents.activeTime.onBadge,
                )}
                right={props => <RadioButton {...props} value="dark" />}
                onPress={() => setTheme('dark')}
              />
            </RadioButton.Group>
          </List.Section>
        </SettingsSectionGroup>

        {!surfaces.groupedSettingsCards && <Divider style={styles.divider} />}

        <SettingsSectionGroup grouped={surfaces.groupedSettingsCards} surfaces={surfaces}>
          <List.Section style={surfaces.groupedSettingsCards ? styles.groupedListSection : undefined}>
            <List.Subheader>Theme</List.Subheader>
            <View style={styles.themeOptionsColumn}>
              {AYUMI_THEME_OPTIONS.map(option => {
                const isSelected = visualTheme === option.id;
                const pendingRestart = isSelected && option.id !== activeSessionThemeId;
                return (
                  <ThemeOptionCard
                    key={option.id}
                    option={option}
                    isSelected={isSelected}
                    isActiveSession={option.id === activeSessionThemeId}
                    pendingRestart={pendingRestart}
                    onSelect={handleSelectVisualTheme}
                  />
                );
              })}
            </View>
            {visualTheme !== activeSessionThemeId && (
              <Text style={[styles.pendingHintText, { color: theme.colors.primary }]}>
                Restart Ayumi to apply the selected theme.
              </Text>
            )}
          </List.Section>
        </SettingsSectionGroup>

        {!surfaces.groupedSettingsCards && <Divider style={styles.divider} />}

        <SettingsSectionGroup grouped={surfaces.groupedSettingsCards} surfaces={surfaces}>
          <List.Section style={surfaces.groupedSettingsCards ? styles.groupedListSection : undefined}>
            <List.Subheader>Data Source</List.Subheader>
            <RadioButton.Group onValueChange={value => setProvider(value as any)} value={currentProvider}>
              <List.Item
                title="Google Health Connect"
                description="Syncs history with other fitness apps (Recommended)"
                descriptionNumberOfLines={2}
                left={renderSettingIcon(
                  '🔄',
                  'sync',
                  metricAccents.water.badgeBg ?? metricAccents.water.color,
                  metricAccents.water.onBadge,
                )}
                right={props => <RadioButton {...props} value="health_connect" />}
                onPress={() => setProvider('health_connect')}
              />
              {surfaces.groupedSettingsCards && <Divider style={styles.rowDivider} />}
              <List.Item
                title="Device Sensor Only"
                description="Bypass Health Connect. 100% private, tracks via hardware chip."
                descriptionNumberOfLines={2}
                left={renderSettingIcon(
                  '📱',
                  'device',
                  metricAccents.distance.badgeBg ?? metricAccents.distance.color,
                  metricAccents.distance.onBadge,
                )}
                right={props => <RadioButton {...props} value="device_sensor" />}
                onPress={() => setProvider('device_sensor')}
              />
            </RadioButton.Group>
          </List.Section>
        </SettingsSectionGroup>

        {!surfaces.groupedSettingsCards && <Divider style={styles.divider} />}

        <SettingsSectionGroup grouped={surfaces.groupedSettingsCards} surfaces={surfaces}>
          <List.Section style={surfaces.groupedSettingsCards ? styles.groupedListSection : undefined}>
            <List.Subheader>Physical Stats (Optional)</List.Subheader>
            <Text style={{ marginHorizontal: 16, marginBottom: 8, color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              Setting these enables accurate Basal Metabolic Rate (BMR) calculation for Total Calories.
            </Text>
            <List.Item
              title="Biological Sex"
              description="Used for BMR formula"
              left={renderSettingIcon(
                '🚻',
                'gender',
                metricAccents.steps.badgeBg ?? metricAccents.steps.color,
                metricAccents.steps.onBadge,
              )}
              right={() => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <RadioButton.Group onValueChange={value => setGender(value as any)} value={gender || ''}>
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                        <Text>Male</Text>
                        <RadioButton value="male" />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text>Female</Text>
                        <RadioButton value="female" />
                      </View>
                    </View>
                  </RadioButton.Group>
                </View>
              )}
            />
            {surfaces.groupedSettingsCards && <Divider style={styles.rowDivider} />}
            <List.Item
              title="Weight (kg)"
              left={renderSettingIcon(
                '⚖️',
                'weight',
                metricAccents.calories.badgeBg ?? metricAccents.calories.color,
                metricAccents.calories.onBadge,
              )}
              right={() => (
                <TextInput
                  mode="outlined"
                  keyboardType="numeric"
                  value={weightInput}
                  onChangeText={setWeightInput}
                  onBlur={handleSaveWeight}
                  style={styles.input}
                  dense
                  placeholder="e.g. 70"
                />
              )}
            />
            {surfaces.groupedSettingsCards && <Divider style={styles.rowDivider} />}
            <List.Item
              title="Height (cm)"
              left={renderSettingIcon(
                '📏',
                'height',
                metricAccents.distance.badgeBg ?? metricAccents.distance.color,
                metricAccents.distance.onBadge,
              )}
              right={() => (
                <TextInput
                  mode="outlined"
                  keyboardType="numeric"
                  value={heightInput}
                  onChangeText={setHeightInput}
                  onBlur={handleSaveHeight}
                  style={styles.input}
                  dense
                  placeholder="e.g. 175"
                />
              )}
            />
            {surfaces.groupedSettingsCards && <Divider style={styles.rowDivider} />}
            <List.Item
              title="Age (years)"
              left={renderSettingIcon(
                '🎂',
                'age',
                metricAccents.totalCalories.badgeBg ?? metricAccents.totalCalories.color,
                metricAccents.totalCalories.onBadge,
              )}
              right={() => (
                <TextInput
                  mode="outlined"
                  keyboardType="numeric"
                  value={ageInput}
                  onChangeText={setAgeInput}
                  onBlur={handleSaveAge}
                  style={styles.input}
                  dense
                  placeholder="e.g. 25"
                />
              )}
            />
          </List.Section>
        </SettingsSectionGroup>

        {!surfaces.groupedSettingsCards && <Divider style={styles.divider} />}

        <SettingsSectionGroup grouped={surfaces.groupedSettingsCards} surfaces={surfaces}>
          <List.Section style={surfaces.groupedSettingsCards ? styles.groupedListSection : undefined}>
            <List.Subheader>Goals</List.Subheader>
            <List.Item
              title="Daily Steps"
              description="Your target step count"
              left={renderSettingIcon(
                '👟',
                'steps_goal',
                metricAccents.steps.badgeBg ?? metricAccents.steps.color,
                metricAccents.steps.onBadge,
              )}
              right={() => (
                <TextInput
                  mode="outlined"
                  keyboardType="numeric"
                  value={stepInput}
                  onChangeText={setStepInput}
                  onBlur={handleSaveStepGoal}
                  style={styles.input}
                  dense
                />
              )}
            />
            {surfaces.groupedSettingsCards && <Divider style={styles.rowDivider} />}
            <List.Item
              title="Daily Distance (m)"
              description="Target distance in meters"
              left={renderSettingIcon(
                '📏',
                'distance_goal',
                metricAccents.distance.badgeBg ?? metricAccents.distance.color,
                metricAccents.distance.onBadge,
              )}
              right={() => (
                <TextInput
                  mode="outlined"
                  keyboardType="numeric"
                  value={distanceInput}
                  onChangeText={setDistanceInput}
                  onBlur={handleSaveDistanceGoal}
                  style={styles.input}
                  dense
                />
              )}
            />
            {surfaces.groupedSettingsCards && <Divider style={styles.rowDivider} />}
            <List.Item
              title="Custom Water Goal (ml)"
              description="Leave blank for auto-recommendation"
              left={renderSettingIcon(
                '💧',
                'water_goal',
                metricAccents.water.badgeBg ?? metricAccents.water.color,
                metricAccents.water.onBadge,
              )}
              right={() => (
                <TextInput
                  mode="outlined"
                  keyboardType="numeric"
                  value={waterInput}
                  onChangeText={setWaterInput}
                  onBlur={handleSaveWaterGoal}
                  style={styles.input}
                  dense
                  placeholder="e.g. 2500"
                />
              )}
            />
          </List.Section>
        </SettingsSectionGroup>
      </ScrollView>

      <Snackbar
        visible={restartBannerVisible}
        onDismiss={() => setRestartBannerVisible(false)}
        duration={3600}
        wrapperStyle={{ bottom: Math.max(insets.bottom + (hideDock ? 18 : 88), 24) }}
        action={{
          label: 'OK',
          onPress: () => setRestartBannerVisible(false),
        }}
      >
        Restart Ayumi to apply the new theme.
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  screenTitleText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  screenSubtitleText: {
    fontSize: 13.5,
    fontWeight: '500',
    marginTop: 2,
  },
  groupedListSection: {
    marginVertical: 2,
  },
  themeOptionsColumn: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  pendingHintText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
  },
  divider: {
    marginVertical: 8,
  },
  rowDivider: {
    marginHorizontal: 16,
  },
  input: {
    width: 100,
    height: 40,
    alignSelf: 'center',
    textAlign: 'center',
  },
});
