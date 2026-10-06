import {
  byId,
  type Course,
  daily,
  dayKey,
  type Point,
  registerCodes,
  shiftDay,
  type TimedSet,
  timedSet,
} from './course.ts';
import { createStore, useStore } from './store.ts';

export const TIMED_LIMIT = 10 * 60 * 1000;

export type Hop = { key: string; title: string };

export type Run = {
  id: string;
  kind: 'course' | 'timed';
  day: string | null;
  elapsed: number;
  since: number | null;
  paused: boolean;
  leg: number;
  stack: Hop[];
  clicks: number;
  legClicks: number[];
  legTimes: number[];
  routes: string[][];
  punched: string[];
  done: boolean;
  out: boolean;
};

export type Result = {
  id: string;
  kind: 'course' | 'timed';
  day: string | null;
  clicks: number;
  time: number;
  legClicks: number[];
  legTimes: number[];
  routes: string[][];
  punched: string[];
  at: number;
};

export const runs = createStore<Record<string, Run>>('kite:runs', {});
export const results = createStore<Record<string, Result>>('kite:results', {});

export function useRun(id: string) {
  return useStore(runs)[id] ?? null;
}

export function useResults() {
  return useStore(results);
}

export function timedId(seed: string) {
  return `t-${seed}`;
}

export type Plan = {
  kind: 'course' | 'timed';
  id: string;
  points: Point[];
  course: Course | null;
  timed: TimedSet | null;
};

export function plan(id: string): Plan | null {
  if (id.startsWith('t-')) {
    const set = timedSet(id.slice(2));
    registerCodes([set.start, ...set.checkpoints]);
    return {
      kind: 'timed',
      id,
      points: [set.start, ...set.checkpoints],
      course: null,
      timed: set,
    };
  }
  const course = byId(id);
  if (!course) return null;
  registerCodes(course.points);
  return { kind: 'course', id, points: course.points, course, timed: null };
}

export function elapsed(r: Run, now = Date.now()) {
  return r.elapsed + (r.since ? now - r.since : 0);
}

function put(id: string, fn: (r: Run) => Run) {
  runs.set((all) => {
    const r = all[id];
    if (!r) return all;
    return { ...all, [id]: fn(r) };
  });
}

export function start(p: Plan) {
  const today = dayKey();
  const first = p.points[0] as Point;
  const run: Run = {
    id: p.id,
    kind: p.kind,
    day: p.kind === 'course' && daily(today).id === p.id ? today : null,
    elapsed: 0,
    since: null,
    paused: false,
    leg: 0,
    stack: [{ key: first.key, title: first.title }],
    clicks: 0,
    legClicks: p.kind === 'course' ? (p.course?.legs.map(() => 0) ?? []) : [],
    legTimes: [],
    routes: [],
    punched: [],
    done: false,
    out: false,
  };
  runs.set((all) => ({ ...all, [p.id]: run }));
  return run;
}

export function discard(id: string) {
  runs.set((all) => {
    const { [id]: _, ...rest } = all;
    return rest;
  });
}

export function resume(id: string) {
  put(id, (r) =>
    r.done || r.since || r.paused ? r : { ...r, since: Date.now() },
  );
}

export function hold(id: string) {
  put(id, (r) => (r.since ? { ...r, elapsed: elapsed(r), since: null } : r));
}

export function unpause(id: string) {
  put(id, (r) =>
    r.done ? r : { ...r, paused: false, since: r.since ?? Date.now() },
  );
}

export function go(id: string, hop: Hop) {
  put(id, (r) => {
    if (r.done || r.paused) return r;
    const legClicks = [...r.legClicks];
    if (r.kind === 'course') legClicks[r.leg] = (legClicks[r.leg] ?? 0) + 1;
    return {
      ...r,
      clicks: r.clicks + 1,
      legClicks,
      stack: [...r.stack, hop],
    };
  });
}

export function canBack(r: Run) {
  return !r.done && !r.paused && r.stack.length > 1;
}

export function back(id: string) {
  put(id, (r) => {
    if (!canBack(r)) return r;
    const legClicks = [...r.legClicks];
    if (r.kind === 'course') legClicks[r.leg] = (legClicks[r.leg] ?? 0) + 1;
    return {
      ...r,
      clicks: r.clicks + 1,
      legClicks,
      stack: r.stack.slice(0, -1),
    };
  });
}

