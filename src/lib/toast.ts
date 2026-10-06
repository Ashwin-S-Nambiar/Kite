import { createStore } from './store.ts';

export type Toast = { id: number; text: string; quiet: boolean };

export const toastStore = createStore<Toast | null>(null, null);
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

export function announce(text: string, ms = 2800, quiet = false) {
  clearTimeout(timer);
  seq += 1;
  const id = seq;
  toastStore.set({ id, text, quiet });
  timer = setTimeout(() => {
    if (toastStore.get()?.id === id) toastStore.set(null);
  }, ms);
}

export function dismiss() {
  clearTimeout(timer);
  toastStore.set(null);
}
