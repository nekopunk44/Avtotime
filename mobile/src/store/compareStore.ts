import { create } from 'zustand';
import {
  CompareItem,
  CompareItemType,
  getCompareItems,
  saveCompareItems,
  toggleCompareItem,
} from '../api/compare';
import { showToast } from './toastStore';

interface CompareState {
  items: CompareItem[];
  /** Занят конкретный id: в выдаче кнопок много, крутиться должна нажатая. */
  busyId: number | null;
  saving: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
  ensureLoaded: () => void;
  toggle: (id: number | undefined, type: CompareItemType) => Promise<void>;
  remove: (item: CompareItem) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * Список сравнения один на всё приложение. Раньше каждый экран держал свою
 * копию: убрав объявление на экране сравнения, в маркете видели его всё ещё
 * отмеченным.
 */
export const useCompareStore = create<CompareState>((set, get) => {
  const save = async (next: CompareItem[], done: string, busyId: number | null = null) => {
    set({ busyId, saving: true });
    try {
      const saved = await saveCompareItems(next);
      set({ items: saved, loaded: true });
      if (done) showToast(done);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось обновить сравнение', 'error');
    } finally {
      set({ busyId: null, saving: false });
    }
  };

  return {
    items: [],
    busyId: null,
    saving: false,
    loaded: false,

    refresh: async () => {
      const items = await getCompareItems();
      set({ items, loaded: true });
    },

    // Первый экран, которому список понадобился, его и загружает.
    ensureLoaded: () => {
      if (get().loaded) return;
      set({ loaded: true });
      getCompareItems()
        .then((items) => set({ items }))
        .catch(() => set({ loaded: false }));
    },

    toggle: async (id, type) => {
      if (typeof id !== 'number' || !Number.isFinite(id)) {
        showToast('Это объявление нельзя добавить в сравнение', 'error');
        return;
      }

      const items = get().items;
      const nextItems = toggleCompareItem(items, { id, type });
      const already = items.some((item) => item.id === id && item.type === type);
      // Список не изменился, хотя объявления в нём не было — значит пара занята.
      if (!already && nextItems.length === items.length && items.length >= 2 && items[0]?.type === type) {
        showToast('В сравнении уже два объявления — уберите одно');
        return;
      }

      const replaced = !already && items.length > 0 && items[0]?.type !== type;
      // Сообщение одно: два подряд перебивают друг друга, и человек успевает
      // прочитать только последнее.
      const done = already
        ? 'Убрано из сравнения'
        : replaced
          ? 'Список заменён: сравнивать можно только один тип'
          : nextItems.length >= 2
            ? 'Два объявления в сравнении — можно смотреть'
            : 'Добавлено в сравнение';

      await save(nextItems, done, id);
    },

    remove: async (item) => {
      const next = get().items.filter(
        (candidate) => !(candidate.id === item.id && candidate.type === item.type),
      );
      await save(next, 'Убрано из сравнения', item.id);
    },

    clear: () => save([], 'Сравнение очищено'),
  };
});
