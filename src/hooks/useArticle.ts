import { useEffect, useState } from 'react';
import {
  type Article,
  article,
  cachedArticle,
  WikiError,
} from '../lib/wiki.ts';

export type Loaded =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; article: Article }
  | { status: 'error'; key: string; kind: WikiError['kind'] };

function initialLoad(key: string, attempt: number): Loaded {
  const cached = attempt === 0 ? cachedArticle(key) : null;
  return cached
    ? { status: 'ready', key, article: cached }
    : { status: 'loading', key };
}

export function useArticle(key: string, attempt: number): Loaded {
  const [state, setState] = useState(() => ({
    key,
    attempt,
    loaded: initialLoad(key, attempt),
  }));

  useEffect(() => {
    let live = true;
    setState({ key, attempt, loaded: initialLoad(key, attempt) });
    article(key, attempt > 0)
      .then((a) => {
        if (live)
          setState({
            key,
            attempt,
            loaded: { status: 'ready', key, article: a },
          });
      })
      .catch((e: unknown) => {
        if (live)
          setState({
            key,
            attempt,
            loaded: {
              status: 'error',
              key,
              kind: e instanceof WikiError ? e.kind : 'failed',
            },
          });
      });
    return () => {
      live = false;
    };
  }, [key, attempt]);
  return state.key === key && state.attempt === attempt
    ? state.loaded
    : initialLoad(key, attempt);
}
