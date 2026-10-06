import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { canonicalOf, normalise, playable } from '../src/lib/links.ts';

const UA =
  'Kite/1.0 (https://kite.ashwin.co.in; course builder; ashwinnambiar12345@gmail.com)';
const REST = 'https://en.wikipedia.org/w/rest.php/v1/page';
const ACTION = 'https://en.wikipedia.org/w/api.php';
const CACHE = process.env.KITE_CACHE ?? '.course-cache';
const DAYS = Number(process.env.KITE_DAYS ?? 45);
const FIRST = process.env.KITE_FIRST ?? '2026-10-07';
const SEED = process.env.KITE_SEED ?? 'kite';

const POOL = [
  'Tea',
  'Coffee',
  'Chocolate',
  'Bread',
  'Rice',
  'Cheese',
  'Honey',
  'Pizza',
  'Sushi',
  'Curry',
  'Idli',
  'Mango',
  'Banana',
  'Potato',
  'Salt',
  'Sugar',
  'Black pepper',
  'Saffron',
  'Bicycle',
  'Lighthouse',
  'Origami',
  'Telescope',
  'Compass',
  'Printing press',
  'Steam engine',
  'Telephone',
  'Typewriter',
  'Camera',
  'Clock',
  'Piano',
  'Violin',
  'Guitar',
  'Sitar',
  'Tabla',
  'Bridge',
  'Windmill',
  'Submarine',
  'Airship',
  'Hot air balloon',
  'Kite',
  'Umbrella',
  'Paper',
  'Glass',
  'Concrete',
  'Rubber',
  'Silk',
  'Cotton',
  'Wool',
  'Denim',
  'Moon',
  'Sun',
  'Mars',
  'Jupiter',
  'Saturn',
  'Black hole',
  'Comet',
  'Galaxy',
  'Volcano',
  'Earthquake',
  'Glacier',
  'Desert',
  'Rainforest',
  'Coral reef',
  'Monsoon',
  'Tornado',
  'Lightning',
  'Rainbow',
  'Aurora',
  'Tide',
  'Penguin',
  'Elephant',
  'Tiger',
  'Octopus',
  'Honey bee',
  'Ant',
  'Whale',
  'Dolphin',
  'Shark',
  'Owl',
  'Peafowl',
  'King cobra',
  'Butterfly',
  'Dinosaur',
  'Wolf',
  'Horse',
  'Cat',
  'Dog',
  'Camel',
  'Giraffe',
  'Chess',
  'Cricket',
  'Association football',
  'Olympic Games',
  'Kabaddi',
  'Yoga',
  'Jazz',
  'Opera',
  'Ballet',
  'Bharatanatyam',
  'Hip hop music',
  'Reggae',
  'Mount Everest',
  'Sahara',
  'Amazon River',
  'Ganges',
  'Nile',
  'Great Wall of China',
  'Taj Mahal',
  'Eiffel Tower',
  'Egyptian pyramids',
  'Venice',
  'Antarctica',
  'Iceland',
  'Japan',
  'Brazil',
  'Kerala',
  'Mumbai',
  'Chennai',
  'Leonardo da Vinci',
  'Isaac Newton',
  'Albert Einstein',
  'Marie Curie',
  'Ada Lovelace',
  'Charles Darwin',
  'Mahatma Gandhi',
  'Cleopatra',
  'William Shakespeare',
  'Rabindranath Tagore',
  'Srinivasa Ramanujan',
  'C. V. Raman',
  'A. P. J. Abdul Kalam',
  'Frida Kahlo',
  'Ludwig van Beethoven',
  'Wolfgang Amadeus Mozart',
  'Satyajit Ray',
  'Democracy',
  'Money',
  'Bitcoin',
  'Internet',
  'Computer',
  'Robot',
  'Artificial intelligence',
  'Vaccine',
  'Penicillin',
  'DNA',
  'Electricity',
  'Magnet',
  'Gravity',
  'Photosynthesis',
  'Oxygen',
  'Gold',
  'Diamond',
  'Iron',
  'Water',
  'Fire',
  'Ice',
  'Mathematics',
  'Pi',
  'Calendar',
  'Alphabet',
  'Writing',
  'Library',
  'Museum',
  'Map',
  'Postage stamp',
  'Comics',
  'Animation',
  'Video game',
  'Lego',
  "Rubik's Cube",
  'Sudoku',
  'Piracy',
  'Samurai',
  'Vikings',
  'Knight',
  'Ninja',
  'Castle',
  'Mummy',
  'Dragon',
  'Unicorn',
];

