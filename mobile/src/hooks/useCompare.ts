import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  CompareItem,
  CompareItemType,
  getCompareItems,
  saveCompareItems,
  toggleCompareItem,
} from '../api/compare';

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
      Alert.alert('Сравнение', 'Это объявление нельзя добавить в сравнение.');
      return;
    }

    const nextItems = toggleCompareItem(items, { id, type });
    const already = items.some((item) => item.id === id && item.type === type);
    // Список не изменился, хотя объявления в нём не было — значит пара занята.
    if (!already && nextItems.length === items.length && items.length >= 2 && items[0]?.type === type) {
      Alert.alert('Сравнение', 'Можно сравнить максимум два объявления одного типа.');
      return;
    }

    setBusyId(id);
    try {
      const saved = await saveCompareItems(nextItems);
      setItems(saved);
      if (!already && items.length > 0 && items[0]?.type !== type) {
        Alert.alert('Сравнение', 'Список сравнения был заменён, потому что можно сравнивать только один тип объявлений за раз.');
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.response?.data?.message || 'Не удалось обновить сравнение');
    } finally {
      setBusyId(null);
    }
  }, [items]);

  return { items, isCompared, toggle, busyId };
}
