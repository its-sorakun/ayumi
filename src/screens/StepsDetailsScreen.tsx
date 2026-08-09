import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Surface, useTheme, Card, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';

import { healthService } from '../services';
import { useHealthData } from '../hooks';
import type { HistoricalStepData, ExerciseSessionData } from '../types/health';

export function StepsDetailsScreen() {
  const theme = useTheme();
  const { providerStatus, providerName } = useHealthData();
  
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoricalStepData[]>([]);
  const [sessions, setSessions] = useState<ExerciseSessionData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    // Reset selected date to today when time range changes
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, [timeRange]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const hist = await healthService.getHistoricalSteps(timeRange);
        const sess = await healthService.getExerciseSessions(timeRange);
        if (mounted) {
          setHistory(hist as HistoricalStepData[]);
          setSessions(sess as ExerciseSessionData[]);
        }
      } catch (err) {
        console.warn(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (providerStatus === 'available') {
      loadData();
    } else {
      setLoading(false);
    }
    return () => { mounted = false; };
  }, [timeRange, providerStatus]);

  const maxSteps = Math.max(...history.map(d => d.steps), 0);
  const avgSteps = history.length > 0 
    ? Math.round(history.reduce((sum, d) => sum + d.steps, 0) / history.length) 
    : 0;

  let yAxisMax = 100;
  if (maxSteps > 0) {
    yAxisMax = maxSteps > 1000 ? Math.ceil(maxSteps / 1000) * 1000 : Math.ceil(maxSteps / 100) * 100;
  }

  const formatYLabel = (label: string) => {
    const num = parseInt(label, 10);
    if (isNaN(num)) return label;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toString();
  };

  const chartData = history.map((d, index) => {
    const isToday = timeRange === 'year' 
      ? new Date().toISOString().split('T')[0].substring(0,7) === d.date.substring(0,7)
      : new Date().toISOString().split('T')[0] === d.date;
    
    const isSelected = timeRange === 'year' && selectedDate
      ? selectedDate.substring(0,7) === d.date.substring(0,7)
      : selectedDate === d.date;

    const dateObj = new Date(d.date);
    
    // Gifted charts label
    let label = '';
    if (timeRange === 'week') {
      const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      label = weekDays[dateObj.getDay()];
    } else if (timeRange === 'year') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      label = monthNames[dateObj.getMonth()];
    } else {
      // For month, show label on first, last, and every 5th day
      if (index === 0 || index === history.length - 1 || index % 5 === 0) {
        label = dateObj.getDate().toString();
      }
    }
    return {
      value: d.steps,
      label,
      frontColor: isSelected || isToday ? theme.colors.primary : theme.colors.primaryContainer,
      onPress: () => setSelectedDate(d.date),
    };
  });

  const filteredSessions = selectedDate 
    ? timeRange === 'year'
      ? sessions.filter(s => s.date?.startsWith(selectedDate.substring(0, 7)))
      : sessions.filter(s => s.date === selectedDate)
    : sessions;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.header} elevation={0}>
          <Text style={{ fontSize: 32 }}>👟</Text>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Steps
          </Text>
        </Surface>

        <SegmentedButtons
          value={timeRange}
          onValueChange={(val) => setTimeRange(val as 'week' | 'month' | 'year')}
          buttons={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Daily' },
            { value: 'year', label: 'Month' },
          ]}
          style={styles.segmentedButton}
        />

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <>
            <Card style={styles.chartCard} mode="contained">
              <Card.Content>
                {history.length === 0 && providerName === 'Device Sensor' && (
                  <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    Historical data is building up. Check back tomorrow!
                  </Text>
                )}
                {history.length > 0 && (
                  <BarChart
                    data={chartData}
                    width={280}
                    height={200}
                    barWidth={timeRange === 'week' ? 22 : timeRange === 'year' ? 14 : 6}
                    spacing={timeRange === 'week' ? 16 : timeRange === 'year' ? 8 : 2}
                    labelWidth={timeRange === 'week' ? 30 : timeRange === 'year' ? 25 : 20}
                    xAxisLabelTextStyle={{ textAlign: 'center', fontSize: 10, width: 30 }}
                    noOfSections={4}
                    maxValue={yAxisMax}
                    formatYLabel={formatYLabel}
                    barBorderRadius={4}
                    yAxisThickness={0}
                    xAxisThickness={0}
                    hideRules
                    isAnimated
                  />
                )}
              </Card.Content>
            </Card>

            <View style={styles.statsRow}>
              <Card style={styles.statCard} mode="contained">
                <Card.Content>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Average
                  </Text>
                  <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                    {avgSteps.toLocaleString()}
                  </Text>
                </Card.Content>
              </Card>
              <Card style={styles.statCard} mode="contained">
                <Card.Content>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Highest
                  </Text>
                  <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                    {maxSteps.toLocaleString()}
                  </Text>
                </Card.Content>
              </Card>
            </View>

            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {selectedDate 
                ? timeRange === 'year'
                  ? `Activity Breakdown (${new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`
                  : `Activity Breakdown (${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` 
                : 'Activity Breakdown'}
            </Text>
            
            {providerName === 'Device Sensor' || providerName === 'Software Pedometer' ? (
              <Card style={styles.activityCard} mode="contained">
                <Card.Content>
                  <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                    Activity categorization requires Health Connect.
                  </Text>
                </Card.Content>
              </Card>
            ) : filteredSessions.length === 0 ? (
              <Card style={styles.activityCard} mode="contained">
                <Card.Content>
                  <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                    No activities recorded {selectedDate ? 'on this date' : 'in this period'}.
                  </Text>
                </Card.Content>
              </Card>
            ) : (
              filteredSessions.map((sess, idx) => (
                <Card key={idx} style={styles.activityCard} mode="contained">
                  <Card.Content style={styles.activityRow}>
                    <View style={styles.activityLeft}>
                      <Text variant="titleMedium" style={{ color: theme.colors.onSurface, textTransform: 'capitalize' }}>
                        {sess.type}
                      </Text>
                      {sess.steps && sess.steps > 0 ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {sess.steps.toLocaleString()} steps
                        </Text>
                      ) : null}
                    </View>
                    <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                      {Math.round(sess.durationMinutes)} min
                    </Text>
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
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
    marginLeft: 12,
    fontWeight: 'bold',
  },
  segmentedButton: {
    marginBottom: 24,
  },
  loader: {
    marginTop: 48,
  },
  chartCard: {
    marginBottom: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 48,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    marginLeft: 4,
  },
  activityCard: {
    marginBottom: 8,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityLeft: {
    flexDirection: 'column',
  },
});
