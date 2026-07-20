import React, { useState, useCallback } from 'react';
import {
  FlatList, View, Text, Image, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { deletePost, getFeed, getVideoPoster, isPostSaved, toggleLike, Post, toggleSavePost } from '../api/posts';
import { getStories, getStoryByUserName, Story, uploadStory } from '../api/stories';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

export default function FeedScreen({ navigation }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const loadFeed = useCallback(async () => {
    try {
      const [postData, followingStories, myStory] = await Promise.all([
        getFeed(),
        getStories().catch(() => []),
        user?.userName ? getStoryByUserName(user.userName).catch(() => null) : Promise.resolve(null),
      ]);

      const storyMap = new Map<string, Story>();
      if (myStory) storyMap.set(myStory._id, myStory);
      followingStories.forEach((story) => storyMap.set(story._id, story));

      setPosts(postData);
      setStories(Array.from(storyMap.values()));
    } catch (e) {
      console.error('Feed error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.userName]);

  useFocusEffect(useCallback(() => {
    loadFeed();
  }, [loadFeed]));

  const pickAndUploadStory = async (mediaType: 'image' | 'video') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ к галерее', 'Разрешите доступ к медиатеке, чтобы загрузить историю.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });

    if (result.canceled) return;

    setUploadingStory(true);
    try {
      const story = await uploadStory(result.assets[0].uri, mediaType);
      setStories((prev) => [story, ...prev.filter((item) => item._id !== story._id)]);
      navigation.navigate('StoryViewer', { story });
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось загрузить историю');
    } finally {
      setUploadingStory(false);
    }
  };

  const uploadStoryPrompt = () => {
    Alert.alert('Новая история', 'Что хотите опубликовать?', [
      { text: 'Фото', onPress: () => pickAndUploadStory('image') },
      { text: 'Видео', onPress: () => pickAndUploadStory('video') },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const handleLike = async (postId: string) => {
    try {
      const updated = await toggleLike(postId);
      setPosts((prev) => prev.map((p) => p._id === postId ? { ...p, ...updated } : p));
    } catch {}
  };

  const handleSave = async (postId: string) => {
    if (!user) return;
    try {
      const nextUser = await toggleSavePost(postId);
      setUser({ ...user, saved: nextUser.saved ?? [] });
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось сохранить публикацию');
    }
  };

  const removePost = (post: Post) => {
    Alert.alert('Удалить публикацию?', 'Публикация исчезнет из вашей ленты и профиля.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post._id);
            setPosts((prev) => prev.filter((item) => item._id !== post._id));
          } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось удалить публикацию');
          }
        },
      },
    ]);
  };

  const openPostActions = (post: Post) => {
    Alert.alert('Публикация', post.caption || 'Действия с публикацией', [
      { text: 'Редактировать', onPress: () => navigation.navigate('EditPost', { post }) },
      { text: 'Удалить', style: 'destructive', onPress: () => removePost(post) },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const renderPost = ({ item }: { item: Post }) => {
    const liked = user ? item.likes.includes(user._id) : false;
    const saved = isPostSaved(user, item._id);
    const isMine = item.author?._id === user?._id;
    const avatar = item.author?.profileImage
      ? { uri: item.author.profileImage }
      : require('../../assets/icon.png');
    const firstMedia = item.mediaList?.[0] || item.media;
    const mediaCount = item.mediaList?.length ?? (item.media ? 1 : 0);
    const isVideoPost = item.mediaType === 'video';
    const posterUri = isVideoPost ? (getVideoPoster(firstMedia) || firstMedia) : firstMedia;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={styles.authorTap}
            onPress={() => navigation.navigate('UserProfile', { userId: item.author._id })}
          >
            <Image source={avatar} style={styles.avatar} />
            <View>
              <Text style={styles.name}>{item.author?.name}</Text>
              <Text style={styles.username}>@{item.author?.userName}</Text>
            </View>
          </TouchableOpacity>
          {isMine ? (
            <TouchableOpacity style={styles.moreBtn} onPress={() => openPostActions(item)}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#555" />
            </TouchableOpacity>
          ) : null}
        </View>

        {firstMedia ? (
          <TouchableOpacity onPress={() => navigation.navigate('PostComments', { postId: item._id })} activeOpacity={0.92}>
            <Image source={{ uri: posterUri }} style={styles.postImage} resizeMode="cover" />
            {isVideoPost ? (
              <View style={styles.playBadge}>
                <View style={styles.playCircle}>
                  <Ionicons name="play" size={28} color="#fff" />
                </View>
              </View>
            ) : null}
            {mediaCount > 1 ? (
              <View style={styles.mediaCounter}>
                <Ionicons name="images-outline" size={14} color="#fff" />
                <Text style={styles.mediaCounterText}>{mediaCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}

        {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item._id)}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#e53935' : '#555'} />
            <Text style={styles.actionCount}>{item.likes.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('PostComments', { postId: item._id })}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#555" />
            <Text style={styles.actionCount}>{item.commentsCount ?? item.comments.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveActionBtn} onPress={() => handleSave(item._id)}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color="#555" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStories = () => (
    <View style={styles.storiesWrap}>
      <FlatList
        data={stories}
        horizontal
        keyExtractor={(item) => item._id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesList}
        ListHeaderComponent={
          <TouchableOpacity style={styles.storyItem} onPress={uploadStoryPrompt} disabled={uploadingStory}>
            <View style={[styles.storyAvatar, styles.addStoryAvatar]}>
              {uploadingStory ? (
                <ActivityIndicator color="#111" />
              ) : user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.storyAvatarImage} />
              ) : (
                <Ionicons name="add" size={24} color="#111" />
              )}
              <View style={styles.storyPlus}>
                <Ionicons name="add" size={13} color="#fff" />
              </View>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>Ваша</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => {
          const viewed = user ? item.viewers?.some((viewer) => viewer._id === user._id) : false;
          return (
            <TouchableOpacity
              style={styles.storyItem}
              onPress={() => navigation.navigate('StoryViewer', { story: item })}
              activeOpacity={0.85}
            >
              <View style={[styles.storyAvatar, viewed && styles.storyAvatarViewed]}>
                <Image
                  source={item.author?.profileImage ? { uri: item.author.profileImage } : require('../../assets/icon.png')}
                  style={styles.storyAvatarImage}
                />
              </View>
              <Text style={styles.storyName} numberOfLines={1}>{item.author?.userName}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item._id}
      renderItem={renderPost}
      style={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFeed(); }} />}
      ListHeaderComponent={renderStories}
      ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>Нет публикаций</Text></View>}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  empty: { color: '#999', fontSize: 16 },
  storiesWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 8 },
  storiesList: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  storyItem: { width: 66, alignItems: 'center' },
  storyAvatar: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: '#111', padding: 2, backgroundColor: '#fff' },
  storyAvatarViewed: { borderColor: '#ddd' },
  addStoryAvatar: { justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
  storyAvatarImage: { width: '100%', height: '100%', borderRadius: 29, backgroundColor: '#eee' },
  storyPlus: { position: 'absolute', right: -1, bottom: -1, width: 20, height: 20, borderRadius: 10, backgroundColor: '#111', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  storyName: { marginTop: 5, color: '#444', fontSize: 11, fontWeight: '700', maxWidth: 62 },
  card: { backgroundColor: '#fff', marginBottom: 8, paddingBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 10 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  moreBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  name: { fontWeight: '700', fontSize: 14, color: '#111' },
  username: { fontSize: 12, color: '#888' },
  postImage: { width: '100%', aspectRatio: 1 },
  playBadge: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  mediaCounter: { position: 'absolute', right: 10, top: 10, borderRadius: 14, paddingHorizontal: 8, height: 28, backgroundColor: 'rgba(0,0,0,0.62)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  mediaCounterText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  caption: { paddingHorizontal: 12, paddingTop: 10, fontSize: 14, color: '#222', lineHeight: 20 },
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 14, color: '#555' },
  saveActionBtn: { marginLeft: 'auto' },
});
