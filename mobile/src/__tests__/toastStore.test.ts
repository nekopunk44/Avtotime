import { useToastStore, showToast } from '../store/toastStore';

describe('короткие сообщения приложения', () => {
  beforeEach(() => { useToastStore.getState().hide(); });

  it('показывает текст и тон', () => {
    showToast('Добавлено в сравнение', 'success');
    const { toast } = useToastStore.getState();
    expect(toast?.text).toBe('Добавлено в сравнение');
    expect(toast?.tone).toBe('success');
  });

  it('по умолчанию тон нейтральный', () => {
    showToast('Список заменён');
    expect(useToastStore.getState().toast?.tone).toBe('info');
  });

  it('одинаковый текст подряд считается новым сообщением', () => {
    showToast('Убрано из сравнения');
    const first = useToastStore.getState().toast?.id;
    showToast('Убрано из сравнения');
    expect(useToastStore.getState().toast?.id).not.toBe(first);
  });

  it('скрытие убирает сообщение', () => {
    showToast('Что-то пошло не так', 'error');
    useToastStore.getState().hide();
    expect(useToastStore.getState().toast).toBeNull();
  });
});
