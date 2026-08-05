import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, useTheme, RadioButton, List, Divider, TextInput } from 'react-native-paper';
import { useSettings } from '../contexts/SettingsContext';

export function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { 
    theme: currentTheme, provider: currentProvider, stepGoal, distanceGoal, 
    gender, weight, height, age, customWaterGoal,
    setTheme, setProvider, setStepGoal, setDistanceGoal,
    setGender, setWeight, setHeight, setAge, setCustomWaterGoal
  } = useSettings();

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
      setStepInput(stepGoal.toString()); // Revert to valid number
    }
  };

  const handleSaveDistanceGoal = () => {
    const val = parseInt(distanceInput, 10);
    if (!isNaN(val) && val > 0) {
      setDistanceGoal(val);
    } else {
      setDistanceInput(distanceGoal.toString()); // Revert to valid number
    }
  };

  const handleSaveWaterGoal = () => {
    const val = parseInt(waterInput, 10);
    if (!isNaN(val) && val > 0) {
      setCustomWaterGoal(val);
    } else {
      setWaterInput('');
      setCustomWaterGoal(null); // Revert to auto-calculated if cleared or invalid
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
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.colors.background }]} 
        contentContainerStyle={{ paddingBottom: 300 }}
        automaticallyAdjustKeyboardInsets
      >
        
        <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <RadioButton.Group onValueChange={value => setTheme(value as any)} value={currentTheme}>
          <List.Item
            title="System Auto"
            description="Follow device theme"
            left={props => <List.Icon {...props} icon={() => <Text>⚙️</Text>} />}
            right={props => <RadioButton {...props} value="auto" />}
            onPress={() => setTheme('auto')}
          />
          <List.Item
            title="Light Mode"
            left={props => <List.Icon {...props} icon={() => <Text>☀️</Text>} />}
            right={props => <RadioButton {...props} value="light" />}
            onPress={() => setTheme('light')}
          />
          <List.Item
            title="Dark Mode"
            left={props => <List.Icon {...props} icon={() => <Text>🌙</Text>} />}
            right={props => <RadioButton {...props} value="dark" />}
            onPress={() => setTheme('dark')}
          />
        </RadioButton.Group>
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader>Data Source</List.Subheader>
        <RadioButton.Group onValueChange={value => setProvider(value as any)} value={currentProvider}>
          <List.Item
            title="Google Health Connect"
            description="Syncs history with other fitness apps (Recommended)"
            descriptionNumberOfLines={2}
            left={props => <List.Icon {...props} icon={() => <Text>🔄</Text>} />}
            right={props => <RadioButton {...props} value="health_connect" />}
            onPress={() => setProvider('health_connect')}
          />
          <List.Item
            title="Device Sensor Only"
            description="Bypass Health Connect. 100% private, tracks via hardware chip."
            descriptionNumberOfLines={2}
            left={props => <List.Icon {...props} icon={() => <Text>📱</Text>} />}
            right={props => <RadioButton {...props} value="device_sensor" />}
            onPress={() => setProvider('device_sensor')}
          />
        </RadioButton.Group>
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader>Physical Stats (Optional)</List.Subheader>
        <Text style={{ marginHorizontal: 16, marginBottom: 8, color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
          Setting these enables accurate Basal Metabolic Rate (BMR) calculation for Total Calories.
        </Text>
        <List.Item
          title="Biological Sex"
          description="Used for BMR formula"
          left={props => <List.Icon {...props} icon={() => <Text>🚻</Text>} />}
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
        <List.Item
          title="Weight (kg)"
          left={props => <List.Icon {...props} icon={() => <Text>⚖️</Text>} />}
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
        <List.Item
          title="Height (cm)"
          left={props => <List.Icon {...props} icon={() => <Text>📏</Text>} />}
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
        <List.Item
          title="Age (years)"
          left={props => <List.Icon {...props} icon={() => <Text>🎂</Text>} />}
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

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader>Goals</List.Subheader>
        <List.Item
          title="Daily Steps"
          description="Your target step count"
          left={props => <List.Icon {...props} icon={() => <Text>👟</Text>} />}
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
        <List.Item
          title="Daily Distance (m)"
          description="Target distance in meters"
          left={props => <List.Icon {...props} icon={() => <Text>📏</Text>} />}
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
        <List.Item
          title="Custom Water Goal (ml)"
          description="Leave blank for auto-recommendation"
          left={props => <List.Icon {...props} icon={() => <Text>💧</Text>} />}
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  divider: {
    marginVertical: 8,
  },
  input: {
    width: 100,
    height: 40,
    alignSelf: 'center',
    textAlign: 'center',
  },
});
