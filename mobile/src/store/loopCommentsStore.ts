import { create } from 'zustand';
import { Loop } from '../api/loops';

interface LoopCommentsState {
  /** Ролик, чьи комментарии открыты; null — шторка закрыта. */
  loop: Loop | null;
  open: (loop: Loop) => void;
  /** Свежая версия ролика (после отправки комментария или дозагрузки). */
  merge: (loop: Loop) => void;
  close: () => void;
}

/**
 * Комментарии к ролику живут в корне приложения, а не внутри экрана Loops:
 * шторка обязана накрывать всё, включая панель вкладок, а слой внутри сцены
 * до низа экрана не дотягивается — навигатор режет сцену под панель.
 */
export const useLoopCommentsStore = create<LoopCommentsState>((set) => ({
  loop: null,
  open: (loop) => set({ loop }),
  merge: (loop) => set((state) => (state.loop && state.loop._id === loop._id ? { loop } : state)),
  close: () => set({ loop: null }),
}));
