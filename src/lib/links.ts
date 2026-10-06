export const DROP = [
  'style',
  'link',
  'meta',
  'script',
  'sup.mw-ref',
  'sup.reference',
  '.mw-ref',
  '.mw-references-wrap',
  'ol.references',
  '.reflist',
  '.navbox',
  '.navbox-styles',
  '.vertical-navbox',
  '.sidebar',
  '.hatnote',
  '.dablink',
  '.metadata',
  '.ambox',
  '.ombox',
  '.tmbox',
  '.mbox-small',
  '.mw-editsection',
  '.sistersitebox',
  '.noprint',
  '.mw-empty-elt',
  '.shortdescription',
  '.portalbox',
  '.side-box',
  '.infobox',
  'table.sidebar',
  '.mw-kartographer-maplink',
  '.wikitable.mw-collapsed',
  'span[typeof="mw:Nowiki"]',
  'figure',
  'figure-inline',
  '[typeof~="mw:File"]',
  '[typeof~="mw:File/Thumb"]',
  '[typeof~="mw:File/Frameless"]',
  '.gallery',
  '.thumb',
  'img',
  'audio',
  'video',
  '.mw-halign-right',
  '.mw-halign-left',
];

export const STOP =
  /^(see also|references|notes|external links|further reading|sources|bibliography|citations|footnotes|works cited|notes and references|gallery)$/i;

const SKIP_NS =
  /^(File|Image|Help|Special|Category|Template|Wikipedia|Portal|Talk|Template_talk|Module|Draft|User|MediaWiki|TimedText|Book|Wikt|Wiktionary):/i;

export function strip(doc: Document) {
  for (const sel of DROP)
    for (const el of doc.querySelectorAll(sel)) el.remove();
  for (const sec of doc.querySelectorAll('section')) {
    const h = sec.querySelector(':scope > h2');
    if (h && STOP.test((h.textContent ?? '').trim())) sec.remove();
  }
}

export function targetOf(a: Element): string | null {
  const rel = a.getAttribute('rel') ?? '';
  const href = a.getAttribute('href') ?? '';
  if (!rel.includes('mw:WikiLink') || !href.startsWith('./')) return null;
  if (a.classList.contains('new')) return null;
  const raw = href.slice(2).split('#')[0]?.split('?')[0] ?? '';
  if (!raw) return null;
  let key: string;
  try {
    key = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (SKIP_NS.test(key)) return null;
  return normalise(key);
}

export function normalise(key: string) {
  const k = key.trim().replace(/ /g, '_');
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export function canonicalOf(doc: Document): string | null {
  const href =
    doc.querySelector('link[rel="dc:isVersionOf"]')?.getAttribute('href') ?? '';
  const m = href.match(/\/wiki\/(.+)$/);
  if (!m?.[1]) return null;
  try {
    return normalise(decodeURIComponent(m[1]));
  } catch {
    return null;
  }
}

export function playable(doc: Document): Set<string> {
  strip(doc);
  const out = new Set<string>();
  for (const a of doc.querySelectorAll('a')) {
    const t = targetOf(a);
    if (t) out.add(t);
  }
  return out;
}
