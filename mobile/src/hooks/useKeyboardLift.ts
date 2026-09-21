import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Keyboard, LayoutChangeEvent } from 'react-native';

/**
 * Сколько нужно поднять содержимое, чтобы клавиатура его не закрывала.
 *
 * Высоте клавиатуры из события верить нельзя саму по себе: на части сборок
 * система сама сжимает окно под клавиатуру (adjustResize), и тогда поднимать
 * ещё раз — значит увести ввод в потолок. На других сборках окно остаётся во
 * весь экран, и без подъёма ввод оказывается под клавиатурой.
 *
 * Поэтому смотрим на обе величины: сколько занимает клавиатура и насколько
 * окно уже сжалось. Поднимаем ровно на разницу, поэтому оба поведения дают
 * одинаковый результат.
 */
export function useKeyboardLift() {
  const lift = useRef(new Animated.Value(0)).current;
  // Высота корня без клавиатуры и текущее сжатие окна.
  const baseHeight = useRef(0);
  const shrink = useRef(0);
  const keyboardHeight = useRef(0);

  const apply = useCallback((duration?: number) => {
    Animated.timing(lift, {
      toValue: Math.max(0, keyboardHeight.current - shrink.current),
      duration: duration && duration > 0 ? duration : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [lift]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (!keyboardHeight.current) {
      // Клавиатуры нет — это и есть полная высота окна.
      baseHeight.current = height;
      shrink.current = 0;
    } else {
      shrink.current = Math.max(0, baseHeight.current - height);
    }
    apply();
  }, [apply]);

  useEffect(() => {
    const show = (height: number, duration?: number) => {
      keyboardHeight.current = height;
      apply(duration);
    };
    const hide = (duration?: number) => {
      keyboardHeight.current = 0;
      shrink.current = 0;
      apply(duration);
    };
    const subs = [
      Keyboard.addListener('keyboardWillShow', (e) => show(e.endCoordinates.height, e.duration)),
      Keyboard.addListener('keyboardDidShow', (e) => show(e.endCoordinates.height, e.duration)),
      Keyboard.addListener('keyboardWillHide', (e) => hide(e.duration)),
      Keyboard.addListener('keyboardDidHide', (e) => hide(e.duration)),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [apply]);

  return { lift, onLayout };
}
