import { useCallback, useEffect, useState } from 'react';
import {
  CompareItem,
  CompareItemType,
  getCompareItems,
  saveCompareItems,
  toggleCompareItem,
} from '../api/compare';
import { showToast } from '../store/toastStore';

/**
 * Список сравнения, общий для витрины и карточки объявления: правила «не
 * больше двух» и «только один тип за раз» должны звучать одинаково, откуда
 * бы объявление ни добавляли.
 */
export function useCompare() {
  const [items, setItems] = useState<CompareItem[]>([]);
  // Занят конкретный id, а не экран: в списке кнопок много, и крутиться
  // должна только нажатая.
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    getCompareItems()
      .then((next) => { if (mounted) setItems(next); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const isCompared = useCallback(
    (id: number | undefined, type: CompareItemType) =>
      typeof id === 'number' && items.some((item) => item.id === id && item.type === type),
    [items],
  );

  const toggle = useCallback(async (id: number | undefined, type: CompareItemType) => {
    if (typeof id !== 'number' || !Number.isFinite(id)) {
      showToast('Это объявление нельзя добавить в сравнение', 'error');
      return;
    }

    const nextItems = toggleCompareItem(items, { id, type });
    const already = items.some((item) => item.id === id && item.type === type);
    // Список не изменился, хотя объявления в нём не было — значит пара занята.
    if (!already && nextItems.length === items.length && items.length >= 2 && items[0]?.type === type) {
      showToast('В сравнении уже два объявления — уберите одно');
      return;
    }

    setBusyId(id);
    try {
      const replaced = !already && items.length > 0 && items[0]?.type !== type;
      const saved = await saveCompareItems(nextItems);
      setItems(saved);
      // Сообщение одно: два подряд перебивают друг друга, и человек успевает
      // прочитать только последнее.
      if (already) showToast('Убрано из сравнения');
      else if (replaced) showToast('Список заменён: сравнивать можно только один тип');
      else if (saved.length >= 2) showToast('Два объявления в сравнении — можно смотреть', 'success');
      else showToast('Добавлено в сравнение', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Не удалось обновить сравнение', 'error');
    } finally {
      setBusyId(null);
    }
  }, [items]);

  return { items, isCompared, toggle, busyId };
}
