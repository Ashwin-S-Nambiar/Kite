import data from '../data/courses.json';
import pool from '../data/pool.json';

export type Point = { key: string; title: string };
export type Leg = { shortest: number; route: string[] };
export type Course = {
  id: string;
  points: Point[];
  legs: Leg[];
  shortest: number;
};
export type Level = 'easy' | 'medium' | 'hard';

const courses = data.courses as Course[];
const DAY = 86_400_000;

export const POOL = pool as Point[];

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function midnight(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1).getTime();
}

export function daysBetween(a: string, b: string) {
  return Math.round((midnight(b) - midnight(a)) / DAY);
}

export function shiftDay(key: string, by: number) {
  return dayKey(new Date(midnight(key) + by * DAY + DAY / 2));
}

export function daily(key = dayKey()): Course {
  const n = courses.length;
  const i = (((daysBetween(data.first, key) % n) + n) % n) as number;
  return courses[i] as Course;
}

export function dailyKeyFor(id: string, today = dayKey()) {
  return daily(today).id === id ? today : null;
}

export function byId(id: string) {
  return courses.find((c) => c.id === id) ?? null;
}

export function level(c: Course): Level {
  if (c.shortest <= 6) return 'easy';
  if (c.shortest <= 7) return 'medium';
  return 'hard';
}

export function pick(l: Level, not: string[] = []) {
  const options = courses.filter((c) => level(c) === l && !not.includes(c.id));
  const from = options.length
    ? options
    : courses.filter((c) => !not.includes(c.id));
  return from[Math.floor(Math.random() * from.length)] ?? courses[0];
}

function rng(seed: number) {
  let h = seed | 0;
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type TimedSet = { seed: string; start: Point; checkpoints: Point[] };

export function timedSet(seed: string): TimedSet {
  const r = rng(Number.parseInt(seed, 36) || 1);
  const a = [...POOL];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j] as Point, a[i] as Point];
  }
  return {
    seed,
    start: a[0] as Point,
    checkpoints: a.slice(1, 6),
  };
}

export function newSeed() {
  return Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
}

const codes = new Map<string, number>();

function hashCode(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return 31 + (Math.abs(h) % 69);
}

export function registerCodes(points: Point[]) {
  const used = new Set<number>();
  for (const p of points) {
    let c = hashCode(p.key);
    while (used.has(c)) c = c >= 99 ? 31 : c + 1;
    used.add(c);
    codes.set(p.key, c);
  }
}

export function code(key: string) {
  return codes.get(key) ?? hashCode(key);
}

export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function spoken(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const parts = [];
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  parts.push(`${r} second${r === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export function dateLabel(key: string) {
  return new Date(midnight(key)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function pins(key: string, n = 9) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out: number[] = [];
  let x = h >>> 0;
  while (out.length < 4 + ((h >>> 3) % 3)) {
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
    const p = x % n;
    if (!out.includes(p)) out.push(p);
  }
  return out;
}
