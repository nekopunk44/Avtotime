import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastMessage {
  /** Идентификатор нужен, чтобы одинаковый текст подряд снова показывался. */
  id: number;
  text: string;
  tone: ToastTone;
}

interface ToastState {
  toast: ToastMessage | null;
  show: (text: string, tone?: ToastTone) => void;
  hide: () => void;
}

let nextId = 0;

/**
 * Короткие сообщения приложения. Системный Alert для них не годится: он
 * светлой коробкой останавливает экран и требует нажать «ОК» там, где
 * достаточно просто сообщить.
 */
export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (text, tone = 'info') => set({ toast: { id: ++nextId, text, tone } }),
  hide: () => set({ toast: null }),
}));

export const showToast = (text: string, tone: ToastTone = 'info') =>
  useToastStore.getState().show(text, tone);
