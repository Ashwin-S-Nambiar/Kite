import { useLayoutEffect, useMemo, useRef, useState } from 'react';

type P = [number, number];

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blob(c: P, r: number, wobble: number[]) {
  const n = wobble.length;
  const pts: P[] = wobble.map((w, i) => {
    const a = (i / n) * Math.PI * 2;
    return [c[0] + Math.cos(a) * r * w, c[1] + Math.sin(a) * r * w * 0.78];
  });
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n] as P;
    const p1 = pts[i] as P;
    const p2 = pts[(i + 1) % n] as P;
    const p3 = pts[(i + 2) % n] as P;
    if (i === 0) d += `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

function trim(a: P, b: P, ra: number, rb: number): [P, P] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [
    [a[0] + (dx / len) * ra, a[1] + (dy / len) * ra],
    [b[0] - (dx / len) * rb, b[1] - (dy / len) * rb],
  ];
}

function wiggle(a: P, b: P, stops: number, r: () => number, end = 1): P[] {
  const out: P[] = [a];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i <= stops; i++) {
    const t = (i / (stops + 1)) * end;
    const off = (r() - 0.5) * len * 0.34;
    out.push([a[0] + dx * t + nx * off, a[1] + dy * t + ny * off]);
  }
  if (end >= 1) out.push(b);
  return out;
}

function smooth(pts: P[]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0]?.[0].toFixed(1)} ${pts[0]?.[1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i] as P;
    const q = pts[i - 1] as P;
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    d += ` Q${q[0].toFixed(1)} ${q[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1] as P;
  d += ` T${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  return d;
}

export type MapLeg = { hops: number; done: boolean };

export default function CourseMap({
  seed,
  count,
  kind,
  active,
  punched,
  legs,
  current,
  focus = false,
  draw = false,
  labels = true,
  className = '',
  pad = 36,
}: {
  seed: string;
  count: number;
  kind: 'course' | 'timed';
  active: number;
  punched: number[];
  legs: MapLeg[];
  current: number;
  focus?: boolean;
  draw?: boolean;
  labels?: boolean;
  className?: string;
  pad?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize([el.clientWidth, el.clientHeight]);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [w, h] = size;

  const art = useMemo(() => {
    if (!w || !h) return null;
    const r = rng(seed);
    const m = Math.min(w, h);
    const ix = pad;
    const iy = pad;
    const iw = Math.max(10, w - pad * 2);
    const ih = Math.max(10, h - pad * 2);
    const at = (x: number, y: number): P => [ix + x * iw, iy + y * ih];
    let pts: P[];
    if (kind === 'course') {
      const flip = r() > 0.5;
      pts = Array.from({ length: count }, (_, i) => {
        const t = i / Math.max(1, count - 1);
        const x = 0.06 + t * 0.88 + (r() - 0.5) * 0.12;
        const y = 0.9 - t * 0.8 + (i % 2 ? -1 : 1) * (0.06 + r() * 0.12);
        return at(flip ? 1 - x : x, Math.min(0.96, Math.max(0.04, y)));
      });
    } else {
      const start = at(0.5, 0.86);
      pts = [start];
      const n = count - 1;
      for (let i = 0; i < n; i++) {
        const a =
          Math.PI * (1.05 + (i / Math.max(1, n - 1)) * 0.9) + (r() - 0.5) * 0.3;
        const rad = 0.42 + r() * 0.08;
        pts.push(at(0.5 + Math.cos(a) * rad, 0.62 + Math.sin(a) * rad * 1.15));
      }
    }
    const hills = Array.from({ length: 3 }, () => {
      const c = at(0.15 + r() * 0.7, 0.15 + r() * 0.7);
      const base = m * (0.18 + r() * 0.12);
      const wob = Array.from({ length: 8 }, () => 0.78 + r() * 0.44);
      return [1, 0.72, 0.46].map((k) => blob(c, base * k, wob));
    });
    const woods = Array.from({ length: 3 }, (_, i) => {
      const c: P = i === 0 ? [0, h] : i === 1 ? [w, 0] : at(r(), r());
      return blob(
        c,
        m * (0.3 + r() * 0.25),
        Array.from({ length: 8 }, () => 0.7 + r() * 0.6),
      );
    });
    const lake = blob(
      at(0.2 + r() * 0.6, 0.2 + r() * 0.6),
      m * (0.08 + r() * 0.05),
      Array.from({ length: 7 }, () => 0.75 + r() * 0.5),
    );
    return {
      pts,
      hills,
      woods,
      lake,
      unit: Math.max(11, Math.min(22, m * 0.05)),
    };
  }, [w, h, seed, kind, count, pad]);

  const route = useMemo(() => {
    if (!art) return [];
    const r = rng(`${seed}:route`);
    const out: { d: string; you?: P; done: boolean }[] = [];
    if (kind === 'course') {
      legs.forEach((leg, i) => {
        const a = art.pts[i];
        const b = art.pts[i + 1];
        if (!a || !b) return;
        if (leg.done) {
          out.push({
            d: smooth(wiggle(a, b, Math.max(0, leg.hops - 1), r)),
            done: true,
          });
        } else if (i === current && leg.hops > 0) {
          const frac = Math.min(0.8, leg.hops / (leg.hops + 1.6));
          const pts = wiggle(a, b, leg.hops, r, frac);
          out.push({ d: smooth(pts), you: pts[pts.length - 1], done: false });
        }
      });
    } else {
      const last = punched.length
        ? art.pts[punched[punched.length - 1] ?? 0]
        : art.pts[0];
      const hops = legs[0]?.hops ?? 0;
      if (last && hops > 0) {
        const angle = r() * Math.PI * 2;
        const reach = Math.min(art.unit * 4, 18 + hops * 8);
        const you: P = [
          last[0] + Math.cos(angle) * reach,
          last[1] + Math.sin(angle) * reach,
        ];
        out.push({
          d: smooth(wiggle(last, you, Math.min(3, hops - 1), r)),
          you,
          done: false,
        });
      }
    }
    return out;
  }, [art, legs, current, kind, seed, punched]);

  let view = '';
  if (art && focus && kind === 'course') {
    const a = art.pts[current];
    const b = art.pts[current + 1];
    if (a && b) {
      const cx = (a[0] + b[0]) / 2;
      const cy = (a[1] + b[1]) / 2;
      const s = 1.18;
      view = `translate(${(w / 2 - cx * s).toFixed(1)}px, ${(h / 2 - cy * s).toFixed(1)}px) scale(${s})`;
    }
  }

  return (
    <div
      ref={box}
      className={`overflow-hidden bg-paper ${className || 'relative'}`}
      aria-hidden="true"
    >
      {art && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0"
          aria-hidden="true"
        >
          <g
            style={{
              transform: view || 'none',
              transformOrigin: '0 0',
              transition: 'transform 380ms var(--ease-drawer)',
            }}
          >
            {art.woods.map((d) => (
              <path key={d} d={d} fill="#c8e6b8" />
            ))}
            <path d={art.lake} fill="#3aa6dc" opacity="0.55" />
            <g fill="none" stroke="#c06a2b" strokeWidth="1.3" opacity="0.75">
              {art.hills.flatMap((ring) =>
                ring.map((d, i) => (
                  <path key={d} d={d} strokeWidth={i === 2 ? 2.2 : 1.3} />
                )),
              )}
            </g>
            <g fill="none" stroke="#ef6420" strokeWidth={2.6}>
              {kind === 'course' &&
                art.pts.slice(0, -1).map((p, i) => {
                  const q = art.pts[i + 1] as P;
                  const [s, e] = trim(
                    p,
                    q,
                    i === 0 ? art.unit * 0.9 : art.unit,
                    i + 1 === art.pts.length - 1 ? art.unit * 1.6 : art.unit,
                  );
                  return (
                    <line
                      key={`l${p[0]}`}
                      x1={s[0]}
                      y1={s[1]}
                      x2={e[0]}
                      y2={e[1]}
                      strokeWidth={i === active ? 3.6 : 2.6}
                    />
                  );
                })}
              {art.pts.map((p, i) => {
                const u = art.unit;
                const hot = kind === 'course' ? i === active + 1 : false;
                const got = punched.includes(i);
                if (i === 0)
                  return (
                    <path
                      key="start"
                      d={`M${p[0] - u} ${p[1] + u * 0.7} L${p[0]} ${p[1] - u * 0.95} L${p[0] + u} ${p[1] + u * 0.7} Z`}
                    />
                  );
                if (kind === 'course' && i === art.pts.length - 1)
                  return (
                    <g key="finish" strokeWidth={hot ? 3.6 : 2.6}>
                      <circle cx={p[0]} cy={p[1]} r={u * 0.7} />
                      <circle cx={p[0]} cy={p[1]} r={u * 1.15} />
                    </g>
                  );
                return (
                  <g key={`c${p[0]}-${p[1]}`}>
                    {got && kind === 'timed' && (
                      <circle
                        cx={p[0]}
                        cy={p[1]}
                        r={u}
                        fill="#fff4ec"
                        stroke="none"
                      />
                    )}
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={u}
                      strokeWidth={hot ? 3.8 : 2.6}
                    />
                  </g>
                );
              })}
            </g>
            {labels &&
              art.pts.map((p, i) =>
                i === 0 ||
                (kind === 'course' && i === art.pts.length - 1) ? null : (
                  <text
                    key={`t${p[0]}-${p[1]}`}
                    x={p[0] + art.unit * 1.15}
                    y={p[1] - art.unit * 0.9}
                    className="stencil"
                    fontSize={Math.round(art.unit * 1.1)}
                    fill="#c04a0e"
                  >
                    {i}
                  </text>
                ),
              )}
            {route.map((seg, i) => (
              <g
                key={seg.d}
                className={draw ? 'fade-in' : undefined}
                style={
                  draw
                    ? {
                        animationDelay: `${i * 450}ms`,
                        animationDuration: '600ms',
                      }
                    : undefined
                }
              >
                <path
                  d={seg.d}
                  fill="none"
                  stroke="#161616"
                  strokeWidth="1.8"
                  strokeDasharray="4 4"
                />
                {seg.you && (
                  <circle
                    cx={seg.you[0]}
                    cy={seg.you[1]}
                    r={4.5}
                    fill="#161616"
                  />
                )}
              </g>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}
