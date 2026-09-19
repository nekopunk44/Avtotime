import fs from 'fs';
import path from 'path';

// Системные диалоги заменены своими: плашкой, шторкой подтверждения и
// выбором снизу. Тест держит границу — иначе светлые коробки возвращаются
// по одной вместе с новыми экранами.
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

describe('системных Alert в приложении нет', () => {
  it('ни один экран не зовёт Alert.alert', () => {
    const offenders = walk(path.join(__dirname, '..'))
      .filter((file) => /Alert\.alert\s*\(/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(path.join(__dirname, '..'), file));

    expect(offenders).toEqual([]);
  });
});
