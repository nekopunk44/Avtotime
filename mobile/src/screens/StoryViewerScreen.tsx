import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Story, viewStory } from '../api/stories';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, 'StoryViewer'>;
  route: RouteProp<AppStackParamList, 'StoryViewer'>;
};

const STORY_DURATION_MS = 15000;

export default function StoryViewerScreen({ navigation, route }: Props) {
  const [story, setStory] = useState<Story>(route.params.story);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [muted, setMuted] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isMine = user?.userName === story.author?.userName;
  const isVideo = story.mediaType === 'video';

  const player = useVideoPlayer(isVideo ? story.media : null, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = false;
    videoPlayer.timeUpdateEventInterval = 0.2;
    videoPlayer.play();
  });

  useEffect(() => {
    viewStory(story._id).then(setStory).catch(() => {});
  }, [story._id]);

  // Image stories advance on a fixed timer
  useEffect(() => {
    if (isVideo) return;

    const tickMs = 150;
    const id = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (tickMs / STORY_DURATION_MS) * 100;
        if (next >= 100) {
          clearInterval(id);
          navigation.goBack();
          return 100;
        }
        return next;
      });
    }, tickMs);

    return () => clearInterval(id);
  }, [navigation, isVideo]);

  // Video stories drive progress from playback and close when finished
  useEffect(() => {
    if (!isVideo) return;

    const timeSub = (player as any).addListener?.('timeUpdate', ({ currentTime }: { currentTime: number }) => {
      const duration = player.duration || 0;
      setProgress(duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0);
    });
    const endSub = (player as any).addListener?.('playToEnd', () => {
      navigation.goBack();
    });

    return () => {
      timeSub?.remove?.();
      endSub?.remove?.();
    };
  }, [isVideo, player, navigation]);

  useEffect(() => {
    if (isVideo) player.muted = muted;
  }, [muted, isVideo, player]);

  const viewers = useMemo(() => Array.isArray(story.viewers) ? story.viewers : [], [story.viewers]);

  return (
    <View style={styles.container}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Image
          source={story.author?.profileImage ? { uri: story.author.profileImage } : require('../../assets/icon.png')}
          style={styles.avatar}
        />
        <View style={styles.authorTextWrap}>
          <Text style={styles.authorName} numberOfLines={1}>{story.author?.name || story.author?.userName}</Text>
          <Text style={styles.authorUserName} numberOfLines={1}>@{story.author?.userName}</Text>
        </View>
        {isVideo ? (
          <TouchableOpacity style={styles.soundBtn} onPress={() => setMuted((prev) => !prev)}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.mediaWrap}>
        {isVideo ? (
          <VideoView
            player={player}
            style={styles.media}
            nativeControls={false}
            contentFit="contain"
            allowsPictureInPicture={false}
            surfaceType="textureView"
          />
        ) : (
          <Image source={{ uri: story.media }} style={styles.media} resizeMode="contain" />
        )}
      </View>

      {isMine ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.viewersButton} onPress={() => setShowViewers((prev) => !prev)}>
            <Ionicons name="eye-outline" size={19} color="#fff" />
            <Text style={styles.viewersText}>{viewers.length}</Text>
            <Text style={styles.viewersLabel}>просмотров</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showViewers ? (
        <View style={styles.viewersPanel}>
          <View style={styles.viewersHeader}>
            <Text style={styles.viewersTitle}>Просмотры</Text>
            <TouchableOpacity onPress={() => setShowViewers(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          {viewers.length ? (
            <FlatList
              data={viewers}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <View style={styles.viewerRow}>
                  <Image
                    source={item.profileImage ? { uri: item.profileImage } : require('../../assets/icon.png')}
                    style={styles.viewerAvatar}
                  />
                  <View>
                    <Text style={styles.viewerName}>{item.name || item.userName}</Text>
                    <Text style={styles.viewerUserName}>@{item.userName}</Text>
                  </View>
                </View>
              )}
            />
          ) : (
            <View style={styles.emptyViewers}>
              <ActivityIndicator color={colors.text} />
              <Text style={styles.emptyText}>Пока нет просмотров</Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  progressTrack: { position: 'absolute', top: 8, left: 8, right: 8, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', zIndex: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.surface },
  topBar: { position: 'absolute', top: 22, left: 10, right: 10, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333' },
  authorTextWrap: { flex: 1 },
  authorName: { color: '#fff', fontSize: 15, fontWeight: '900' },
  authorUserName: { color: '#ddd', fontSize: 12, fontWeight: '700', marginTop: 1 },
  soundBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  mediaWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  media: { width: '100%', height: '78%' },
  bottomBar: { position: 'absolute', bottom: 18, left: 14, right: 14 },
  viewersButton: { alignSelf: 'flex-start', height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13 },
  viewersText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  viewersLabel: { color: '#fff', fontWeight: '700', fontSize: 13 },
  viewersPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '52%', backgroundColor: colors.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: 12 },
  viewersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  viewersTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  viewerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceAlt },
  viewerName: { color: colors.text, fontWeight: '900', fontSize: 14 },
  viewerUserName: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  emptyViewers: { padding: 24, alignItems: 'center' },
  emptyText: { marginTop: 8, color: colors.textMuted, fontSize: 13, fontWeight: '700' },
});
