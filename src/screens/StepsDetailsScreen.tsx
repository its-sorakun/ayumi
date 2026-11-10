import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Text, Surface, useTheme, Card, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';

import { healthService } from '../services';
import { useHealthData } from '../hooks';
import type { HistoricalStepData, ExerciseSessionData } from '../types/health';
import { formatDistance, formatLocalDateKey } from '../utils/index';

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
    setSelectedDate(formatLocalDateKey());
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

  const paddedHistory = React.useMemo(() => {
    if (!history) return [];
    const now = new Date();
    const result = [];
    const historyMap = new Map(history.map(d => [d.date.substring(0, timeRange === 'year' ? 7 : 10), d]));

    const formatMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (timeRange === 'year') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = formatMonth(d);
        result.push(historyMap.get(key) || { date: key + '-01', steps: 0 });
      }
    } else {
      const days = timeRange === 'week' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = formatDate(d);
        result.push(historyMap.get(key) || { date: key, steps: 0 });
      }
    }
    return result;
  }, [history, timeRange]);

  const maxSteps = Math.max(...paddedHistory.map(d => d.steps), 0);
  const avgSteps = paddedHistory.length > 0 
    ? Math.round(paddedHistory.reduce((sum, d) => sum + d.steps, 0) / paddedHistory.length) 
    : 0;

  let yAxisMax = 100;
  if (maxSteps > 0) {
    yAxisMax = maxSteps > 1000 ? Math.ceil(maxSteps / 1000) * 1000 : Math.ceil(maxSteps / 100) * 100;
  }

  const chartWidth = Dimensions.get('window').width - 110;
  const barWidth = timeRange === 'week' ? 22 : timeRange === 'year' ? 14 : 6;
  const dataLength = timeRange === 'week' ? 7 : timeRange === 'year' ? 12 : 30;
  const calculatedSpacing = Math.max(2, (chartWidth - (barWidth * dataLength) - 10) / dataLength);

  const formatYLabel = (label: string) => {
    const num = parseInt(label, 10);
    if (isNaN(num)) return label;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toString();
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const chartData = paddedHistory.map((d, index) => {
    const todayKey = formatLocalDateKey();
    const isToday = timeRange === 'year' 
      ? todayKey.substring(0,7) === d.date.substring(0,7)
      : todayKey === d.date;
    
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
      if (index === 0 || index === paddedHistory.length - 1 || index % 5 === 0) {
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

  const groupedSessions = React.useMemo(() => {
    const groups: Record<string, typeof filteredSessions> = {};
    filteredSessions.forEach(session => {
      const dateKey = session.date || '';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(session);
    });
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({
        date,
        sessions: groups[date],
      }));
  }, [filteredSessions]);

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
                {paddedHistory.length === 0 && providerName === 'Device Sensor' && (
                  <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    Historical data is building up. Check back tomorrow!
                  </Text>
                )}
                {paddedHistory.length > 0 && (
                  <BarChart
                    data={chartData}
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
                    hideRules
                    isAnimated
                  />
                )}
              </Card.Content>
            </Card>

            {timeRange === 'month' && selectedDate && (() => {
              const selectedHistory = paddedHistory.find(d => d.date === selectedDate);
              if (!selectedHistory) return null;
              return (
                <Card style={[styles.statCard, { marginBottom: 16, width: '100%' }]} mode="contained">
                  <Card.Content>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text variant="titleLarge" style={{ color: theme.colors.primary }}>
                      {selectedHistory.steps.toLocaleString()} steps
                    </Text>
                  </Card.Content>
                </Card>
              );
            })()}

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
                    {timeRange === 'year' ? 'Record Highest Month' : timeRange === 'month' ? 'Record Highest Day' : 'Record Highest Week'}
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
            ) : groupedSessions.length === 0 ? (
              <Card style={styles.activityCard} mode="contained">
                <Card.Content>
                  <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                    No activities recorded {selectedDate ? 'on this date' : 'in this period'}.
                  </Text>
                </Card.Content>
              </Card>
            ) : (
              groupedSessions.map((group) => (
                <View key={group.date} style={{ marginBottom: 16 }}>
                  {group.date && (
                    <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 8, marginLeft: 4 }}>
                      {new Date(group.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  )}
                  {group.sessions.map((sess, idx) => (
                    <Card key={idx} style={styles.activityCard} mode="contained">
                      <Card.Content style={styles.activityRow}>
                        <View style={styles.activityLeft}>
                          <Text variant="titleMedium" numberOfLines={2} style={{ color: theme.colors.onSurface, textTransform: 'capitalize' }}>
                            {sess.type}
                          </Text>
                          {sess.steps && sess.steps > 0 ? (
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              {sess.steps.toLocaleString()} steps
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
                            {sess.startTime && sess.endTime 
                              ? `${formatTime(sess.startTime)} - ${formatTime(sess.endTime)}` 
                              : `${Math.round(sess.durationMinutes)} min`}
                          </Text>
                          {sess.startTime && sess.endTime && (
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                              {Math.round(sess.durationMinutes)} min
                            </Text>
                          )}
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
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
    flex: 1,
    flexDirection: 'column',
    marginRight: 16,
  },
});
