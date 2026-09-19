import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Подпись согласия; по умолчанию нейтральное «Продолжить». */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Разрушительное действие красит согласие в danger. */
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  id: number;
  resolve: (agreed: boolean) => void;
}

interface ConfirmState {
  request: PendingConfirm | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  answer: (agreed: boolean) => void;
}

let nextId = 0;

/**
 * Вопрос «точно?» в языке приложения вместо системного диалога. Ответ
 * приходит промисом: на месте вызова остаётся обычное «спросили — сделали»,
 * без разбросанных по экрану колбэков.
 */
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,

  ask: (options) => new Promise<boolean>((resolve) => {
    // Второй вопрос поверх первого — это ошибка вызова; отвечаем «нет» за
    // предыдущий, чтобы никто не остался ждать вечно.
    const current = get().request;
    if (current) current.resolve(false);
    set({ request: { ...options, id: ++nextId, resolve } });
  }),

  answer: (agreed) => {
    const current = get().request;
    if (!current) return;
    set({ request: null });
    current.resolve(agreed);
  },
}));

export const askConfirm = (options: ConfirmOptions) => useConfirmStore.getState().ask(options);
