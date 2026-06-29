import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getUserPosts, Post } from '../api/posts';
import { useAuthStore } from '../store/authStore';
import { AppStackParamList } from '../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AppStackParamList> };

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserPosts(user._id)
      .then(setPosts)
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

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.newPostBtn}
          onPress={() => navigation.navigate('CreatePost')}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newPostText}>Новая публикация</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#e53935" />
        </TouchableOpacity>
      </View>

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
                {item.mediaList?.[0]
                  ? <Image source={{ uri: item.mediaList[0] }} style={styles.gridImage} />
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
  btnRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  newPostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 38, backgroundColor: '#111', borderRadius: 10,
  },
  newPostText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutBtn: {
    width: 38, height: 38, backgroundColor: '#fff5f5',
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#fce4e4',
  },
  gridItem: { flex: 1/3 },
  gridImage: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  gridNoImage: { justifyContent: 'center', alignItems: 'center' },
});
