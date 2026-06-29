import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList, View, Text, Image, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client, { API_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';

interface Post {
  _id: string;
  userId: { _id: string; username: string; name: string; profileImage: string };
  caption: string;
  imageUrl?: string;
  videoUrl?: string;
  likes: string[];
  comments: any[];
  createdAt: string;
}

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore((s) => s.user);

  const loadPosts = useCallback(async () => {
    try {
      const { data } = await client.get('/posts/feed');
      setPosts(Array.isArray(data) ? data : data.posts ?? []);
    } catch (e) {
      console.error('Feed error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, []);

  const toggleLike = async (postId: string) => {
    try {
      await client.post(`/posts/${postId}/like`);
      setPosts((prev) => prev.map((p) => {
        if (p._id !== postId) return p;
        const liked = p.likes.includes(user!._id);
        return {
          ...p,
          likes: liked ? p.likes.filter((id) => id !== user!._id) : [...p.likes, user!._id],
        };
      }));
    } catch {}
  };

  const renderPost = ({ item }: { item: Post }) => {
    const liked = user ? item.likes.includes(user._id) : false;
    const avatar = item.userId?.profileImage
      ? { uri: item.userId.profileImage }
      : require('../../assets/icon.png');

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Image source={avatar} style={styles.avatar} />
          <View>
            <Text style={styles.name}>{item.userId?.name}</Text>
            <Text style={styles.username}>@{item.userId?.username}</Text>
          </View>
        </View>

        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
        )}

        {item.caption ? <Text style={styles.caption}>{item.caption}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(item._id)}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#e53935' : '#555'} />
            <Text style={styles.actionCount}>{item.likes.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={20} color="#555" />
            <Text style={styles.actionCount}>{item.comments.length}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item._id}
      renderItem={renderPost}
      style={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPosts(); }} />}
      ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>Нет публикаций</Text></View>}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  empty: { color: '#999', fontSize: 16 },
  card: { backgroundColor: '#fff', marginBottom: 8, paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  name: { fontWeight: '700', fontSize: 14, color: '#111' },
  username: { fontSize: 12, color: '#888' },
  postImage: { width: '100%', aspectRatio: 1 },
  caption: { paddingHorizontal: 12, paddingTop: 10, fontSize: 14, color: '#222', lineHeight: 20 },
  actions: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 14, color: '#555' },
});
