import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import ImageViewer from './ImageViewer';

interface Props {
  media: string;
  mediaList?: string[];
  mediaType?: 'image' | 'video';
  width?: number;
  height?: number;
}

function VideoSlide({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
  });

  return (
    <VideoView
      player={player}
      style={{ width, height }}
      nativeControls
      contentFit="contain"
      allowsPictureInPicture={false}
      surfaceType="textureView"
    />
  );
}

export default function PostMediaCarousel({ media, mediaList, mediaType, width, height }: Props) {
  const screenWidth = width ?? Dimensions.get('window').width;
  const mediaHeight = height ?? screenWidth;
  const [index, setIndex] = useState(0);
  const [viewerUri, setViewerUri] = useState<string | undefined>();

  const items = (mediaList && mediaList.length ? mediaList : media ? [media] : []).filter(Boolean);
  if (!items.length) return null;

  // A single video post
  if (mediaType === 'video') {
    return (
      <View style={{ backgroundColor: '#000' }}>
        <VideoSlide uri={items[0]} width={screenWidth} height={mediaHeight} />
      </View>
    );
  }

  const viewer = (
    <ImageViewer uri={viewerUri} visible={!!viewerUri} onClose={() => setViewerUri(undefined)} />
  );

  // A single image — no need for a scroll view
  if (items.length === 1) {
    return (
      <>
        <TouchableOpacity activeOpacity={0.95} onPress={() => setViewerUri(items[0])}>
          <Image source={{ uri: items[0] }} style={{ width: screenWidth, height: mediaHeight }} resizeMode="cover" />
        </TouchableOpacity>
        {viewer}
      </>
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (next !== index) setIndex(next);
  };

  return (
    <View>
      <FlatList
        data={items}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.95} onPress={() => setViewerUri(item)}>
            <Image source={{ uri: item }} style={{ width: screenWidth, height: mediaHeight }} resizeMode="cover" />
          </TouchableOpacity>
        )}
      />
      <View style={styles.dots}>
        {items.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      {viewer}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 7, height: 7, borderRadius: 3.5 },
});
