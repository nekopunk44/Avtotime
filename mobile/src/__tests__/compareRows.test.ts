import { betterIndex, numericOf } from '../screens/CompareScreen';

describe('подсказка «что выгоднее» в сравнении', () => {
  it('число вытаскивается из цены и пробега с разрядами', () => {
    expect(numericOf('34 900 €')).toBe(34900);
    expect(numericOf('74 000 км')).toBe(74000);
    expect(numericOf('4,5/5')).toBe(4.5);
    expect(numericOf('Кишинев')).toBeNull();
  });

  it('меньшая цена и меньший пробег выигрывают', () => {
    expect(betterIndex(['34 900 €', '24 900 €'], 'low', true)).toBe(1);
    expect(betterIndex(['74 000 км', '68 000 км'], 'low', true)).toBe(1);
  });

  it('больший год и рейтинг выигрывают', () => {
    expect(betterIndex(['2019', '2021'], 'high', true)).toBe(1);
    expect(betterIndex(['4,8/5', '4,1/5'], 'high', true)).toBe(0);
  });

  it('равные, нечисловые и несравнимые значения победителя не дают', () => {
    expect(betterIndex(['2021', '2021'], 'high', true)).toBe(-1);
    expect(betterIndex(['Бензин', 'Гибрид'], 'low', true)).toBe(-1);
    expect(betterIndex(['34 900 €', '€ 20/ч'], 'low', false)).toBe(-1);
    expect(betterIndex(['34 900 €', ''], 'low', true)).toBe(-1);
  });

  it('без правила сравнения строка остаётся нейтральной', () => {
    expect(betterIndex(['10', '20'], undefined, true)).toBe(-1);
  });
});
