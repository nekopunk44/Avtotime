import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AudioRecorder, useAudioRecorderState } from 'expo-audio';
import { colors, radius } from '../theme';

const BARS = 26;
const POLL_MS = 90;
const MIN_H = 3;
const MAX_H = 22;
// Тише этого порога звук считается тишиной: metering приходит в дБFS, где 0 —
// перегрузка, а −60 уже неотличимо от фонового шума.
const FLOOR_DB = -55;

/** Уровень 0..1 из дБFS. Без метеринга линия должна дышать, а не лежать. */
export function meterToLevel(metering: number | undefined, tick: number) {
  if (metering === undefined || Number.isNaN(metering)) {
    return 0.28 + 0.16 * Math.sin(tick / 2);
  }
  const clamped = Math.max(FLOOR_DB, Math.min(0, metering));
  const linear = (clamped - FLOOR_DB) / -FLOOR_DB;
  // Корень поднимает тихую речь: в линейной шкале обычный голос жмётся ко дну.
  return Math.max(0, Math.min(1, Math.sqrt(linear)));
}

interface Props {
  recorder: AudioRecorder;
}

/**
 * Живая линия голоса в строке записи: без неё непонятно, слышит ли телефон
 * что-нибудь вообще. Столбики едут справа налево — правый край это «сейчас».
 */
export default function VoiceWave({ recorder }: Props) {
  const state = useAudioRecorderState(recorder, POLL_MS);
  const [levels, setLevels] = useState<number[]>(() => new Array(BARS).fill(0));
  const tickRef = useRef(0);

  useEffect(() => {
    tickRef.current += 1;
    const level = meterToLevel(state.metering, tickRef.current);
    setLevels((prev) => [...prev.slice(1), level]);
    // Каждый ответ опроса — новый кадр линии, даже если громкость не изменилась.
  }, [state.metering, state.durationMillis]);

  return (
    <View style={styles.wave}>
      {levels.map((level, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              height: MIN_H + level * (MAX_H - MIN_H),
              // Старые столбики бледнее — видно, куда течёт время.
              opacity: 0.35 + 0.65 * (index / (BARS - 1)),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: MAX_H },
  bar: { flex: 1, marginHorizontal: 1, borderRadius: radius.pill, backgroundColor: colors.text },
});
