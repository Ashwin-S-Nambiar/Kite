import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

export default function Drawer({
  peek,
  more,
  label,
  onOpenChange,
}: {
  peek: ReactNode;
  more: ReactNode;
  label: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const extra = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const range = useRef(0);
  const y = useRef(0);
  const g = useRef<{
    y0: number;
    start: number;
    s: { t: number; y: number }[];
    id: number;
    moved: boolean;
  } | null>(null);

  const place = useCallback((v: number, ms = 0) => {
    y.current = v;
    const el = panel.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms ${EASE}` : 'none';
    el.style.transform = `translate3d(0, ${v}px, 0)`;
  }, []);

  const snap = useCallback(
    (o: boolean, ms = 380) => {
      setOpen(o);
      onOpenChange?.(o);
      place(
        o ? 0 : range.current,
        matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms,
      );
    },
    [place, onOpenChange],
  );

  useLayoutEffect(() => {
    const el = extra.current;
    if (!el) return;
    const measure = () => {
      range.current = el.offsetHeight;
      place(open ? 0 : range.current);
      const total = panel.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(
        '--drawer',
        `${total - range.current}px`,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, place]);

  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('--drawer');
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') snap(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, snap]);

  function down(e: React.PointerEvent) {
    if (
      (e.target as HTMLElement).closest('button:not([data-handle]), a, input')
    )
      return;
    g.current = {
      y0: e.clientY,
      start: y.current,
      s: [{ t: performance.now(), y: e.clientY }],
      id: e.pointerId,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const d = g.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 6) d.moved = true;
    let v = d.start + dy;
    if (v < 0) v = -Math.sqrt(-v) * 2;
    if (v > range.current) v = range.current + Math.sqrt(v - range.current) * 2;
    d.s.push({ t: performance.now(), y: e.clientY });
    const cut = performance.now() - 90;
    while (d.s.length > 2 && (d.s[0]?.t ?? 0) < cut) d.s.shift();
    place(v);
  }
  function up(e: React.PointerEvent) {
    const d = g.current;
    g.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) return;
    const a = d.s[0];
    const b = d.s[d.s.length - 1];
    const v = a && b && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
    if (Math.abs(v) > 0.5) snap(v < 0);
    else snap(y.current < range.current / 2);
  }

  return (
    <section
      ref={panel}
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-ink border-t-[1.5px] bg-paper shadow-[0_-8px_18px_rgba(22,22,22,0.1)] will-change-transform"
      style={{ transform: 'translate3d(0, 100%, 0)' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <button
        type="button"
        data-handle
        className="control mx-auto flex h-6 w-16 touch-none items-center justify-center"
        aria-label={
          open ? `Close ${label.toLowerCase()}` : `Open ${label.toLowerCase()}`
        }
        aria-expanded={open}
        onClick={() => snap(!open)}
      >
        <span className="h-1 w-10 rounded-sm bg-handle" />
      </button>
      <div className="px-3 pb-[calc(10px+var(--sab))]">{peek}</div>
      <div
        ref={extra}
        className="border-rule border-t px-3 pt-3 pb-4"
        inert={!open}
      >
        {more}
      </div>
    </section>
  );
}