type Page = { key: string; title: string; links: string[] };

let last = 0;
async function gate() {
  const wait = last + 340 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
}

async function get(url: string, tries = 4): Promise<Response> {
  await gate();
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if ((res.status === 429 || res.status >= 500) && tries > 0) {
    const after = Number(res.headers.get('retry-after') ?? 5);
    await new Promise((r) => setTimeout(r, Math.max(5, after) * 1000));
    return get(url, tries - 1);
  }
  return res;
}

function hash(s: string) {
  return createHash('sha1').update(s).digest('hex').slice(0, 16);
}

async function cached<T>(name: string, run: () => Promise<T>): Promise<T> {
  const file = join(CACHE, `${hash(name)}.json`);
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {}
  const v = await run();
  await writeFile(file, JSON.stringify(v));
  return v;
}

function page(key: string): Promise<Page | null> {
  return cached(`body2:${key}`, async () => {
    const res = await get(`${REST}/${encodeURIComponent(key)}/html`);
    if (!res.ok) return null;
    const { document } = parseHTML(await res.text());
    const canon =
      canonicalOf(document as unknown as Document) ?? normalise(key);
    const title = (
      document.querySelector('title')?.textContent ?? canon
    ).trim();
    const links = [...playable(document as unknown as Document)];
    return { key: canon, title, links };
  });
}

type Info = {
  key: string;
  title: string;
  redirects: string[];
  disambig: boolean;
  missing: boolean;
};

function info(key: string): Promise<Info> {
  return cached(`info:${key}`, async () => {
    const url = `${ACTION}?action=query&format=json&formatversion=2&redirects=1&prop=redirects|pageprops&rdlimit=max&rdnamespace=0&ppprop=disambiguation&titles=${encodeURIComponent(key)}`;
    const r = (await (await get(url)).json()) as {
      query: {
        pages: {
          title: string;
          missing?: boolean;
          redirects?: { title: string }[];
          pageprops?: { disambiguation?: string };
        }[];
      };
    };
    const p = r.query.pages[0];
    if (!p || p.missing)
      return { key, title: key, redirects: [], disambig: false, missing: true };
    return {
      key: normalise(p.title),
      title: p.title,
      redirects: (p.redirects ?? []).map((x) => normalise(x.title)),
      disambig: p.pageprops?.disambiguation !== undefined,
      missing: false,
    };
  });
}

async function linkersAmong(
  sources: string[],
  targets: string[],
): Promise<Set<string>> {
  const hits = new Set<string>();
  const want = targets.slice(0, 50).map((t) => t.replace(/_/g, ' '));
  for (let i = 0; i < sources.length; i += 50) {
    const batch = sources.slice(i, i + 50);
    const found = await cached(
      `lk:${batch.join('|')}>${want.join('|')}`,
      async () => {
        const out: string[] = [];
        let cont = '';
        for (;;) {
          const url = `${ACTION}?action=query&format=json&formatversion=2&redirects=1&prop=links&pllimit=max&plnamespace=0&titles=${encodeURIComponent(batch.map((b) => b.replace(/_/g, ' ')).join('|'))}&pltitles=${encodeURIComponent(want.join('|'))}${cont}`;
          const r = (await (await get(url)).json()) as {
            query?: {
              pages?: { title: string; links?: unknown[] }[];
              redirects?: { from: string; to: string }[];
            };
            continue?: { plcontinue: string };
          };
          const back = new Map<string, string>();
          for (const rd of r.query?.redirects ?? []) back.set(rd.to, rd.from);
          for (const p of r.query?.pages ?? [])
            if (p.links?.length)
              out.push(normalise(back.get(p.title) ?? p.title));
          if (!r.continue) break;
          cont = `&plcontinue=${encodeURIComponent(r.continue.plcontinue)}`;
        }
        return out;
      },
    );
    for (const f of found) hits.add(f);
  }
  return hits;
}

