import { useSyncExternalStore } from 'react';

function subscribe(fn: () => void) {
  addEventListener('online', fn);
  addEventListener('offline', fn);
  return () => {
    removeEventListener('online', fn);
    removeEventListener('offline', fn);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
