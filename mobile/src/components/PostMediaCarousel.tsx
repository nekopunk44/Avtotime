import React, { useRef, useState } from 'react';
import {
  Animated,
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
import PagerDots from './ui/PagerDots';

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
  // Сырое положение ленты кадров — им живут перетекающие точки.
  const scrollX = useRef(new Animated.Value(0)).current;
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
      <Animated.FlatList
        data={items}
        keyExtractor={(uri: string, i: number) => `${uri}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: onScroll },
        )}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.95} onPress={() => setViewerUri(item)}>
            <Image source={{ uri: item }} style={{ width: screenWidth, height: mediaHeight }} resizeMode="cover" />
          </TouchableOpacity>
        )}
      />
      <PagerDots count={items.length} scrollX={scrollX} slideWidth={screenWidth} style={styles.dots} />
      {viewer}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0 },
});
