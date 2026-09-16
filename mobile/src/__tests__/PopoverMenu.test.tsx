import React from 'react';
import renderer, { act } from 'react-test-renderer';

import PopoverMenu, { PopoverAction } from '../components/ui/PopoverMenu';

// React 19 планирует рендер асинхронно: create вне act даёт размонтированное
// дерево ещё до первого assert.
const mount = async (element: React.ReactElement) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(element); });
  return tree;
};

const findTexts = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAll((n) => String(n.type) === 'Text' && typeof n.props.children === 'string')
    .map((n) => n.props.children as string);

const pressLabel = async (tree: renderer.ReactTestRenderer, label: string) => {
  const item = tree.root.findAll(
    (n) => n.props.onPress && n.findAll((c) => String(c.type) === 'Text' && c.props.children === label).length > 0,
  )[0];
  await act(async () => { item.props.onPress(); });
};

const ACTIONS = (onProfile: () => void): PopoverAction[] => [
  { key: 'profile', label: 'Открыть профиль', icon: 'person-outline', onPress: onProfile },
  { key: 'delete', label: 'Удалить переписку', icon: 'trash-outline', danger: true, onPress: jest.fn() },
];

describe('PopoverMenu', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('показывает все действия', async () => {
    const tree = await mount(
      <PopoverMenu visible onClose={jest.fn()} actions={ACTIONS(jest.fn())} top={90} />,
    );
    expect(findTexts(tree)).toEqual(expect.arrayContaining(['Открыть профиль', 'Удалить переписку']));
  });

  it('выбор пункта сначала закрывает меню, а действие выполняется после ухода', async () => {
    const onClose = jest.fn();
    const onProfile = jest.fn();
    const tree = await mount(
      <PopoverMenu visible onClose={onClose} actions={ACTIONS(onProfile)} top={90} />,
    );

    await pressLabel(tree, 'Открыть профиль');
    // Экран не должен подменяться, пока меню ещё на виду.
    expect(onClose).toHaveBeenCalled();
    expect(onProfile).not.toHaveBeenCalled();

    // Эффект с анимацией ухода запускается только на выходе из act —
    // время двигаем следующим шагом, иначе двигать ещё нечего.
    await act(async () => {
      tree.update(<PopoverMenu visible={false} onClose={onClose} actions={ACTIONS(onProfile)} top={90} />);
    });
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(onProfile).toHaveBeenCalled();
  });

  it('скрытое меню ничего не рисует', async () => {
    const tree = await mount(
      <PopoverMenu visible={false} onClose={jest.fn()} actions={ACTIONS(jest.fn())} top={90} />,
    );
    expect(findTexts(tree)).toEqual([]);
  });
});
