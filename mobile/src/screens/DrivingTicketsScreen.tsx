import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  DrivingMode,
  DrivingTestResult,
  DrivingTicket,
  getDrivingResults,
  getDrivingTickets,
} from '../api/driving';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList, 'DrivingTickets'> };

const runModes: Array<{ mode: Exclude<DrivingMode, 'marathon'>; label: string }> = [
  { mode: 'exam', label: 'Экзамен' },
  { mode: 'practice', label: 'Тренировка' },
];

export default function DrivingTicketsScreen({ navigation }: Props) {
  const [tickets, setTickets] = useState<DrivingTicket[]>([]);
  const [results, setResults] = useState<DrivingTestResult[]>([]);
  const [mode, setMode] = useState<Exclude<DrivingMode, 'marathon'>>('exam');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [ticketData, resultData] = await Promise.all([
        getDrivingTickets(),
        getDrivingResults({ limit: 50 }).catch(() => []),
      ]);
      setTickets(ticketData);
      setResults(resultData);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const passedTickets = useMemo(() => {
    const set = new Set<number>();
    results.forEach((result) => {
      if (result.passed) (result.ticketNumbers || []).forEach((n) => set.add(n));
    });
    return set;
  }, [results]);

  const data = tickets.length ? tickets : Array.from({ length: 40 }, (_, i) => ({ number: i + 1, totalQuestions: 20 }));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.text} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.modeSwitch}>
        {runModes.map((item) => {
          const active = mode === item.mode;
          return (
            <TouchableOpacity
              key={item.mode}
              style={[styles.modeChip, active && styles.modeChipActive]}
              onPress={() => setMode(item.mode)}
              activeOpacity={0.85}
            >
              <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Нажмите на билет, чтобы пройти его в режиме «{mode === 'exam' ? 'Экзамен' : 'Тренировка'}».
      </Text>

      <FlatList
        data={data}
        keyExtractor={(item) => String(item.number)}
        numColumns={5}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const passed = passedTickets.has(item.number);
          return (
            <TouchableOpacity
              style={[styles.ticket, passed && styles.ticketPassed]}
              onPress={() => navigation.navigate('DrivingQuiz', { mode, ticketNumber: item.number })}
              activeOpacity={0.85}
            >
              {passed ? (
                <Ionicons name="checkmark" size={13} color={colors.success} style={styles.ticketCheck} />
              ) : null}
              <Text style={styles.ticketNumber}>{item.number}</Text>
              <Text style={styles.ticketCount}>{item.totalQuestions || 20}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  modeSwitch: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  modeChip: { flex: 1, height: 40, borderRadius: 999, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  modeChipActive: { backgroundColor: colors.accent },
  modeChipText: { color: colors.textMuted, fontSize: 14, fontWeight: '900' },
  modeChipTextActive: { color: colors.onAccent },
  hint: { color: colors.textMuted, fontSize: 12, fontWeight: '700', paddingHorizontal: 16, paddingTop: 10 },
  grid: { padding: 16, paddingBottom: 28 },
  row: { gap: 8, marginBottom: 8 },
  ticket: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ticketPassed: { borderColor: colors.success },
  ticketCheck: { position: 'absolute', top: 5, right: 6 },
  ticketNumber: { color: colors.text, fontSize: 17, fontWeight: '900' },
  ticketCount: { marginTop: 2, color: colors.textFaint, fontSize: 10, fontWeight: '800' },
});
