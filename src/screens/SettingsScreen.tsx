import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, useTheme, RadioButton, List, Divider, TextInput } from 'react-native-paper';
import { useSettings } from '../contexts/SettingsContext';

export function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { theme: currentTheme, provider: currentProvider, stepGoal, distanceGoal, setTheme, setProvider, setStepGoal, setDistanceGoal } = useSettings();

  const [stepInput, setStepInput] = useState(stepGoal.toString());
  const [distanceInput, setDistanceInput] = useState(distanceGoal.toString());

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
