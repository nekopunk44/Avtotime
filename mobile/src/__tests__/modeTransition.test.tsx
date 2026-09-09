import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ModeTransition, { playModeTransition } from '../components/ModeTransition';

describe('переход Соцсеть <-> Маркет', () => {
  it('без смонтированного оверлея переключает сразу — переход не может блокировать навигацию', () => {
    const onSwitch = jest.fn();
    playModeTransition('market', onSwitch);
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('с оверлеем переключение происходит в середине анимации, под тёмным фоном', async () => {
    jest.useFakeTimers();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ModeTransition />);
    });

    const onSwitch = jest.fn();
    await act(async () => {
      playModeTransition('market', onSwitch);
    });
    // Анимация пошла, но до ребра флипа навигации ещё нет.
    expect(onSwitch).not.toHaveBeenCalled();

    await act(async () => {
      jest.runAllTimers();
    });
    expect(onSwitch).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
    tree.unmount();
  });
});
