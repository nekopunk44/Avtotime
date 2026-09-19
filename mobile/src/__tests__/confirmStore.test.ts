import { askConfirm, useConfirmStore } from '../store/confirmStore';

describe('вопрос «точно?»', () => {
  beforeEach(() => useConfirmStore.setState({ request: null }));

  it('согласие возвращает true, отказ — false', async () => {
    const yes = askConfirm({ title: 'Удалить?' });
    useConfirmStore.getState().answer(true);
    expect(await yes).toBe(true);

    const no = askConfirm({ title: 'Удалить?' });
    useConfirmStore.getState().answer(false);
    expect(await no).toBe(false);
  });

  it('пока не ответили, вопрос виден', () => {
    askConfirm({ title: 'Выйти?', message: 'Точно?' });
    expect(useConfirmStore.getState().request?.title).toBe('Выйти?');
    useConfirmStore.getState().answer(false);
    expect(useConfirmStore.getState().request).toBeNull();
  });

  it('второй вопрос закрывает первый отказом — никто не ждёт вечно', async () => {
    const first = askConfirm({ title: 'Первый' });
    askConfirm({ title: 'Второй' });
    expect(await first).toBe(false);
    expect(useConfirmStore.getState().request?.title).toBe('Второй');
  });
});
