import client from './client';
import { getMe, User } from './auth';
import { getUploadFile } from '../utils/upload';

export interface PostComment {
  _id: string;
  author: { _id: string; userName: string; name: string; profileImage?: string } | string;
  message: string;
}

export interface Post {
  _id: string;
  author: { _id: string; userName: string; name: string; profileImage?: string };
  caption: string;
  media: string;
  mediaList: string[];
  mediaType: 'image' | 'video';
  likes: string[];
  comments: PostComment[];
  commentsPreview?: PostComment[];
  commentsCount: number;
  createdAt: string;
}

export interface PostsPage {
  posts: Post[];
  total: number;
  page: number;
  limit: number;
}

export interface CreatePostPayload {
  caption: string;
  mediaUris: string[];
  mediaType?: 'image' | 'video';
}

export interface EditPostPayload {
  caption: string;
  mediaUris?: string[];
  mediaType?: 'image' | 'video';
}

// Cloudinary can render a still frame from a video by swapping the file
// extension for an image one. Returns null for non-Cloudinary or non-video URLs.
export function getVideoPoster(url?: string): string | null {
  if (!url || !/res\.cloudinary\.com/.test(url)) return null;
  if (!/\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(url)) return null;
  return url.replace(/\.(mp4|mov|webm|m4v|avi|mkv)$/i, '.jpg');
}

// Thumbnail URI for a post: a still frame for videos, the first image otherwise.
export function getPostThumb(post: Pick<Post, 'media' | 'mediaList' | 'mediaType'>): string | undefined {
  const first = post.mediaList?.[0] || post.media;
  if (!first) return undefined;
  if (post.mediaType === 'video') return getVideoPoster(first) || first;
  return first;
}

export function getSavedPostIds(user?: Pick<User, 'saved'> | null) {
  return (user?.saved ?? []).map((item) => (typeof item === 'string' ? item : item._id)).filter(Boolean);
}

export function isPostSaved(user: Pick<User, 'saved'> | null | undefined, postId: string) {
  return getSavedPostIds(user).includes(postId);
}

export const FEED_PAGE_SIZE = 20;

export async function getFeed(page = 1, limit = FEED_PAGE_SIZE): Promise<Post[]> {
  const { data } = await client.get('/post/getAll', { params: { page, limit } });
  return Array.isArray(data) ? data : data.posts ?? [];
}

export async function getUserPosts(userId: string, page = 1, limit = 60): Promise<PostsPage> {
  const { data } = await client.get(`/post/user/${userId}`, { params: { page, limit } });
  const posts = Array.isArray(data) ? data : data.posts ?? [];
  return {
    posts,
    total: data.total ?? posts.length,
    page: data.page ?? page,
    limit: data.limit ?? limit,
  };
}

/** Посты, которым пользователь поставил лайк. */
export async function getLikedPosts(page = 1, limit = 60): Promise<Post[]> {
  const { data } = await client.get('/post/liked', { params: { page, limit } });
  return Array.isArray(data) ? data : data.posts ?? [];
}

export async function getPostById(postId: string): Promise<Post> {
  const { data } = await client.get(`/post/get/${postId}`);
  return data;
}

export async function searchPosts(query: string): Promise<Post[]> {
  const { data } = await client.get('/post/search', { params: { q: query } });
  return Array.isArray(data) ? data : data.posts ?? [];
}

export async function toggleLike(postId: string): Promise<Post> {
  const { data } = await client.get(`/post/like/${postId}`);
  return data;
}

export async function addComment(postId: string, text: string): Promise<Post> {
  const { data } = await client.post(`/post/comment/${postId}`, { message: text });
  return data;
}

export async function editPost(postId: string, payload: string | EditPostPayload): Promise<Post> {
  const body = typeof payload === 'string' ? { caption: payload } : payload;

  if (body.mediaUris?.length) {
    const formData = new FormData();
    formData.append('caption', body.caption ?? '');
    formData.append('mediaType', body.mediaType || 'image');
    body.mediaUris.forEach((mediaUri) => {
      formData.append('media', getUploadFile(mediaUri, 'post-photo.jpg'));
    });

    const { data } = await client.patch(`/post/edit/${postId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 45000,
    });
    return data;
  }

  const { data } = await client.patch(`/post/edit/${postId}`, { caption: body.caption });
  return data;
}

export async function deletePost(postId: string): Promise<string> {
  const { data } = await client.delete(`/post/delete/${postId}`);
  return data.postId ?? postId;
}

export async function toggleSavePost(postId: string): Promise<User> {
  const { data } = await client.get(`/post/saved/${postId}`);
  return data;
}

export interface SavedLoopTile {
  _id: string;
  media: string;
  caption?: string;
  /** Метка для сетки профиля: плитка ведёт в ленту роликов, а не в пост. */
  isLoop: true;
}

export type SavedItem = Post | SavedLoopTile;

export const isSavedLoop = (item: SavedItem): item is SavedLoopTile =>
  (item as SavedLoopTile).isLoop === true;

/** Сохранённое целиком: посты и ролики одной загрузкой профиля. */
export async function getSavedItems(): Promise<SavedItem[]> {
  const user = await getMe();
  // Достаточно того, что запись пришла объектом с идентификатором: пост без
  // подписи — обычное дело, а раньше он выпадал из списка.
  const posts = (user.saved ?? []).filter((item): item is Post => typeof item !== 'string' && !!item?._id);
  const loops: SavedLoopTile[] = (user.savedLoops ?? [])
    .filter((item): item is Exclude<typeof item, string> => typeof item !== 'string' && !!item?._id)
    .map((item) => ({ _id: item._id, media: item.media, caption: item.caption, isLoop: true }));
  return [...loops, ...posts];
}

export async function createPost(payload: CreatePostPayload): Promise<Post> {
  const formData = new FormData();
  if (payload.caption) formData.append('caption', payload.caption);
  formData.append('mediaType', payload.mediaType || 'image');
  const fallbackName = payload.mediaType === 'video' ? 'post-video.mp4' : 'post-photo.jpg';
  payload.mediaUris.forEach((mediaUri) => {
    formData.append('media', getUploadFile(mediaUri, fallbackName));
  });
  const { data } = await client.post('/post/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45000,
  });
  return data;
}
