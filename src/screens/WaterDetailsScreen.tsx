import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Text, Surface, useTheme, Card, SegmentedButtons, FAB, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';

import { useWaterTracker } from '../hooks';
import type { HistoricalWaterData } from '../types/health';
import type { WaterLog } from '../hooks/useWaterTracker';
import { WaterLoggingModal } from '../components';
import { formatLocalDateKey } from '../utils/index';

export function WaterDetailsScreen() {
  const theme = useTheme();
  
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
  const [history, setHistory] = useState<HistoricalWaterData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<WaterLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);

  const { getHistoricalWater, getLogsForDate, loading, addWater, deleteWater, logs } = useWaterTracker();

  // For the activity breakdown, if we select a date, fetch the logs for that date.
  // If no date is selected, use the 'logs' array from useWaterTracker which is today's logs.
  useEffect(() => {
    let mounted = true;
    
    if (selectedDate) {
      getLogsForDate(selectedDate).then(data => {
        if (mounted) setDailyLogs(data);
      });
    } else {
      setDailyLogs(logs); // fallback to today
    }
    
    return () => { mounted = false; };
  }, [selectedDate, getLogsForDate, logs]);

  // Load history data
  useEffect(() => {
    let mounted = true;
    getHistoricalWater(timeRange).then(data => {
      if (mounted) setHistory(data);
    });
    return () => { mounted = false; };
  }, [timeRange, getHistoricalWater, logs]); // depend on 'logs' so chart updates if they log water today

  const screenWidth = Dimensions.get('window').width;

  const getPaddedHistory = () => {
    if (history.length === 0) return [];
    
    const result = [...history];
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 12;
    
    if (result.length < days) {
      const historyMap = new Map(result.map(d => [d.date, d]));
      const now = new Date();
      result.length = 0;
      
      if (timeRange === 'year') {
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          result.push(historyMap.get(key) || { date: key + '-01', water: 0 });
        }
      } else {
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          result.push(historyMap.get(key) || { date: key, water: 0 });
        }
      }
    }
    return result;
  };

  const paddedHistory = getPaddedHistory();
  const maxWater = Math.max(...paddedHistory.map(d => d.water), 0);
  
  const avgWater = paddedHistory.length > 0 
    ? Math.round(paddedHistory.reduce((sum, d) => sum + d.water, 0) / paddedHistory.length) 
    : 0;

  let yAxisMax = 3000;
  if (maxWater > 0) {
    yAxisMax = maxWater > 1000 ? Math.ceil(maxWater / 1000) * 1000 : Math.ceil(maxWater / 100) * 100;
  }

  const formatYLabel = (label: string) => {
    const num = parseInt(label, 10);
    if (isNaN(num)) return label;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}L`;
    return num.toString();
  };

  const chartWidth = screenWidth - 64;
  const numDays = timeRange === 'week' ? 7 : timeRange === 'year' ? 12 : 30;
  const barWidth = timeRange === 'month' ? 4 : 16;
  const labelSpace = timeRange === 'week' ? 30 : timeRange === 'year' ? 25 : 15;
  const totalBarSpace = numDays * barWidth;
  const remainingSpace = chartWidth - totalBarSpace - labelSpace;
  const calculatedSpacing = Math.max(remainingSpace / numDays, 2);

  const barData = paddedHistory.map((d, index) => {
    let label = '';
    const dateObj = new Date(d.date);
    
    if (timeRange === 'week') {
      label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dateObj.getDay()];
    } else if (timeRange === 'year') {
      label = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][dateObj.getMonth()];
    } else {
      label = (index % 5 === 0) ? dateObj.getDate().toString() : '';
    }

    const isSelected = selectedDate === d.date;

    return {
      value: d.water,
      label,
      frontColor: isSelected ? theme.colors.primary : theme.colors.primaryContainer,
      onPress: () => {
        setSelectedDate(isSelected ? null : d.date);
      }
    };
  });

  const selectedHistory = selectedDate ? history.find(h => h.date === selectedDate) : null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.header} elevation={0}>
          <Text style={{ fontSize: 32 }}>💧</Text>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Water
          </Text>
        </Surface>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <>
            <SegmentedButtons
              value={timeRange}
              onValueChange={(val) => {
                setTimeRange(val as any);
                setSelectedDate(null);
              }}
              buttons={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Daily' },
                { value: 'year', label: 'Month' },
              ]}
              style={styles.segmentedButton}
            />

            <Card style={styles.chartCard} mode="contained">
              <Card.Content>
                {paddedHistory.length > 0 && (
                  <BarChart
                    data={barData}
                    width={chartWidth}
                    height={200}
                    barWidth={barWidth}
                    spacing={calculatedSpacing}
                    initialSpacing={10}
                    yAxisLabelWidth={36}
                    labelWidth={timeRange === 'week' ? 30 : timeRange === 'year' ? 25 : 15}
                    xAxisLabelTextStyle={{ 
                      textAlign: 'center', 
                      fontSize: 10, 
                      marginLeft: (barWidth - (timeRange === 'week' ? 30 : timeRange === 'year' ? 25 : 15)) / 2 
                    }}
                    noOfSections={4}
                    disableScroll={true}
                    maxValue={yAxisMax}
                    formatYLabel={formatYLabel}
                    barBorderRadius={4}
                    yAxisThickness={0}
                    xAxisThickness={0}
                    rulesType="solid"
                    rulesColor={theme.colors.outlineVariant}
                    isAnimated
                  />
                )}
              </Card.Content>
            </Card>

            {selectedHistory && (
              <View style={styles.selectedContainer}>
                <Card style={styles.selectedCard} mode="contained">
                  <Card.Content>
                    <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                      {new Date(selectedDate!).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text variant="titleLarge" style={{ color: theme.colors.primary }}>
                      {selectedHistory.water} ml
                    </Text>
                  </Card.Content>
                </Card>
              </View>
            )}

            <View style={styles.statsRow}>
              <Card style={styles.statCard} mode="contained">
                <Card.Content>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Average
                  </Text>
                  <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                    {avgWater} ml
                  </Text>
                </Card.Content>
              </Card>
              <Card style={styles.statCard} mode="contained">
                <Card.Content>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {timeRange === 'year' ? 'Record Highest Month' : timeRange === 'month' ? 'Record Highest Day' : 'Record Highest Week'}
                  </Text>
                  <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                    {maxWater} ml
                  </Text>
                </Card.Content>
              </Card>
            </View>

            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {selectedDate 
                ? timeRange === 'year'
                  ? `Activity Breakdown (${new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`
                  : `Activity Breakdown (${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` 
                : 'Today\'s Logs'}
            </Text>
            
            {dailyLogs.length === 0 ? (
              <Card style={styles.activityCard} mode="contained">
                <Card.Content>
                  <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                    No water logged on this date.
                  </Text>
                </Card.Content>
              </Card>
            ) : (
              dailyLogs.map(log => (
                <Card key={log.id} style={styles.activityCard} mode="contained">
                  <Card.Content style={styles.activityRow}>
                    <View style={styles.activityLeft}>
                      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                        {log.amount} ml
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        Water Intake
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', flexDirection: 'row' }}>
                      <Text variant="bodyMedium" style={{ color: theme.colors.primary, marginRight: 8 }}>
                        {log.time}
                      </Text>
                      {/* Only allow deleting if it's today's log, as deleteWater only works on today's logs for now */}
                      {!selectedDate || selectedDate === formatLocalDateKey() ? (
                        <IconButton
                          icon={() => <Text style={{ fontSize: 16 }}>🗑️</Text>}
                          size={20}
                          onPress={() => deleteWater(log.id)}
                          style={{ margin: 0 }}
                        />
                      ) : null}
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}
            
            <View style={{ height: 80 }} />
          </>
        )}
      </ScrollView>

      <FAB
        icon={() => <Text style={{ fontSize: 18, textAlign: 'center' }}>➕</Text>}
        label="Log Water"
        style={[styles.fab, { backgroundColor: theme.colors.primaryContainer }]}
        onPress={() => setModalVisible(true)}
      />

      <WaterLoggingModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onAddWater={addWater}
        logs={logs}
        onDeleteWater={deleteWater}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  title: {
    fontWeight: '700',
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  segmentedButton: {
    marginBottom: 24,
  },
  chartCard: {
    marginBottom: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  selectedContainer: {
    marginBottom: 24,
  },
  selectedCard: {
    borderRadius: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 16,
  },
  activityCard: {
    marginBottom: 12,
    borderRadius: 16,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityLeft: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