export type Outcome = 'none' | 'punch' | 'finish';

export function arrive(id: string, p: Plan, landed: Hop): Outcome {
  let outcome = 'none' as Outcome;
  put(id, (r) => {
    if (r.done) return r;
    const stack = [...r.stack.slice(0, -1), landed];
    const now = Date.now();
    if (r.kind === 'course') {
      const target = p.points[r.leg + 1];
      if (!target || landed.key !== target.key || r.paused)
        return { ...r, stack };
      const time = elapsed(r, now);
      const legTimes = [...r.legTimes, time];
      const routes = [...r.routes, stack.map((h) => h.key)];
      const punched = [...r.punched, landed.key];
      const last = r.leg + 1 >= p.points.length - 1;
      outcome = last ? 'finish' : 'punch';
      return {
        ...r,
        stack: last ? stack : [landed],
        legTimes,
        routes,
        punched,
        leg: last ? r.leg : r.leg + 1,
        elapsed: time,
        since: null,
        paused: !last,
        done: last,
      };
    }
    const hit = p.points
      .slice(1)
      .find((pt) => pt.key === landed.key && !r.punched.includes(pt.key));
    if (!hit) return { ...r, stack };
    const time = elapsed(r, now);
    const punched = [...r.punched, hit.key];
    const legTimes = [...r.legTimes, time];
    const routes = [...r.routes, stack.map((h) => h.key)];
    const all = punched.length >= p.points.length - 1;
    outcome = all ? 'finish' : 'punch';
    return {
      ...r,
      stack: [landed],
      punched,
      legTimes,
      routes,
      elapsed: all ? time : r.elapsed,
      since: all ? null : r.since,
      done: all,
    };
  });
  const r = runs.get()[id];
  if (r?.done) record(r);
  return outcome;
}

export function timeUp(id: string) {
  put(id, (r) =>
    r.done
      ? r
      : {
          ...r,
          elapsed: TIMED_LIMIT,
          since: null,
          done: true,
          out: true,
        },
  );
  const r = runs.get()[id];
  if (r) record(r);
}

function record(r: Run) {
  const res: Result = {
    id: r.id,
    kind: r.kind,
    day: r.day,
    clicks: r.clicks,
    time: Math.min(r.elapsed, r.kind === 'timed' ? TIMED_LIMIT : r.elapsed),
    legClicks: r.legClicks,
    legTimes: r.legTimes,
    routes: r.routes,
    punched: r.punched,
    at: Date.now(),
  };
  results.set((all) => {
    const prev = all[r.id];
    if (prev && r.kind === 'course' && prev.day && !r.day) return all;
    return { ...all, [r.id]: res };
  });
}

export function finishedDays(all: Record<string, Result>) {
  return new Set(
    Object.values(all)
      .map((r) => r.day)
      .filter((d): d is string => Boolean(d)),
  );
}

export function streak(all: Record<string, Result>, today = dayKey()) {
  const days = finishedDays(all);
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

export function splitOf(r: { legTimes: number[] }, i: number) {
  return (r.legTimes[i] ?? 0) - (i > 0 ? (r.legTimes[i - 1] ?? 0) : 0);
}

export type Rival = { c: number[]; t: number[] };

export function encodeRival(r: Result): string {
  const json = JSON.stringify({
    c: r.legClicks,
    t: r.legTimes.map((t, i) =>
      Math.round((t - (i ? (r.legTimes[i - 1] ?? 0) : 0)) / 100),
    ),
  });
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeRival(s: string | null): Rival | null {
  if (!s) return null;
  try {
    const v = JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/'))) as {
      c: unknown;
      t: unknown;
    };
    if (
      !Array.isArray(v.c) ||
      !Array.isArray(v.t) ||
      v.c.length > 8 ||
      !v.c.every((n) => Number.isInteger(n) && n >= 0 && n < 500) ||
      !v.t.every((n) => Number.isInteger(n) && n >= 0 && n < 360000)
    )
      return null;
    return { c: v.c as number[], t: (v.t as number[]).map((n) => n * 100) };
  } catch {
    return null;
  }
}
