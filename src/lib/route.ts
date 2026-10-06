import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'today' }
  | { name: 'timed' }
  | { name: 'brief'; id: string }
  | { name: 'run'; id: string }
  | { name: 'card'; id: string }
  | { name: 'missing' };

const listeners = new Set<() => void>();
let seen = '';
let cached: Route = { name: 'home' };

function parse(path: string): Route {
  if (path === '/' || path === '/index.html') return { name: 'home' };
  if (path === '/today') return { name: 'today' };
  if (path === '/timed') return { name: 'timed' };
  const m = path.match(/^\/c\/([a-z0-9-]{2,12})(\/run|\/card)?\/?$/);
  if (m?.[1]) {
    if (m[2] === '/run') return { name: 'run', id: m[1] };
    if (m[2] === '/card') return { name: 'card', id: m[1] };
    return { name: 'brief', id: m[1] };
  }
  return { name: 'missing' };
}

function read() {
  if (location.pathname !== seen) {
    seen = location.pathname;
    cached = parse(seen);
  }
  return cached;
}

function notify() {
  for (const l of listeners) l();
}

addEventListener('popstate', notify);

export function navigate(path: string, replace = false) {
  const go = () => {
    history[replace ? 'replaceState' : 'pushState'](null, '', path);
    scrollTo(0, 0);
    notify();
  };
  const doc = document as Document & {
    startViewTransition?: (fn: () => void) => unknown;
  };
  if (
    doc.startViewTransition &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    doc.startViewTransition(go);
  else go();
}

export function useRoute() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    read,
  );
}

export function param(name: string) {
  return new URLSearchParams(location.search).get(name);
}
