import { create } from 'zustand';
import { getLikedPosts, getSavedItems, SavedItem, SavedLoopTile } from '../api/posts';
import { getLikedLoops } from '../api/loops';

interface ProfileLibraryState {
  /** null — раздел ещё ни разу не загружался, профиль покажет загрузку. */
  saved: SavedItem[] | null;
  liked: SavedItem[] | null;
  refreshSaved: () => void;
  refreshLiked: () => void;
  reset: () => void;
}

// Номер запроса: применяется только ответ самого свежего — два быстрых
// нажатия подряд не должны перезаписать новый список старым ответом.
let savedSeq = 0;
let likedSeq = 0;

/**
 * «Сохранённые» и «Понравившиеся» живут вне экрана профиля: лайк ставится в
 * ленте или на ролике, и списки обновляются в фоне сразу же — к моменту,
 * когда профиль откроют, там уже свежие данные, без подмены на глазах.
 */
export const useProfileLibraryStore = create<ProfileLibraryState>((set) => ({
  saved: null,
  liked: null,

  refreshSaved: () => {
    const my = ++savedSeq;
    getSavedItems()
      .then((items) => { if (my === savedSeq) set({ saved: items }); })
      .catch(() => {});
  },

  refreshLiked: () => {
    const my = ++likedSeq;
    // Понравившееся — и посты, и ролики: у роликов свой список на сервере.
    Promise.all([getLikedPosts(), getLikedLoops().catch(() => [])])
      .then(([posts, loops]) => {
        if (my !== likedSeq) return;
        const tiles: SavedLoopTile[] = loops.map((loop) => ({
          _id: loop._id, media: loop.media, poster: loop.poster, caption: loop.caption, isLoop: true,
        }));
        set({ liked: [...tiles, ...posts] });
      })
      .catch(() => {});
  },

  reset: () => {
    savedSeq++;
    likedSeq++;
    set({ saved: null, liked: null });
  },
}));
