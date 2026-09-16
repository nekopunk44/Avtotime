// Нативного рекордера в тестах нет, а проверяем чистый расчёт уровня.
jest.mock('expo-audio', () => ({ useAudioRecorderState: () => ({}) }));

import { meterToLevel } from '../components/VoiceWave';

describe('линия громкости при записи', () => {
  it('тишина прижимается ко дну, перегрузка — к потолку', () => {
    expect(meterToLevel(-160, 0)).toBe(0);
    expect(meterToLevel(-55, 0)).toBe(0);
    expect(meterToLevel(0, 0)).toBe(1);
  });

  it('обычная речь занимает середину, а не жмётся ко дну', () => {
    const speech = meterToLevel(-25, 0);
    expect(speech).toBeGreaterThan(0.5);
    expect(speech).toBeLessThan(0.9);
  });

  it('уровень растёт вместе с громкостью', () => {
    expect(meterToLevel(-40, 0)).toBeLessThan(meterToLevel(-20, 0));
  });

  it('без метеринга линия дышит, а не лежит', () => {
    const frames = [0, 1, 2, 3, 4, 5].map((tick) => meterToLevel(undefined, tick));
    expect(new Set(frames).size).toBeGreaterThan(1);
    frames.forEach((v) => {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    });
  });
});
