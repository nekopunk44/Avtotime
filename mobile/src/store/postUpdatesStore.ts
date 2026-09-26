import { create } from 'zustand';
import { Post } from '../api/posts';

interface PostUpdatesState {
  /** Последний изменённый пост; счётчик отличает повторные правки того же. */
  updated: { post: Post; seq: number } | null;
  publish: (post: Post) => void;
}

let seq = 0;

/**
 * Мост между экранами: лайк или комментарий, поставленный внутри публикации,
 * должен погаснуть и в ленте. Экран публикации публикует свежую версию
 * поста, ленты подписываются и вливают её в свои списки.
 */
export const usePostUpdatesStore = create<PostUpdatesState>((set) => ({
  updated: null,
  publish: (post) => set({ updated: { post, seq: ++seq } }),
}));
