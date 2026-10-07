import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';
import { sfx } from '../lib/sound.ts';

const DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';
const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = () => matchMedia('(min-width: 600px)').matches;

export default function Sheet({
  open,
  onClose,
  label,
  children,
  footer,
  sound = true,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  footer?: ReactNode;
  sound?: boolean;
}) {
  const id = useId();
  const dlg = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const closing = useRef(false);
  const openedAt = useRef(0);
  const pushed = useRef(false);
  const cb = useRef(onClose);
  cb.current = onClose;
  const drag = useRef<{
    y0: number;
    dy: number;
    samples: { t: number; y: number }[];
    pid: number;
    armed: boolean;
  } | null>(null);

  const finish = useCallback(() => {
    const d = dlg.current;
    if (d?.open) d.close();
    closing.current = false;
    const el = opener.current as HTMLElement | null;
    if (el?.isConnected) el.focus({ preventScroll: true });
  }, []);

  const animateOut = useCallback(
    (fromY = 0) => {
      const p = panel.current;
      const s = scrim.current;
      if (!p || !s || closing.current) return;
      closing.current = true;
      if (still()) {
        p.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 });
        s.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 160,
        }).onfinish = finish;
        return;
      }
      const big = wide();
      p.animate(
        big
          ? [
              { opacity: 1, transform: 'translateY(0) scale(1)' },
              { opacity: 0, transform: 'translateY(8px) scale(0.98)' },
            ]
          : [
              { transform: `translateY(${fromY}px)` },
              { transform: 'translateY(100%)' },
            ],
        { duration: 200, easing: OUT, fill: 'forwards' },
      );
      s.animate([{ opacity: getComputedStyle(s).opacity }, { opacity: 0 }], {
        duration: 200,
        easing: OUT,
        fill: 'forwards',
      }).onfinish = finish;
    },
    [finish],
  );

  const requestClose = useCallback(() => {
    if (pushed.current && history.state?.sheet === id) {
      history.back();
    } else {
      cb.current();
    }
  }, [id]);

  useLayoutEffect(() => {
    const d = dlg.current;
    const p = panel.current;
    const s = scrim.current;
    if (!d || !p || !s) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      openedAt.current = performance.now();
      closing.current = false;
      d.showModal();
      if (sound) sfx.rustle();
      for (const a of p.getAnimations()) a.cancel();
      for (const a of s.getAnimations()) a.cancel();
      if (still()) {
        p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
        s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      } else if (wide()) {
        p.animate(
          [
            { opacity: 0, transform: 'translateY(12px) scale(0.97)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          { duration: 240, easing: OUT },
        );
        s.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 240,
          easing: OUT,
        });
      } else {
        p.animate(
          [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
          {
            duration: 380,
            easing: DRAWER,
          },
        );
        s.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 380,
          easing: DRAWER,
        });
      }
      if (history.state?.sheet !== id) {
        history.pushState({ ...(history.state ?? {}), sheet: id }, '');
        pushed.current = true;
      }
    } else if (!open && d.open) {
      animateOut();
      if (pushed.current && history.state?.sheet === id) {
        pushed.current = false;
        history.back();
      }
      pushed.current = false;
    }
  }, [open, id, animateOut, sound]);

  useEffect(() => {
    const onPop = () => {
      if (pushed.current && history.state?.sheet !== id) {
        pushed.current = false;
        cb.current();
      }
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [id]);

  function setY(y: number) {
    const p = panel.current;
    const s = scrim.current;
    if (!p || !s) return;
    p.style.transform = `translateY(${y}px)`;
    const h = p.offsetHeight || 1;
    s.style.opacity = String(Math.max(0, 1 - y / h));
  }

  function down(e: React.PointerEvent, fromBody: boolean) {
    if (wide() || e.button !== 0) return;
    if (
      (e.target as HTMLElement).closest('button, a, input, [data-nodrag]') &&
      !fromBody
    )
      return;
    if (fromBody && (body.current?.scrollTop ?? 0) > 0) return;
    drag.current = {
      y0: e.clientY,
      dy: 0,
      samples: [{ t: performance.now(), y: e.clientY }],
      pid: e.pointerId,
      armed: !fromBody,
    };
    if (!fromBody)
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    const g = drag.current;
    if (!g || g.pid !== e.pointerId) return;
    let dy = e.clientY - g.y0;
    if (!g.armed) {
      if (Math.abs(dy) < 6) return;
      if (dy < 0 || (body.current?.scrollTop ?? 0) > 0) {
        drag.current = null;
        return;
      }
      g.armed = true;
      g.y0 = e.clientY;
      dy = 0;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const y = dy >= 0 ? dy : -Math.sqrt(-dy) * 2;
    g.dy = y;
    g.samples.push({ t: performance.now(), y: e.clientY });
    const cut = performance.now() - 90;
    while (g.samples.length > 2 && (g.samples[0]?.t ?? 0) < cut)
      g.samples.shift();
    for (const a of panel.current?.getAnimations() ?? []) a.cancel();
    setY(y);
  }

  function up(e: React.PointerEvent) {
    const g = drag.current;
    drag.current = null;
    if (!g || g.pid !== e.pointerId || !g.armed) return;
    const p = panel.current;
    const s = scrim.current;
    if (!p || !s) return;
    const a = g.samples[0];
    const b = g.samples[g.samples.length - 1];
    const v = a && b && b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
    const h = p.offsetHeight || 1;
    if (g.dy > h * 0.3 || (g.dy > 24 && v > 0.5)) {
      p.style.transform = '';
      s.style.opacity = '';
      if (pushed.current && history.state?.sheet === id) {
        pushed.current = false;
        history.back();
      }
      animateOut(g.dy);
      cb.current();
      return;
    }
    p.animate(
      [{ transform: `translateY(${g.dy}px)` }, { transform: 'translateY(0)' }],
      {
        duration: 320,
        easing: DRAWER,
      },
    );
    s.animate([{ opacity: s.style.opacity || 1 }, { opacity: 1 }], {
      duration: 320,
    });
    p.style.transform = '';
    s.style.opacity = '';
  }

  return (
    <dialog
      ref={dlg}
      className="sheet"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
    >
      <div
        ref={scrim}
        className="fixed inset-0 bg-[rgba(22,22,22,0.32)]"
        onClick={() => {
          if (performance.now() - openedAt.current > 350) requestClose();
        }}
        aria-hidden="true"
      />
      <div className="pointer-events-none fixed inset-0 flex items-end justify-center tab:items-center tab:p-6">
        <div
          ref={panel}
          className="pointer-events-auto relative flex max-h-[86dvh] w-full flex-col border-ink border-t-[1.5px] bg-paper shadow-[0_-12px_28px_rgba(22,22,22,0.16)] tab:max-h-[min(720px,86dvh)] tab:max-w-120 tab:border-[1.5px] tab:shadow-[0_14px_36px_rgba(22,22,22,0.2)]"
        >
          <div
            className="flex flex-none cursor-grab touch-none justify-center pt-2.5 pb-1 tab:hidden"
            onPointerDown={(e) => down(e, false)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <span className="h-1 w-10 rounded-sm bg-handle" />
          </div>
          <div
            ref={body}
            className="scroller min-h-0 flex-1 px-4.5 pt-2 pb-4 tab:px-6 tab:pt-6"
            onPointerDown={(e) => down(e, true)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            {children}
          </div>
          {footer && (
            <div className="flex-none px-4.5 pt-2 pb-[calc(20px+var(--sab))] tab:px-6 tab:pb-6">
              {footer}
            </div>
          )}
          {!footer && (
            <div className="h-[calc(14px+var(--sab))] flex-none tab:h-2" />
          )}
        </div>
      </div>
    </dialog>
  );
}
