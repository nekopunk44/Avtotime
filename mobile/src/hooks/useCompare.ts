import { useCallback, useEffect } from 'react';
import { CompareItemType } from '../api/compare';
import { useCompareStore } from '../store/compareStore';

/**
 * Доступ к общему списку сравнения для экранов, где стоит кнопка «сравнить».
 * Состояние живёт в сторе: список один, и отметки на карточках не должны
 * расходиться с тем, что показывает экран сравнения.
 */
export function useCompare() {
  const items = useCompareStore((s) => s.items);
  const busyId = useCompareStore((s) => s.busyId);
  const toggle = useCompareStore((s) => s.toggle);
  const ensureLoaded = useCompareStore((s) => s.ensureLoaded);

  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  const isCompared = useCallback(
    (id: number | undefined, type: CompareItemType) =>
      typeof id === 'number' && items.some((item) => item.id === id && item.type === type),
    [items],
  );

  return { items, isCompared, toggle, busyId };
}
