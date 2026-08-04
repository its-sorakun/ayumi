import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, RadioButton, List, Divider } from 'react-native-paper';
import { useSettings } from '../contexts/SettingsContext';

export function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { theme: currentTheme, provider: currentProvider, setTheme, setProvider } = useSettings();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
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
});
