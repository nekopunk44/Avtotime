import React, { useEffect, useState } from 'react';
import ConfirmSheet from './ConfirmSheet';
import { ConfirmOptions, useConfirmStore } from '../../store/confirmStore';

/**
 * Одна шторка подтверждения на всё приложение: экраны просто спрашивают
 * askConfirm и ждут ответа, а не тащат каждый своё состояние.
 */
export default function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  const answer = useConfirmStore((s) => s.answer);

  // Текст держится до конца анимации ухода — иначе вопрос исчезает раньше
  // самой шторки.
  const [shown, setShown] = useState<ConfirmOptions | null>(request);

  useEffect(() => {
    if (request) setShown(request);
  }, [request]);

  if (!shown) return null;

  return (
    <ConfirmSheet
      visible={!!request}
      title={shown.title}
      message={shown.message}
      confirmLabel={shown.confirmLabel || 'Продолжить'}
      cancelLabel={shown.cancelLabel || 'Отмена'}
      destructive={shown.destructive}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );
}
