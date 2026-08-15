import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

type GuardNavigation = {
  addListener: (event: 'beforeRemove', cb: (e: any) => void) => () => void;
  dispatch: (action: any) => void;
};

// Warns before leaving a screen that has unsaved form changes. Successful
// submits should call markSaved() right before navigating away, so the
// post-save navigation (replace/goBack) passes through without the prompt.
export function useUnsavedGuard(navigation: GuardNavigation, isDirty: boolean) {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const skipRef = useRef(false);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current || skipRef.current) return;
      e.preventDefault();
      Alert.alert('Выйти без сохранения?', 'Введённые данные будут потеряны.', [
        { text: 'Остаться', style: 'cancel' },
        { text: 'Выйти', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [navigation]);

  return { markSaved: () => { skipRef.current = true; } };
}
