import { useRef } from 'react';
import { PanResponder } from 'react-native';

export type SwipeDir = 'up' | 'down' | 'left' | 'right';

// Swipe detector for game boards — returns panHandlers to spread on a View.
// Claims the gesture from a parent ScrollView once a real drag starts.
export function useSwipe(onSwipe: (dir: SwipeDir) => void, threshold = 22) {
  const cb = useRef(onSwipe);
  cb.current = onSwipe;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
      onPanResponderRelease: (_, g) => {
        const { dx, dy } = g;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
        if (Math.abs(dx) > Math.abs(dy)) cb.current(dx > 0 ? 'right' : 'left');
        else cb.current(dy > 0 ? 'down' : 'up');
      },
    }),
  ).current;

  return responder.panHandlers;
}
