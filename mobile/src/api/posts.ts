import client from './client';

export interface Post {
  _id: string;
  author: { _id: string; userName: string; name: string; profileImage: string };
  caption: string;
  media: string;
  mediaList: string[];
  mediaType: 'image' | 'video';
  likes: string[];
  comments: { _id: string; author: any; message: string }[];
  commentsCount: number;
  createdAt: string;
}

export async function getFeed(): Promise<Post[]> {
  const { data } = await client.get('/posts/getAll');
  return Array.isArray(data) ? data : data.posts ?? [];
}

export async function getUserPosts(userId: string): Promise<Post[]> {
  const all = await getFeed();
  return all.filter((p) => p.author?._id === userId);
}

export async function toggleLike(postId: string): Promise<void> {
  await client.get(`/posts/like/${postId}`);
}

export async function addComment(postId: string, text: string): Promise<void> {
  await client.post(`/posts/comment/${postId}`, { message: text });
}

export async function createPost(caption: string, mediaUri?: string): Promise<Post> {
  const formData = new FormData();
  if (caption) formData.append('caption', caption);
  if (mediaUri) {
    const filename = mediaUri.split('/').pop() ?? 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('media', { uri: mediaUri, name: filename, type } as any);
  }
  const { data } = await client.post('/posts/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
