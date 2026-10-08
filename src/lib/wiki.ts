import DOMPurify from 'dompurify';
import { canonicalOf, normalise, strip, targetOf } from './links.ts';

const PAGE = 'https://en.wikipedia.org/w/rest.php/v1/page';
const REST = 'https://en.wikipedia.org/api/rest_v1';
const HEADERS = {
  'Api-User-Agent':
    'Kite/1.0 (https://kite.ashwin.co.in; ashwinnambiar12345@gmail.com)',
};

export type Article = { key: string; title: string; html: string };
export type Summary = { key: string; title: string; extract: string };

const cache = new Map<string, Promise<unknown>>();
const articles = new Map<string, Article>();

export function cachedArticle(key: string) {
  return articles.get(key) ?? null;
}

export function prefetchArticle(key: string) {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (
    document.hidden ||
    !navigator.onLine ||
    connection?.saveData ||
    ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')
  )
    return;
  article(key).catch(() => {});
}

function memo<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const p = run().catch((e: unknown) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, p);
  return p;
}

export class WikiError extends Error {
  kind: 'missing' | 'busy' | 'offline' | 'failed';
  constructor(kind: 'missing' | 'busy' | 'offline' | 'failed') {
    super(kind);
    this.kind = kind;
  }
}

async function request(url: string) {
  let res: Response;
  try {
    res = await fetch(url, { headers: HEADERS });
  } catch {
    throw new WikiError(navigator.onLine ? 'failed' : 'offline');
  }
  if (res.status === 404) throw new WikiError('missing');
  if (res.status === 429) throw new WikiError('busy');
  if (!res.ok) throw new WikiError('failed');
  return res;
}

export function toTitle(key: string) {
  return key.replace(/_/g, ' ');
}

function transform(requested: string, source: string): Article {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const key = canonicalOf(doc) ?? normalise(requested);
  const title = (doc.querySelector('title')?.textContent ?? toTitle(key))
    .replace(/<[^>]+>/g, '')
    .trim();
  strip(doc);
  for (const a of doc.querySelectorAll('a')) {
    const target = targetOf(a);
    if (!target) {
      a.replaceWith(...a.childNodes);
      continue;
    }
    const clean = doc.createElement('a');
    clean.setAttribute('href', `https://en.wikipedia.org/wiki/${target}`);
    clean.setAttribute('data-k', target);
    clean.append(...a.childNodes);
    a.replaceWith(clean);
  }
  for (const t of doc.querySelectorAll('table')) {
    const wrap = doc.createElement('div');
    wrap.className = 'table-wrap';
    t.replaceWith(wrap);
    wrap.append(t);
  }
  for (const h of doc.querySelectorAll('h2, h3, h4')) h.removeAttribute('id');
  for (const el of doc.body.querySelectorAll('[style]'))
    el.removeAttribute('style');
  for (const el of doc.body.querySelectorAll(
    '[id], [about], [data-mw], [typeof], [class]',
  )) {
    el.removeAttribute('id');
    el.removeAttribute('about');
    el.removeAttribute('data-mw');
    el.removeAttribute('typeof');
    if (!el.classList.contains('table-wrap')) el.removeAttribute('class');
  }
  const html = DOMPurify.sanitize(doc.body.innerHTML, {
    ADD_ATTR: ['data-k'],
    FORBID_TAGS: [
      'form',
      'input',
      'button',
      'iframe',
      'audio',
      'video',
      'img',
      'source',
      'svg',
      'math',
    ],
    FORBID_ATTR: ['style', 'srcset'],
  });
  return { key, title, html };
}

export function article(key: string, fresh = false) {
  if (fresh) {
    cache.delete(`a:${key}`);
    articles.delete(key);
  }
  return memo(`a:${key}`, async () => {
    const res = await request(`${PAGE}/${encodeURIComponent(key)}/html`);
    const a = transform(key, await res.text());
    articles.set(key, a);
    articles.set(a.key, a);
    if (a.key !== key && !cache.has(`a:${a.key}`))
      cache.set(`a:${a.key}`, Promise.resolve(a));
    return a;
  });
}

export function summary(key: string) {
  return memo(`s:${key}`, async () => {
    const res = await request(
      `${REST}/page/summary/${encodeURIComponent(key)}`,
    );
    const r = (await res.json()) as {
      title: string;
      titles?: { canonical: string; normalized?: string };
      extract?: string;
    };
    return {
      key: normalise(r.titles?.canonical ?? r.title),
      title: r.titles?.normalized ?? r.title.replace(/_/g, ' '),
      extract: r.extract ?? '',
    } satisfies Summary;
  });
}

export function wikiUrl(key: string) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(key)}`;
}
