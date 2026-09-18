jest.mock('../api/compare', () => {
  const actual = jest.requireActual('../api/compare');
  return {
    ...actual,
    getCompareItems: jest.fn(async () => []),
    // Сервер возвращает то, что сохранили: правила проверяются до запроса.
    saveCompareItems: jest.fn(async (items) => items),
  };
});

import { useCompareStore } from '../store/compareStore';
import { saveCompareItems } from '../api/compare';
import { useToastStore } from '../store/toastStore';

const reset = () => useCompareStore.setState({ items: [], busyId: null, saving: false, loaded: false });

describe('общий список сравнения', () => {
  beforeEach(() => {
    reset();
    useToastStore.getState().hide();
    (saveCompareItems as jest.Mock).mockClear();
  });

  it('добавляет и убирает одним и тем же нажатием', async () => {
    await useCompareStore.getState().toggle(1, 'car');
    expect(useCompareStore.getState().items).toEqual([{ id: 1, type: 'car' }]);

    await useCompareStore.getState().toggle(1, 'car');
    expect(useCompareStore.getState().items).toEqual([]);
  });

  it('третье объявление не влезает и на сервер не уходит', async () => {
    await useCompareStore.getState().toggle(1, 'car');
    await useCompareStore.getState().toggle(2, 'car');
    (saveCompareItems as jest.Mock).mockClear();

    await useCompareStore.getState().toggle(3, 'car');
    expect(useCompareStore.getState().items).toHaveLength(2);
    expect(saveCompareItems).not.toHaveBeenCalled();
    expect(useToastStore.getState().toast?.text).toContain('уберите одно');
  });

  it('другой тип заменяет список целиком', async () => {
    await useCompareStore.getState().toggle(1, 'car');
    await useCompareStore.getState().toggle(7, 'service');
    expect(useCompareStore.getState().items).toEqual([{ id: 7, type: 'service' }]);
  });

  it('удаление с экрана сравнения меняет тот же список', async () => {
    await useCompareStore.getState().toggle(1, 'car');
    await useCompareStore.getState().toggle(2, 'car');

    await useCompareStore.getState().remove({ id: 1, type: 'car' });
    expect(useCompareStore.getState().items).toEqual([{ id: 2, type: 'car' }]);
  });

  it('очистка убирает всё', async () => {
    await useCompareStore.getState().toggle(1, 'car');
    await useCompareStore.getState().clear();
    expect(useCompareStore.getState().items).toEqual([]);
  });

  it('объявление без числового id в сравнение не попадает', async () => {
    await useCompareStore.getState().toggle(undefined, 'car');
    expect(useCompareStore.getState().items).toEqual([]);
    expect(saveCompareItems).not.toHaveBeenCalled();
  });
});
