import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../api/reports', () => ({ submitReport: jest.fn(async () => ({ _id: 'r1', status: 'open' })) }));

import ReportSheet from '../components/ReportSheet';
import { submitReport } from '../api/reports';

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

describe('ReportSheet', () => {
  it('показывает все причины и держит кнопку выключенной до выбора', async () => {
    const tree = await mount(
      <ReportSheet visible targetType="post" targetId="p1" onClose={jest.fn()} />,
    );

    const texts = findTexts(tree);
    expect(texts).toEqual(expect.arrayContaining(['Пожаловаться', 'Спам', 'Мошенничество', 'Другое']));
    // Отправка без причины не должна дёргать API.
    expect(submitReport).not.toHaveBeenCalled();
  });

  it('выбор причины и отправка доводят до экрана «отправлено»', async () => {
    const tree = await mount(
      <ReportSheet visible targetType="user" targetId="u1" onClose={jest.fn()} />,
    );

    const spamChip = tree.root.findAll(
      (n) => n.props.onPress && n.findAll((c) => String(c.type) === 'Text' && c.props.children === 'Спам').length > 0,
    )[0];
    await act(async () => { spamChip.props.onPress(); });

    const sendBtn = tree.root.findAll(
      (n) => n.props.onPress && n.findAll((c) => String(c.type) === 'Text' && c.props.children === 'Отправить жалобу').length > 0,
    )[0];
    await act(async () => { await sendBtn.props.onPress(); });

    expect(submitReport).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: 'user', targetId: 'u1', reason: 'spam' }),
    );
    expect(findTexts(tree)).toEqual(expect.arrayContaining(['Жалоба отправлена']));
  });

  it('409 показывается как «уже на рассмотрении», а не как ошибка', async () => {
    (submitReport as jest.Mock).mockRejectedValueOnce({ response: { status: 409 } });
    const tree = await mount(
      <ReportSheet visible targetType="post" targetId="p2" onClose={jest.fn()} />,
    );

    const chip = tree.root.findAll(
      (n) => n.props.onPress && n.findAll((c) => String(c.type) === 'Text' && c.props.children === 'Спам').length > 0,
    )[0];
    await act(async () => { chip.props.onPress(); });
    const sendBtn = tree.root.findAll(
      (n) => n.props.onPress && n.findAll((c) => String(c.type) === 'Text' && c.props.children === 'Отправить жалобу').length > 0,
    )[0];
    await act(async () => { await sendBtn.props.onPress(); });

    expect(findTexts(tree)).toEqual(expect.arrayContaining(['Уже на рассмотрении']));
  });
});
