import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { daily, dayKey, newSeed } from './course.ts';

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

let activeTransition: ViewTransition | null = null;
let keyboardNavigation = false;
addEventListener(
  'pointerdown',
  () => {
    keyboardNavigation = false;
  },
  true,
);
addEventListener(
  'keydown',
  () => {
    keyboardNavigation = true;
  },
  true,
);

export function shouldAnimateNavigation() {
  return (
    !keyboardNavigation &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function transition(update: () => void, animate = true) {
  activeTransition?.skipTransition();
  if (
    !document.startViewTransition ||
    !animate ||
    !shouldAnimateNavigation() ||
    document.hidden
  ) {
    update();
    return;
  }
  const next = document.startViewTransition(() => {
    flushSync(update);
  });
  activeTransition = next;
  next.ready.catch(() => {});
  next.updateCallbackDone.catch(() => {});
  next.finished
    .catch(() => {})
    .then(() => {
      if (activeTransition === next) activeTransition = null;
    });
}

addEventListener('popstate', () => {
  transition(notify, location.pathname !== seen);
});

export function navigate(path: string, replace = false) {
  const destination = new URL(path, location.href);
  if (destination.pathname === '/today')
    destination.pathname = `/c/${daily(dayKey()).id}`;
  if (destination.pathname === '/timed')
    destination.pathname = `/c/t-${newSeed()}`;
  const go = () => {
    history[replace ? 'replaceState' : 'pushState'](
      null,
      '',
      `${destination.pathname}${destination.search}${destination.hash}`,
    );
    scrollTo(0, 0);
    notify();
  };
  transition(
    go,
    !['today', 'timed'].includes(read().name) &&
      destination.pathname !== location.pathname,
  );
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
