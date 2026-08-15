import React, { useState } from 'react';
import { View } from 'react-native';
import { Text, Button, Dialog, TextInput, useTheme, IconButton } from 'react-native-paper';

interface WaterLoggingModalProps {
  visible: boolean;
  onDismiss: () => void;
  onAddWater: (amount: number) => void;
  logs: Array<{ id: string; time: string; amount: number }>;
  onDeleteWater: (id: string) => void;
}

export function WaterLoggingModal({
  visible,
  onDismiss,
  onAddWater,
  logs,
  onDeleteWater,
}: WaterLoggingModalProps) {
  const theme = useTheme();
  const [customInput, setCustomInput] = useState('');

  const handleAddCustom = () => {
    const val = parseInt(customInput, 10);
    if (!isNaN(val) && val > 0) {
      onAddWater(val);
      setCustomInput('');
      onDismiss();
    }
  };

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: '80%' }}>
      <Dialog.Title>Log Water</Dialog.Title>
      <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
        <View style={{ padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Button mode="contained-tonal" onPress={() => { onAddWater(250); onDismiss(); }}>+ 250ml</Button>
            <Button mode="contained-tonal" onPress={() => { onAddWater(500); onDismiss(); }}>+ 500ml</Button>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <TextInput
              mode="outlined"
              label="Custom (ml)"
              keyboardType="numeric"
              value={customInput}
              onChangeText={setCustomInput}
              style={{ flex: 1, marginRight: 8, height: 48 }}
              dense
            />
            <Button mode="contained" onPress={handleAddCustom}>Add</Button>
          </View>

          <Text variant="titleMedium" style={{ marginBottom: 8 }}>Today's Logs</Text>
          {logs.length === 0 ? (
            <Text style={{ textAlign: 'center', marginVertical: 16, color: theme.colors.outline }}>No water logged yet today.</Text>
          ) : (
            logs.map(log => (
              <View key={log.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text variant="bodyLarge">{log.amount} ml</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline, marginLeft: 8 }}>{log.time}</Text>
                </View>
                <IconButton icon={() => <Text style={{ fontSize: 16 }}>🗑️</Text>} onPress={() => onDeleteWater(log.id)} />
              </View>
            ))
          )}
        </View>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Close</Button>
      </Dialog.Actions>
    </Dialog>
  );
}
