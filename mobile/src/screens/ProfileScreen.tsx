import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

interface Post {
  _id: string;
  imageUrl?: string;
  caption: string;
  likes: string[];
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    client.get(`/posts/user/${user._id}`)
      .then(({ data }) => setPosts(Array.isArray(data) ? data : data.posts ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const avatar = user.profileImage
    ? { uri: user.profileImage }
    : require('../../assets/icon.png');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image source={avatar} style={styles.avatar} />
        <View style={styles.stats}>
          {[
            { label: 'Публикации', value: posts.length },
            { label: 'Подписчики', value: user.followers.length },
            { label: 'Подписки', value: user.following.length },
          ].map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statNum}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{user.name}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color="#e53935" />
        <Text style={styles.logoutText}>Выйти</Text>
      </TouchableOpacity>

      {loading
        ? <ActivityIndicator style={{ marginTop: 40 }} color="#111" />
        : (
          <FlatList
            data={posts}
            keyExtractor={(p) => p._id}
            numColumns={3}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.gridItem}>
                {item.imageUrl
                  ? <Image source={{ uri: item.imageUrl }} style={styles.gridImage} />
                  : <View style={[styles.gridImage, styles.gridNoImage]}>
                      <Ionicons name="text-outline" size={20} color="#ccc" />
                    </View>
                }
              </View>
            )}
          />
        )
      }
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee' },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  info: { paddingHorizontal: 16, paddingBottom: 12 },
  name: { fontWeight: '700', fontSize: 16, color: '#111' },
  bio: { fontSize: 14, color: '#444', marginTop: 4, lineHeight: 20 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 16, padding: 12,
    borderWidth: 1, borderColor: '#fce4e4', borderRadius: 12, backgroundColor: '#fff5f5',
  },
  logoutText: { color: '#e53935', fontWeight: '600', fontSize: 14 },
  gridItem: { flex: 1/3 },
  gridImage: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  gridNoImage: { justifyContent: 'center', alignItems: 'center' },
});
