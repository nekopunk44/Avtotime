import React, { useEffect, useRef, useState } from 'react';
import ConfirmSheet from '../components/ui/ConfirmSheet';

type GuardNavigation = {
  addListener: (event: 'beforeRemove', cb: (e: any) => void) => () => void;
  dispatch: (action: any) => void;
};

/**
 * Предупреждает при уходе с экрана с несохранёнными изменениями.
 *
 * Диалог — собственная шторка (ConfirmSheet), а не системный Alert: экран
 * ОБЯЗАН отрендерить возвращённый `guardSheet`, иначе заблокированный уход
 * молча повиснет. Успешное сохранение вызывает markSaved() прямо перед
 * навигацией — тогда уход проходит без вопросов.
 */
export function useUnsavedGuard(navigation: GuardNavigation, isDirty: boolean) {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const skipRef = useRef(false);
  const [pendingAction, setPendingAction] = useState<unknown>(null);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current || skipRef.current) return;
      e.preventDefault();
      setPendingAction(e.data.action);
    });
  }, [navigation]);

  const stay = () => setPendingAction(null);
  const leave = () => {
    const action = pendingAction;
    setPendingAction(null);
    // Пропускаем повторное срабатывание guard'а на этом же dispatch.
    skipRef.current = true;
    navigation.dispatch(action);
  };

  const guardSheet = React.createElement(ConfirmSheet, {
    visible: pendingAction !== null,
    title: 'Выйти без сохранения?',
    message: 'Введённые данные будут потеряны.',
    cancelLabel: 'Остаться',
    confirmLabel: 'Выйти',
    destructive: true,
    onCancel: stay,
    onConfirm: leave,
  });

  return { markSaved: () => { skipRef.current = true; }, guardSheet };
}