type Leg = { shortest: number; route: string[] };

async function distance(a: string, b: Info): Promise<Leg | null> {
  const A = await page(a);
  if (!A) return null;
  const goal = new Set([b.key, ...b.redirects]);
  if (A.links.some((l) => goal.has(l)))
    return { shortest: 1, route: [A.key, b.key] };
  const targets = [b.key, ...b.redirects];
  const mids = await linkersAmong(A.links, targets);
  for (const m of mids) {
    const M = await page(m);
    if (M?.links.some((l) => goal.has(l)) && M.key !== b.key)
      return { shortest: 2, route: [A.key, M.key, b.key] };
  }
  const order = [...A.links].sort((x, y) =>
    hash(`${SEED}${x}`).localeCompare(hash(`${SEED}${y}`)),
  );
  let tried = 0;
  for (const x of order) {
    if (tried >= 14) break;
    const X = await page(x);
    if (!X || X.key === b.key || X.key === A.key) continue;
    tried += 1;
    const ys = await linkersAmong(X.links, targets);
    for (const y of ys) {
      const Y = await page(y);
      if (
        Y?.links.some((l) => goal.has(l)) &&
        Y.key !== A.key &&
        Y.key !== b.key
      )
        return { shortest: 3, route: [A.key, X.key, Y.key, b.key] };
    }
  }
  return null;
}

function rng(seed: string) {
  let h = Number.parseInt(hash(seed).slice(0, 8), 16);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], r: () => number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

type Point = { key: string; title: string };
type Course = { id: string; points: Point[]; legs: Leg[]; shortest: number };

async function build(id: string, pool: Info[]): Promise<Course | null> {
  const r = rng(`${SEED}:${id}`);
  const order = shuffle(pool, r);
  const start = order[0];
  if (!start) return null;
  const points: Info[] = [start];
  const legs: Leg[] = [];
  let cursor = 1;
  while (points.length < 4 && cursor < order.length) {
    const prev = points[points.length - 1] as Info;
    const cand = order[cursor++] as Info;
    if (points.some((p) => p.key === cand.key)) continue;
    const leg = await distance(prev.key, cand);
    if (!leg || leg.shortest < 2) continue;
    points.push(cand);
    legs.push(leg);
    process.stdout.write(`  ${prev.title} -> ${cand.title}: ${leg.shortest}\n`);
  }
  if (points.length < 4) return null;
  return {
    id,
    points: points.map((p) => ({ key: p.key, title: p.title })),
    legs,
    shortest: legs.reduce((n, l) => n + l.shortest, 0),
  };
}

await mkdir(CACHE, { recursive: true });
const infos: Info[] = [];
for (const t of POOL) {
  const i = await info(t);
  if (i.missing || i.disambig) {
    console.warn(`skip ${t}`);
    continue;
  }
  infos.push(i);
}
console.log(`${infos.length} pool articles`);

const out = 'src/data/courses.json';
let existing: { first: string; courses: Course[] } = {
  first: FIRST,
  courses: [],
};
try {
  existing = JSON.parse(await readFile(out, 'utf8'));
} catch {}
const courses = existing.courses;
let n = courses.length;
while (courses.length < DAYS) {
  const id = `c${String(n + 1).padStart(3, '0')}`;
  n += 1;
  console.log(id);
  const c = await build(id, infos);
  if (!c) continue;
  courses.push(c);
  await mkdir('src/data', { recursive: true });
  await writeFile(
    out,
    `${JSON.stringify({ first: existing.first, courses }, null, 2)}\n`,
  );
}
await writeFile(
  'src/data/pool.json',
  `${JSON.stringify(
    infos.map((i) => ({ key: i.key, title: i.title })),
    null,
    2,
  )}\n`,
);
console.log(`${courses.length} courses written`);
