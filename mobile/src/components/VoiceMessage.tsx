import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors } from '../theme';

interface Props {
  uri: string;
  mine?: boolean;
}

const formatDuration = (seconds: number) => {
  if (!seconds || Number.isNaN(seconds) || !Number.isFinite(seconds)) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function VoiceMessage({ uri, mine }: Props) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const playing = status.playing;
  const duration = status.duration || 0;
  const current = status.currentTime || 0;
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  const toggle = () => {
    if (playing) {
      player.pause();
    } else {
      // Restart when finished
      if (duration > 0 && current >= duration - 0.15) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const tint = mine ? colors.onAccent : colors.text;
  const track = mine ? 'rgba(11,11,14,0.25)' : 'rgba(255,255,255,0.18)';

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.playBtn} onPress={toggle} activeOpacity={0.8}>
        <Ionicons name={playing ? 'pause' : 'play'} size={20} color={tint} />
      </TouchableOpacity>
      <View style={styles.body}>
        <View style={[styles.track, { backgroundColor: track }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: tint }]} />
        </View>
        <Text style={[styles.time, { color: tint }]}>
          {formatDuration(playing || current > 0 ? current : duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 170, paddingVertical: 2 },
  playBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  time: { fontSize: 11, fontWeight: '700', marginTop: 5 },
});
