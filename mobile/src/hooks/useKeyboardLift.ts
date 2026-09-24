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
// Зазор между поднятым содержимым и клавиатурой: прижатый вплотную блок
// выглядит частью клавиатуры, а не приложения.
const GAP = 10;

export function useKeyboardLift() {
  const lift = useRef(new Animated.Value(0)).current;
  // Высота корня без клавиатуры и текущее сжатие окна.
  const baseHeight = useRef(0);
  const shrink = useRef(0);
  const keyboardHeight = useRef(0);

  const apply = useCallback((duration?: number) => {
    Animated.timing(lift, {
      // Зазор добавляется только при видимой клавиатуре — и в том числе когда
      // окно сжала сама система и поднимать больше нечего.
      toValue: keyboardHeight.current > 0
        ? Math.max(0, keyboardHeight.current - shrink.current) + GAP
        : 0,
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

/**
 * Подъём для полноэкранных модалок (statusBarTranslucent): их корень занимает
 * экран целиком, поэтому перекрытие считается точно — низ корня минус
 * абсолютный верх клавиатуры из события. Никаких сравнений высот: формула
 * верна и когда система сжимает окно, и когда нет.
 *
 * Для обычных экранов не годится: их корень начинается под шапкой навигации,
 * и высота корня не совпадает с экранной координатой.
 */
export function useModalKeyboardLift() {
  const lift = useRef(new Animated.Value(0)).current;
  const rootHeight = useRef(0);
  /** Абсолютный Y верха клавиатуры; null — клавиатуры нет. */
  const keyboardTop = useRef<number | null>(null);
  const keyboardHeight = useRef(0);

  const apply = useCallback((duration?: number) => {
    // Две оценки перекрытия: по координате верха (низ корня минус верх
    // клавиатуры) и по заявленной высоте события. На части устройств одна из
    // них завышена на системную полосу — берём меньшую, она не промахивается
    // вверх, а вниз промахнуться не даёт вторая.
    const byCoords = keyboardTop.current === null
      ? 0
      : Math.max(0, rootHeight.current - keyboardTop.current);
    const target = keyboardTop.current === null
      ? 0
      : Math.min(byCoords, keyboardHeight.current) + GAP;
    Animated.timing(lift, {
      toValue: target,
      duration: duration && duration > 0 ? duration : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [lift]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    rootHeight.current = event.nativeEvent.layout.height;
    apply();
  }, [apply]);

  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardWillShow', (e) => {
        keyboardTop.current = e.endCoordinates.screenY;
        keyboardHeight.current = e.endCoordinates.height;
        apply(e.duration);
      }),
      Keyboard.addListener('keyboardDidShow', (e) => {
        keyboardTop.current = e.endCoordinates.screenY;
        keyboardHeight.current = e.endCoordinates.height;
        apply(e.duration);
      }),
      Keyboard.addListener('keyboardWillHide', (e) => { keyboardTop.current = null; apply(e.duration); }),
      Keyboard.addListener('keyboardDidHide', (e) => { keyboardTop.current = null; apply(e.duration); }),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [apply]);

  return { lift, onLayout };
}
