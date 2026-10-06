import { useEffect, useState } from 'react';
import { type Article, article, WikiError } from '../lib/wiki.ts';

export type Loaded =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; article: Article }
  | { status: 'error'; key: string; kind: WikiError['kind'] };

export function useArticle(key: string, attempt: number): Loaded {
  const [state, setState] = useState<Loaded>({ status: 'loading', key });

  useEffect(() => {
    let live = true;
    setState({ status: 'loading', key });
    article(key, attempt > 0)
      .then((a) => {
        if (live) setState({ status: 'ready', key, article: a });
      })
      .catch((e: unknown) => {
        if (live)
          setState({
            status: 'error',
            key,
            kind: e instanceof WikiError ? e.kind : 'failed',
          });
      });
    return () => {
      live = false;
    };
  }, [key, attempt]);

  return state;
}

export function useDelayed(on: boolean, delay = 180, hold = 450) {
  const [shown, setShown] = useState(false);
  const [since, setSince] = useState(0);
  useEffect(() => {
    if (on && !shown) {
      const t = setTimeout(() => {
        setShown(true);
        setSince(Date.now());
      }, delay);
      return () => clearTimeout(t);
    }
    if (!on && shown) {
      const left = hold - (Date.now() - since);
      const t = setTimeout(() => setShown(false), Math.max(0, left));
      return () => clearTimeout(t);
    }
  }, [on, shown, since, delay, hold]);
  return shown;
}
